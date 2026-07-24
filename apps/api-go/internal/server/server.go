package server

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/yashwanta/drishti-vault/api-go/internal/config"
	vcrypto "github.com/yashwanta/drishti-vault/api-go/internal/crypto"
	"github.com/yashwanta/drishti-vault/api-go/internal/database"
	"github.com/yashwanta/drishti-vault/api-go/internal/sessions"
)

type Server struct {
	cfg      config.Config
	db       *sql.DB
	sessions *sessions.Store
	mux      *http.ServeMux
}

func New(cfg config.Config, db *sql.DB) *Server {
	s := &Server{cfg: cfg, db: db, sessions: sessions.New(cfg.IdleMinutes), mux: http.NewServeMux()}
	s.routes()
	return s
}
func (s *Server) Handler() http.Handler { return securityHeaders(s.mux) }
func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/health", s.health)
	s.mux.HandleFunc("GET /api/bootstrap", s.bootstrap)
	s.mux.HandleFunc("POST /api/setup", s.setup)
	s.mux.HandleFunc("POST /api/login", s.login)
	s.mux.HandleFunc("POST /api/lock", s.authed(s.lock))
	s.mux.HandleFunc("POST /api/reveal", s.authed(s.reveal))
	s.mux.HandleFunc("GET /api/me", s.authed(s.me))
	s.mux.HandleFunc("POST /api/change-master-password", s.authed(s.changeMaster))
	s.mux.HandleFunc("GET /api/settings", s.authed(s.settings))
	s.mux.HandleFunc("GET /api/dashboard", s.authed(s.dashboard))
	s.mux.HandleFunc("GET /api/audit", s.authed(s.audit))
	s.mux.HandleFunc("GET /api/sites", s.authed(s.listSites))
	s.mux.HandleFunc("POST /api/sites", s.authed(s.createSite))
	s.mux.HandleFunc("GET /api/sites/{id}", s.authed(s.getSite))
	s.mux.HandleFunc("PUT /api/sites/{id}", s.authed(s.updateSite))
	s.mux.HandleFunc("DELETE /api/sites/{id}", s.authed(s.deleteSite))
	s.registerResources()
	s.registerNotes()
	s.registerUsers()
	s.registerBackupAndImport()
	s.mux.HandleFunc("/", s.spa)
}

type ctxHandler func(http.ResponseWriter, *http.Request, *sessions.Session)

func (s *Server) authed(next ctxHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(s.cfg.SessionCookie)
		if err != nil {
			problem(w, 401, "Vault is locked. Master password required.")
			return
		}
		ss := s.sessions.Get(c.Value)
		if ss == nil {
			problem(w, 401, "Vault is locked. Master password required.")
			return
		}
		next(w, r, ss)
	}
}
func (s *Server) requireAdmin(w http.ResponseWriter, ss *sessions.Session) bool {
	if ss.Role != "super_admin" && ss.Role != "global_admin" {
		problem(w, 403, "Admin role required.")
		return false
	}
	return true
}
func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	jsonOut(w, 200, map[string]any{"ok": true, "app": "DRISHTI-Vault", "version": "2.0.0-go"})
}
func (s *Server) bootstrap(w http.ResponseWriter, _ *http.Request) {
	var n int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&n)
	jsonOut(w, 200, map[string]any{"initialized": n > 0, "idle_lock_minutes": s.cfg.IdleMinutes,
		"clipboard_ttl": s.cfg.ClipboardTTL, "reveal_ttl": s.cfg.RevealTTL})
}
func (s *Server) setup(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Username string `json:"username"`
		Password string `json:"master_password"`
	}
	if !decode(w, r, &b) {
		return
	}
	var n int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&n)
	if n > 0 {
		problem(w, 409, "Vault already initialized.")
		return
	}
	if !strings.EqualFold(strings.TrimSpace(b.Username), "Yash") {
		problem(w, 400, "The first account must be the super admin 'Yash'.")
		return
	}
	if len(b.Password) < 10 {
		problem(w, 422, "Master password must be at least 10 characters.")
		return
	}
	salt, e := vcrypto.GenSalt(16)
	if e != nil {
		internal(w, e)
		return
	}
	dek, e := vcrypto.GenDEK()
	if e != nil {
		internal(w, e)
		return
	}
	kek := vcrypto.DeriveKEK(b.Password, salt)
	wrapped, e := vcrypto.WrapDEK(kek, dek)
	zero(kek)
	zero(dek)
	if e != nil {
		internal(w, e)
		return
	}
	verifier, e := vcrypto.HashMasterPassword(b.Password)
	if e != nil {
		internal(w, e)
		return
	}
	now := database.Now()
	_, e = s.db.Exec(`INSERT INTO users(username,verifier,kdf_salt,wrapped_dek,role,full_name,active,must_change_pw,created_at,updated_at)
		VALUES(?,?,?,?,?,'Yash (Super Admin)',1,0,?,?)`, strings.TrimSpace(b.Username), verifier, salt, wrapped, "super_admin", now, now)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, b.Username, "auth.setup", "", nil, "super-admin created", clientIP(r))
	jsonOut(w, 200, map[string]any{"initialized": true, "role": "super_admin"})
}

type userKey struct {
	ID                       int64
	Username, Verifier, Role string
	Salt, Wrapped            []byte
	Active, MustChange       bool
	FullName                 sql.NullString
}

func (s *Server) userByName(name string) (userKey, error) {
	var u userKey
	var a, m int
	e := s.db.QueryRow(`SELECT id,username,verifier,kdf_salt,wrapped_dek,role,active,must_change_pw,full_name
		FROM users WHERE username=? COLLATE NOCASE`, name).Scan(&u.ID, &u.Username, &u.Verifier, &u.Salt, &u.Wrapped, &u.Role, &a, &m, &u.FullName)
	u.Active = a != 0
	u.MustChange = m != 0
	return u, e
}
func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Username string `json:"username"`
		Password string `json:"master_password"`
	}
	if !decode(w, r, &b) {
		return
	}
	u, e := s.userByName(b.Username)
	if e != nil {
		if errors.Is(e, sql.ErrNoRows) {
			problem(w, 401, "Invalid credentials.")
			return
		}
		internal(w, e)
		return
	}
	if !u.Active {
		problem(w, 403, "This account has been deactivated.")
		return
	}
	ok, _ := vcrypto.VerifyMasterPassword(u.Verifier, b.Password)
	if !ok {
		database.Audit(s.db, u.Username, "auth.login_failed", "", nil, "", clientIP(r))
		problem(w, 401, "Invalid credentials.")
		return
	}
	kek := vcrypto.DeriveKEK(b.Password, u.Salt)
	dek, e := vcrypto.UnwrapDEK(kek, u.Wrapped)
	zero(kek)
	if e != nil {
		problem(w, 401, "Invalid credentials (key mismatch).")
		return
	}
	ss := s.sessions.Create(u.Username, u.ID, u.Role, dek)
	zero(dek)
	http.SetCookie(w, &http.Cookie{Name: s.cfg.SessionCookie, Value: ss.ID, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode})
	database.Audit(s.db, u.Username, "auth.login", "", nil, "role="+u.Role, clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true, "username": u.Username, "role": u.Role, "must_change_pw": u.MustChange,
		"idle_lock_minutes": s.cfg.IdleMinutes, "clipboard_ttl": s.cfg.ClipboardTTL, "reveal_ttl": s.cfg.RevealTTL})
}
func (s *Server) lock(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	database.Audit(s.db, ss.Username, "auth.lock", "", nil, "", clientIP(r))
	s.sessions.Lock(ss.ID)
	http.SetCookie(w, &http.Cookie{Name: s.cfg.SessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteStrictMode})
	jsonOut(w, 200, map[string]any{"locked": true})
}
func (s *Server) reveal(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	var b struct {
		Password string `json:"master_password"`
	}
	if !decode(w, r, &b) {
		return
	}
	u, e := s.userByName(ss.Username)
	if e != nil {
		problem(w, 401, "Session invalid.")
		return
	}
	ok, _ := vcrypto.VerifyMasterPassword(u.Verifier, b.Password)
	if !ok {
		database.Audit(s.db, ss.Username, "auth.reveal_denied", "", nil, "", clientIP(r))
		problem(w, 401, "Invalid credentials.")
		return
	}
	s.sessions.OpenReveal(ss.ID, s.cfg.RevealTTL)
	database.Audit(s.db, ss.Username, "auth.reveal_opened", "", nil, fmt.Sprintf("reveal_ttl=%ds", s.cfg.RevealTTL), clientIP(r))
	jsonOut(w, 200, map[string]any{"reveal_open": true, "ttl": s.cfg.RevealTTL})
}
func (s *Server) me(w http.ResponseWriter, _ *http.Request, ss *sessions.Session) {
	var full sql.NullString
	var must int
	_ = s.db.QueryRow("SELECT full_name,must_change_pw FROM users WHERE id=?", ss.UserID).Scan(&full, &must)
	jsonOut(w, 200, map[string]any{"username": ss.Username, "role": ss.Role, "full_name": nullString(full),
		"must_change_pw": must != 0, "reveal_open": s.sessions.RevealOpen(ss.ID), "reveal_ttl": s.cfg.RevealTTL})
}
func (s *Server) changeMaster(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	var b struct {
		Current string `json:"current_master_password"`
		New     string `json:"new_master_password"`
	}
	if !decode(w, r, &b) {
		return
	}
	if len(b.New) < 10 {
		problem(w, 422, "New master password must be at least 10 characters.")
		return
	}
	u, e := s.userByName(ss.Username)
	if e != nil {
		internal(w, e)
		return
	}
	ok, _ := vcrypto.VerifyMasterPassword(u.Verifier, b.Current)
	if !ok {
		problem(w, 401, "Current master password is incorrect.")
		return
	}
	old := vcrypto.DeriveKEK(b.Current, u.Salt)
	dek, e := vcrypto.UnwrapDEK(old, u.Wrapped)
	zero(old)
	if e != nil {
		internal(w, e)
		return
	}
	salt, _ := vcrypto.GenSalt(16)
	key := vcrypto.DeriveKEK(b.New, salt)
	wrapped, e := vcrypto.WrapDEK(key, dek)
	zero(key)
	zero(dek)
	if e != nil {
		internal(w, e)
		return
	}
	hash, e := vcrypto.HashMasterPassword(b.New)
	if e != nil {
		internal(w, e)
		return
	}
	_, e = s.db.Exec("UPDATE users SET verifier=?,kdf_salt=?,wrapped_dek=?,must_change_pw=0,updated_at=? WHERE id=?", hash, salt, wrapped, database.Now(), u.ID)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "auth.change_master", "", nil, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true, "must_change_pw": false, "message": "Master password changed. Your saved secrets are intact."})
}
func (s *Server) settings(w http.ResponseWriter, _ *http.Request, _ *sessions.Session) {
	jsonOut(w, 200, map[string]any{"host": s.cfg.Host, "port": mustInt(s.cfg.Port), "idle_lock_minutes": s.cfg.IdleMinutes,
		"clipboard_ttl": s.cfg.ClipboardTTL, "reveal_ttl": s.cfg.RevealTTL, "db_path": s.cfg.DBPath, "backup_dir": s.cfg.BackupDir})
}

func (s *Server) dashboard(w http.ResponseWriter, _ *http.Request, ss *sessions.Session) {
	allowed := s.allowedSites(ss)
	count := func(table string) int {
		q, args := scopeQuery("SELECT COUNT(*) FROM "+table+" WHERE ", allowed, "site_id")
		var n int
		_ = s.db.QueryRow(q, args...).Scan(&n)
		return n
	}
	var due int
	q, args := scopeQuery(`SELECT COUNT(*) FROM credentials WHERE rotation_due IS NOT NULL AND rotation_due!='' AND rotation_due<=date('now') AND status='Active' AND `, allowed, "site_id")
	_ = s.db.QueryRow(q, args...).Scan(&due)
	changes, _ := queryMaps(s.db, `SELECT id,event_date,asset_name,field_changed,changed_by,reason_ticket,approved_by FROM change_log ORDER BY id DESC LIMIT 10`)
	var audits []map[string]any
	if allowed == nil {
		audits, _ = queryMaps(s.db, `SELECT id,event_ts,actor,action,target_type,target_id,detail FROM audit_log ORDER BY id DESC LIMIT 10`)
	} else {
		audits, _ = queryMaps(s.db, `SELECT id,event_ts,actor,action,target_type,target_id,detail FROM audit_log WHERE actor=? ORDER BY id DESC LIMIT 10`, ss.Username)
	}
	jsonOut(w, 200, map[string]any{"total_sites": count("sites"), "total_assets": count("assets"), "total_credentials": count("credentials"),
		"credentials_due_rotation": due, "recent_changes": changes, "recent_audit": audits})
}
func (s *Server) audit(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	limit := clamp(queryInt(r, "limit", 500), 1, 2000)
	off := max(queryInt(r, "offset", 0), 0)
	var rows []map[string]any
	var total int
	if ss.Role == "location_admin" {
		rows, _ = queryMaps(s.db, `SELECT id,event_ts,actor,action,target_type,target_id,detail,source_ip FROM audit_log WHERE actor=? ORDER BY id DESC LIMIT ? OFFSET ?`, ss.Username, limit, off)
		_ = s.db.QueryRow("SELECT COUNT(*) FROM audit_log WHERE actor=?", ss.Username).Scan(&total)
	} else {
		rows, _ = queryMaps(s.db, `SELECT id,event_ts,actor,action,target_type,target_id,detail,source_ip FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?`, limit, off)
		_ = s.db.QueryRow("SELECT COUNT(*) FROM audit_log").Scan(&total)
	}
	jsonOut(w, 200, map[string]any{"items": rows, "total": total})
}

func (s *Server) listSites(w http.ResponseWriter, _ *http.Request, ss *sessions.Session) {
	q, args := scopeQuery("SELECT id,name,plant_code,location,status,notes,created_at,updated_at FROM sites WHERE ", s.allowedSites(ss), "id")
	rows, e := queryMaps(s.db, q+" ORDER BY name", args...)
	if e != nil {
		internal(w, e)
		return
	}
	jsonOut(w, 200, map[string]any{"items": rows})
}
func (s *Server) createSite(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if !s.requireAdmin(w, ss) {
		return
	}
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	name := str(b["name"])
	if name == "" {
		problem(w, 422, "Name is required.")
		return
	}
	now := database.Now()
	res, e := s.db.Exec(`INSERT INTO sites(name,plant_code,location,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`, name, b["plant_code"], b["location"], defaultStr(b["status"], "Active"), b["notes"], now, now)
	if e != nil {
		problem(w, 400, "Site name already exists.")
		return
	}
	id, _ := res.LastInsertId()
	database.Audit(s.db, ss.Username, "site.create", "site", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"id": id})
}
func (s *Server) getSite(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	if !s.canAccessSite(ss, id) {
		problem(w, 404, "Site not found.")
		return
	}
	rows, e := queryMaps(s.db, "SELECT * FROM sites WHERE id=?", id)
	if e != nil || len(rows) == 0 {
		problem(w, 404, "Site not found.")
		return
	}
	jsonOut(w, 200, rows[0])
}
func (s *Server) updateSite(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if !s.requireAdmin(w, ss) {
		return
	}
	id := pathID(r)
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	res, e := s.db.Exec(`UPDATE sites SET name=?,plant_code=?,location=?,status=?,notes=?,updated_at=? WHERE id=?`, b["name"], b["plant_code"], b["location"], defaultStr(b["status"], "Active"), b["notes"], database.Now(), id)
	if e != nil {
		problem(w, 400, e.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		problem(w, 404, "Site not found.")
		return
	}
	database.Audit(s.db, ss.Username, "site.edit", "site", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}
func (s *Server) deleteSite(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if !s.requireAdmin(w, ss) {
		return
	}
	id := pathID(r)
	res, e := s.db.Exec("DELETE FROM sites WHERE id=?", id)
	if e != nil {
		internal(w, e)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		problem(w, 404, "Site not found.")
		return
	}
	database.Audit(s.db, ss.Username, "site.delete", "site", id, "", clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}

func (s *Server) allowedSites(ss *sessions.Session) []int64 {
	if ss.Role != "location_admin" {
		return nil
	}
	rows, e := s.db.Query("SELECT site_id FROM user_sites WHERE user_id=?", ss.UserID)
	if e != nil {
		return []int64{}
	}
	defer rows.Close()
	out := []int64{}
	for rows.Next() {
		var id int64
		_ = rows.Scan(&id)
		out = append(out, id)
	}
	return out
}
func (s *Server) canAccessSite(ss *sessions.Session, id int64) bool {
	a := s.allowedSites(ss)
	if a == nil {
		return true
	}
	for _, v := range a {
		if v == id {
			return true
		}
	}
	return false
}
func scopeQuery(prefix string, ids []int64, col string) (string, []any) {
	if ids == nil {
		return prefix + "1=1", nil
	}
	if len(ids) == 0 {
		return prefix + "1=0", nil
	}
	p := make([]string, len(ids))
	a := make([]any, len(ids))
	for i, v := range ids {
		p[i] = "?"
		a[i] = v
	}
	return prefix + col + " IN (" + strings.Join(p, ",") + ")", a
}

func (s *Server) spa(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		problem(w, 404, "not found")
		return
	}
	p := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
	if p == "." {
		p = "index.html"
	}
	full := filepath.Join(s.cfg.WebDist, p)
	if !strings.HasPrefix(full, filepath.Clean(s.cfg.WebDist)+string(os.PathSeparator)) {
		problem(w, 404, "not found")
		return
	}
	if st, e := os.Stat(full); e == nil && !st.IsDir() {
		if ct := mime.TypeByExtension(filepath.Ext(full)); ct != "" {
			w.Header().Set("Content-Type", ct)
		}
		http.ServeFile(w, r, full)
		return
	}
	idx := filepath.Join(s.cfg.WebDist, "index.html")
	if _, e := os.Stat(idx); e == nil {
		http.ServeFile(w, r, idx)
		return
	}
	problem(w, 503, "Frontend not built. Run: cd apps/web && npm run build")
}

func queryMaps(db *sql.DB, q string, args ...any) ([]map[string]any, error) {
	rows, e := db.Query(q, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	cols, _ := rows.Columns()
	out := []map[string]any{}
	for rows.Next() {
		vals := make([]any, len(cols))
		ptr := make([]any, len(cols))
		for i := range vals {
			ptr[i] = &vals[i]
		}
		if e = rows.Scan(ptr...); e != nil {
			return nil, e
		}
		m := map[string]any{}
		for i, c := range cols {
			if b, ok := vals[i].([]byte); ok {
				m[c] = string(b)
			} else {
				m[c] = vals[i]
			}
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 20<<20)
	d := json.NewDecoder(r.Body)
	if e := d.Decode(v); e != nil {
		problem(w, 400, "Invalid request body.")
		return false
	}
	return true
}
func jsonOut(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func problem(w http.ResponseWriter, status int, msg string) {
	jsonOut(w, status, map[string]any{"detail": msg})
}
func internal(w http.ResponseWriter, e error) {
	log.Printf("request failed: %v", e)
	problem(w, 500, "Internal server error.")
}
func pathID(r *http.Request) int64 {
	v, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if v == 0 {
		v, _ = strconv.ParseInt(r.PathValue("nid"), 10, 64)
	}
	if v == 0 {
		v, _ = strconv.ParseInt(r.PathValue("cid"), 10, 64)
	}
	return v
}
func queryInt(r *http.Request, k string, d int) int {
	v, e := strconv.Atoi(r.URL.Query().Get(k))
	if e != nil {
		return d
	}
	return v
}
func clientIP(r *http.Request) string {
	h, _, e := net.SplitHostPort(r.RemoteAddr)
	if e == nil {
		return h
	}
	return "127.0.0.1"
}
func zero(b []byte) {
	for i := range b {
		b[i] = 0
	}
}
func nullString(v sql.NullString) any {
	if v.Valid {
		return v.String
	}
	return nil
}
func str(v any) string {
	if v == nil {
		return ""
	}
	return fmt.Sprint(v)
}
func defaultStr(v any, d string) string {
	x := str(v)
	if x == "" {
		return d
	}
	return x
}
func mustInt(v string) int { i, _ := strconv.Atoi(v); return i }
func clamp(v, a, b int) int {
	if v < a {
		return a
	}
	if v > b {
		return b
	}
	return v
}
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:")
		next.ServeHTTP(w, r)
	})
}

var _ = io.EOF
var _ = time.Second
