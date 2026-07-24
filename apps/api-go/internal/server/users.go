package server

import (
	"database/sql"
	"net/http"
	"strings"

	vcrypto "github.com/yashwanta/drishti-vault/api-go/internal/crypto"
	"github.com/yashwanta/drishti-vault/api-go/internal/database"
	"github.com/yashwanta/drishti-vault/api-go/internal/sessions"
)

func (s *Server) registerUsers() {
	s.mux.HandleFunc("GET /api/users", s.authed(s.listUsers))
	s.mux.HandleFunc("POST /api/users", s.authed(s.createUser))
	s.mux.HandleFunc("PUT /api/users/{id}", s.authed(s.updateUser))
	s.mux.HandleFunc("POST /api/users/{id}/sites", s.authed(s.assignSites))
	s.mux.HandleFunc("DELETE /api/users/{id}", s.authed(s.deactivateUser))
	s.mux.HandleFunc("POST /api/users/{id}/reset-password", s.authed(s.resetPassword))
}
func (s *Server) listUsers(w http.ResponseWriter, _ *http.Request, ss *sessions.Session) {
	if !s.requireAdmin(w, ss) {
		return
	}
	q := `SELECT id,username,role,full_name,active,must_change_pw,created_at,updated_at FROM users`
	if ss.Role != "super_admin" {
		q += " WHERE role!='super_admin'"
	}
	q += " ORDER BY id"
	rows, e := queryMaps(s.db, q)
	if e != nil {
		internal(w, e)
		return
	}
	for _, u := range rows {
		sites, _ := queryMaps(s.db, `SELECT s.id,s.name FROM sites s JOIN user_sites us ON us.site_id=s.id WHERE us.user_id=? ORDER BY s.name`, u["id"])
		u["sites"] = sites
	}
	jsonOut(w, 200, map[string]any{"items": rows, "roles": []string{"global_admin", "location_admin"}, "can_reset_password": ss.Role == "super_admin"})
}
func validateRole(v string) bool { return v == "global_admin" || v == "location_admin" }
func (s *Server) createUser(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if !s.requireAdmin(w, ss) {
		return
	}
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	name := strings.TrimSpace(str(b["username"]))
	role := str(b["role"])
	pw := str(b["password"])
	if strings.EqualFold(name, "Yash") || name == "" {
		problem(w, 400, "That username is reserved.")
		return
	}
	if !validateRole(role) {
		problem(w, 400, "Invalid role.")
		return
	}
	if ss.Role == "global_admin" && role != "location_admin" {
		problem(w, 403, "Global admins may create location admins only.")
		return
	}
	if len(pw) < 10 {
		problem(w, 422, "Password must be at least 10 characters.")
		return
	}
	hash, e := vcrypto.HashMasterPassword(pw)
	if e != nil {
		internal(w, e)
		return
	}
	salt, _ := vcrypto.GenSalt(16)
	kek := vcrypto.DeriveKEK(pw, salt)
	wrapped, e := vcrypto.WrapDEK(kek, ss.DEK)
	zero(kek)
	if e != nil {
		internal(w, e)
		return
	}
	now := database.Now()
	res, e := s.db.Exec(`INSERT INTO users(username,verifier,kdf_salt,wrapped_dek,role,full_name,active,must_change_pw,created_at,updated_at) VALUES(?,?,?,?,?,?,1,1,?,?)`, name, hash, salt, wrapped, role, b["full_name"], now, now)
	if e != nil {
		problem(w, 409, "Username already exists.")
		return
	}
	id, _ := res.LastInsertId()
	if ids, ok := b["site_ids"].([]any); ok {
		_ = s.replaceSites(id, ids)
	}
	database.Audit(s.db, ss.Username, "user.create", "user", id, "role="+role, clientIP(r))
	jsonOut(w, 200, map[string]any{"id": id})
}
func (s *Server) protectedUser(id int64) bool {
	var role string
	e := s.db.QueryRow("SELECT role FROM users WHERE id=?", id).Scan(&role)
	return e == nil && role == "super_admin"
}
func (s *Server) updateUser(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if !s.requireAdmin(w, ss) {
		return
	}
	id := pathID(r)
	if s.protectedUser(id) {
		problem(w, 403, "The super-admin account is protected and cannot be modified.")
		return
	}
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	role := str(b["role"])
	if role != "" && !validateRole(role) {
		problem(w, 400, "Invalid role.")
		return
	}
	var oldRole string
	var oldFull sql.NullString
	var active int
	if e := s.db.QueryRow("SELECT role,full_name,active FROM users WHERE id=?", id).Scan(&oldRole, &oldFull, &active); e != nil {
		problem(w, 404, "User not found.")
		return
	}
	if role == "" {
		role = oldRole
	}
	full := b["full_name"]
	if _, ok := b["full_name"]; !ok {
		full = nullString(oldFull)
	}
	act := active
	if v, ok := b["active"].(bool); ok {
		if v {
			act = 1
		} else {
			act = 0
		}
	}
	_, e := s.db.Exec("UPDATE users SET role=?,full_name=?,active=?,updated_at=? WHERE id=?", role, full, act, database.Now(), id)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "user.edit", "user", id, "role="+role, clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}
func (s *Server) replaceSites(uid int64, ids []any) error {
	tx, e := s.db.Begin()
	if e != nil {
		return e
	}
	defer tx.Rollback()
	if _, e = tx.Exec("DELETE FROM user_sites WHERE user_id=?", uid); e != nil {
		return e
	}
	for _, v := range ids {
		if _, e = tx.Exec("INSERT OR IGNORE INTO user_sites(user_id,site_id) VALUES(?,?)", uid, toInt64(v)); e != nil {
			return e
		}
	}
	return tx.Commit()
}
func (s *Server) assignSites(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if !s.requireAdmin(w, ss) {
		return
	}
	id := pathID(r)
	if s.protectedUser(id) {
		problem(w, 403, "The super-admin account is protected.")
		return
	}
	var b struct {
		IDs []any `json:"site_ids"`
	}
	if !decode(w, r, &b) {
		return
	}
	if e := s.replaceSites(id, b.IDs); e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "user.assign_sites", "user", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}
func (s *Server) deactivateUser(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if !s.requireAdmin(w, ss) {
		return
	}
	id := pathID(r)
	if s.protectedUser(id) {
		problem(w, 403, "The super-admin account is protected.")
		return
	}
	res, e := s.db.Exec("UPDATE users SET active=0,updated_at=? WHERE id=?", database.Now(), id)
	if e != nil {
		internal(w, e)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		problem(w, 404, "User not found.")
		return
	}
	database.Audit(s.db, ss.Username, "user.deactivate", "user", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}
func (s *Server) resetPassword(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if ss.Role != "super_admin" {
		problem(w, 403, "Super-admin role required.")
		return
	}
	id := pathID(r)
	if s.protectedUser(id) {
		problem(w, 403, "The super-admin password must be changed from account settings.")
		return
	}
	var b struct {
		Password string `json:"new_password"`
	}
	if !decode(w, r, &b) {
		return
	}
	if len(b.Password) < 10 {
		problem(w, 422, "Password must be at least 10 characters.")
		return
	}
	hash, e := vcrypto.HashMasterPassword(b.Password)
	if e != nil {
		internal(w, e)
		return
	}
	salt, _ := vcrypto.GenSalt(16)
	kek := vcrypto.DeriveKEK(b.Password, salt)
	wrapped, e := vcrypto.WrapDEK(kek, ss.DEK)
	zero(kek)
	if e != nil {
		internal(w, e)
		return
	}
	res, e := s.db.Exec("UPDATE users SET verifier=?,kdf_salt=?,wrapped_dek=?,must_change_pw=1,updated_at=? WHERE id=?", hash, salt, wrapped, database.Now(), id)
	if e != nil {
		internal(w, e)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		problem(w, 404, "User not found.")
		return
	}
	database.Audit(s.db, ss.Username, "user.reset_password", "user", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}
