package server

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	vcrypto "github.com/yashwanta/drishti-vault/api-go/internal/crypto"
	"github.com/yashwanta/drishti-vault/api-go/internal/database"
	"github.com/yashwanta/drishti-vault/api-go/internal/sessions"
)

func (s *Server) registerNotes() {
	s.mux.HandleFunc("GET /api/notes", s.authed(s.listNotes))
	s.mux.HandleFunc("POST /api/notes", s.authed(s.createNote))
	s.mux.HandleFunc("PUT /api/notes/{id}", s.authed(s.updateNote))
	s.mux.HandleFunc("DELETE /api/notes/{id}", s.authed(s.deleteNote))
	s.mux.HandleFunc("POST /api/notes/{id}/pin", s.authed(s.toggleNotePin))
}
func (s *Server) noteOwned(ss *sessions.Session, id int64) (int64, bool) {
	var owner int64
	e := s.db.QueryRow("SELECT owner_id FROM notes WHERE id=?", id).Scan(&owner)
	return owner, e == nil && (owner == ss.UserID || ss.Role == "super_admin")
}
func (s *Server) listNotes(w http.ResponseWriter, _ *http.Request, ss *sessions.Session) {
	q := "SELECT id,title_enc,body_enc,tags_enc,color,pinned,owner_id,created_at,updated_at FROM notes"
	args := []any{}
	if ss.Role != "super_admin" {
		q += " WHERE owner_id=?"
		args = append(args, ss.UserID)
	}
	q += " ORDER BY pinned DESC,updated_at DESC"
	rows, e := s.db.Query(q, args...)
	if e != nil {
		internal(w, e)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, owner int64
		var title, body, tags, color string
		var pinned int
		var created, updated string
		if e = rows.Scan(&id, &title, &body, &tags, &color, &pinned, &owner, &created, &updated); e != nil {
			internal(w, e)
			return
		}
		title, e = vcrypto.DecryptField(ss.DEK, title)
		if e != nil {
			internal(w, e)
			return
		}
		body, e = vcrypto.DecryptField(ss.DEK, body)
		if e != nil {
			internal(w, e)
			return
		}
		tags, e = vcrypto.DecryptField(ss.DEK, tags)
		if e != nil {
			internal(w, e)
			return
		}
		var tv []string
		if tags != "" {
			_ = json.Unmarshal([]byte(tags), &tv)
		}
		items = append(items, map[string]any{"id": id, "title": title, "body": body, "tags": tv, "color": color, "pinned": pinned != 0, "owner_id": owner, "created_at": created, "updated_at": updated})
	}
	jsonOut(w, 200, map[string]any{"items": items})
}
func validColor(v string) bool {
	switch v {
	case "", "yellow", "green", "blue", "pink", "purple", "gray":
		return true
	}
	return false
}
func noteFields(ss *sessions.Session, b map[string]any) (string, string, string, string, bool, error) {
	color := str(b["color"])
	if !validColor(color) {
		return "", "", "", "", false, sql.ErrNoRows
	}
	title, e := vcrypto.EncryptField(ss.DEK, str(b["title"]))
	if e != nil {
		return "", "", "", "", false, e
	}
	body, e := vcrypto.EncryptField(ss.DEK, str(b["body"]))
	if e != nil {
		return "", "", "", "", false, e
	}
	raw, _ := json.Marshal(b["tags"])
	tags, e := vcrypto.EncryptField(ss.DEK, string(raw))
	return title, body, tags, color, b["pinned"] == true, e
}
func (s *Server) createNote(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	title, body, tags, color, pinned, e := noteFields(ss, b)
	if e != nil {
		problem(w, 400, "Invalid note.")
		return
	}
	now := database.Now()
	res, e := s.db.Exec(`INSERT INTO notes(title_enc,body_enc,tags_enc,color,pinned,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`, title, body, tags, color, pinned, ss.UserID, now, now)
	if e != nil {
		internal(w, e)
		return
	}
	id, _ := res.LastInsertId()
	database.Audit(s.db, ss.Username, "note.create", "note", id, "color="+color, clientIP(r))
	jsonOut(w, 200, map[string]any{"id": id})
}
func (s *Server) updateNote(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	if _, ok := s.noteOwned(ss, id); !ok {
		problem(w, 404, "Note not found.")
		return
	}
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	sets := []string{}
	args := []any{}
	for _, p := range []struct {
		json, col string
		encrypted bool
	}{{"title", "title_enc", true}, {"body", "body_enc", true}, {"tags", "tags_enc", true}, {"color", "color", false}, {"pinned", "pinned", false}} {
		v, exists := b[p.json]
		if !exists {
			continue
		}
		if p.json == "color" && !validColor(str(v)) {
			problem(w, 400, "Invalid color.")
			return
		}
		if p.encrypted {
			raw := str(v)
			if p.json == "tags" {
				x, _ := json.Marshal(v)
				raw = string(x)
			}
			x, e := vcrypto.EncryptField(ss.DEK, raw)
			if e != nil {
				internal(w, e)
				return
			}
			v = x
		}
		sets = append(sets, p.col+"=?")
		args = append(args, v)
	}
	if len(sets) == 0 {
		jsonOut(w, 200, map[string]any{"ok": true, "updated": false})
		return
	}
	sets = append(sets, "updated_at=?")
	args = append(args, database.Now(), id)
	_, e := s.db.Exec("UPDATE notes SET "+strings.Join(sets, ",")+" WHERE id=?", args...)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "note.edit", "note", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true, "updated": true})
}
func (s *Server) deleteNote(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	if _, ok := s.noteOwned(ss, id); !ok {
		problem(w, 404, "Note not found.")
		return
	}
	_, e := s.db.Exec("DELETE FROM notes WHERE id=?", id)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "note.delete", "note", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}
func (s *Server) toggleNotePin(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	if _, ok := s.noteOwned(ss, id); !ok {
		problem(w, 404, "Note not found.")
		return
	}
	var old int
	_ = s.db.QueryRow("SELECT pinned FROM notes WHERE id=?", id).Scan(&old)
	v := 1
	if old != 0 {
		v = 0
	}
	_, e := s.db.Exec("UPDATE notes SET pinned=?,updated_at=? WHERE id=?", v, database.Now(), id)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "note.pin", "note", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"id": id, "pinned": v != 0})
}
