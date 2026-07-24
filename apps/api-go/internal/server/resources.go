package server

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	vcrypto "github.com/yashwanta/drishti-vault/api-go/internal/crypto"
	"github.com/yashwanta/drishti-vault/api-go/internal/database"
	"github.com/yashwanta/drishti-vault/api-go/internal/sessions"
)

var assetTypes = []string{"Aruba AP", "Database", "FleetManager", "Network Device", "Other", "Proxmox Host", "Proxmox VM", "RDS Core", "ShingoCore", "Switch", "Ubuntu Server", "Windows Server"}
var credTypes = []string{"API Token", "Break-Glass", "Database", "Linux SSH", "Other", "Proxmox Login", "Service Account", "Web Login", "Wi-Fi / Network", "Windows Login"}

func (s *Server) registerResources() {
	s.mux.HandleFunc("GET /api/assets", s.authed(s.listAssets))
	s.mux.HandleFunc("POST /api/assets", s.authed(s.createAsset))
	s.mux.HandleFunc("GET /api/assets/{id}", s.authed(s.getAsset))
	s.mux.HandleFunc("PUT /api/assets/{id}", s.authed(s.updateAsset))
	s.mux.HandleFunc("DELETE /api/assets/{id}", s.authed(s.deleteAsset))
	s.mux.HandleFunc("GET /api/credentials", s.authed(s.listCredentials))
	s.mux.HandleFunc("POST /api/credentials", s.authed(s.createCredential))
	s.mux.HandleFunc("PUT /api/credentials/{id}", s.authed(s.updateCredential))
	s.mux.HandleFunc("DELETE /api/credentials/{id}", s.authed(s.deleteCredential))
	s.mux.HandleFunc("GET /api/credentials/{id}/view", s.authed(s.viewCredential))
	s.mux.HandleFunc("POST /api/credentials/{id}/copy", s.authed(s.copyCredential))
	s.mux.HandleFunc("POST /api/credentials/{id}/rotate", s.authed(s.rotateCredential))
	s.mux.HandleFunc("GET /api/network", s.authed(s.listNetwork))
	s.mux.HandleFunc("POST /api/network", s.authed(s.createNetwork))
	s.mux.HandleFunc("PUT /api/network/{id}", s.authed(s.updateNetwork))
	s.mux.HandleFunc("DELETE /api/network/{id}", s.authed(s.deleteNetwork))
	s.mux.HandleFunc("GET /api/changelog", s.authed(s.listChangelog))
	s.mux.HandleFunc("POST /api/changelog", s.authed(s.createChange))
	s.mux.HandleFunc("PUT /api/changelog/{id}", s.authed(s.updateChange))
	s.mux.HandleFunc("DELETE /api/changelog/{id}", s.authed(s.deleteChange))
}
func valid(v string, set []string) bool {
	for _, x := range set {
		if x == v {
			return true
		}
	}
	return false
}
func siteVal(m map[string]any) (any, int64) {
	v := m["site_id"]
	if v == nil {
		return nil, 0
	}
	switch x := v.(type) {
	case float64:
		return int64(x), int64(x)
	case int64:
		return x, x
	default:
		return v, 0
	}
}
func enc(dek []byte, v any) (string, error) { return vcrypto.EncryptField(dek, str(v)) }

func (s *Server) listAssets(w http.ResponseWriter, _ *http.Request, ss *sessions.Session) {
	q, args := scopeQuery(`SELECT a.id,a.site_id,a.app_vm_name,a.asset_type,a.vm_id,a.hostname,a.ip_address,a.environment,a.os_info,a.owner,a.status,a.created_at,a.updated_at,
		CASE WHEN a.web_url_enc!='' THEN 1 ELSE 0 END has_web_url,CASE WHEN a.notes_enc!='' THEN 1 ELSE 0 END has_notes,s.name site_name
		FROM assets a LEFT JOIN sites s ON s.id=a.site_id WHERE `, s.allowedSites(ss), "a.site_id")
	rows, e := queryMaps(s.db, q+" ORDER BY a.app_vm_name", args...)
	if e != nil {
		internal(w, e)
		return
	}
	jsonOut(w, 200, map[string]any{"items": rows, "asset_types": assetTypes})
}
func (s *Server) getAsset(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	var site sql.NullInt64
	var web, notes string
	rows, e := queryMaps(s.db, `SELECT a.id,a.site_id,a.app_vm_name,a.asset_type,a.vm_id,a.hostname,a.ip_address,a.environment,a.os_info,a.owner,a.status,a.created_at,a.updated_at,s.name site_name
		FROM assets a LEFT JOIN sites s ON s.id=a.site_id WHERE a.id=?`, id)
	if e != nil || len(rows) == 0 {
		problem(w, 404, "Asset not found")
		return
	}
	_ = s.db.QueryRow("SELECT site_id,web_url_enc,notes_enc FROM assets WHERE id=?", id).Scan(&site, &web, &notes)
	if site.Valid && !s.canAccessSite(ss, site.Int64) {
		problem(w, 404, "Asset not found")
		return
	}
	rows[0]["web_url"], e = vcrypto.DecryptField(ss.DEK, web)
	if e != nil {
		internal(w, e)
		return
	}
	rows[0]["notes"], e = vcrypto.DecryptField(ss.DEK, notes)
	if e != nil {
		internal(w, e)
		return
	}
	rows[0]["has_web_url"] = web != ""
	rows[0]["has_notes"] = notes != ""
	jsonOut(w, 200, rows[0])
}
func (s *Server) createAsset(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	typ := defaultStr(b["asset_type"], "Other")
	if !valid(typ, assetTypes) {
		problem(w, 400, "Invalid asset type")
		return
	}
	sv, sid := siteVal(b)
	if sid > 0 && !s.canAccessSite(ss, sid) {
		problem(w, 403, "You cannot create assets for that site.")
		return
	}
	web, e := enc(ss.DEK, b["web_url"])
	if e != nil {
		internal(w, e)
		return
	}
	notes, e := enc(ss.DEK, b["notes"])
	if e != nil {
		internal(w, e)
		return
	}
	now := database.Now()
	res, e := s.db.Exec(`INSERT INTO assets(site_id,app_vm_name,asset_type,vm_id,hostname,ip_address,web_url_enc,environment,os_info,owner,status,notes_enc,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, sv, b["app_vm_name"], typ, b["vm_id"], b["hostname"], b["ip_address"], web, b["environment"], b["os_info"], b["owner"], defaultStr(b["status"], "Active"), notes, now, now)
	if e != nil {
		problem(w, 400, e.Error())
		return
	}
	id, _ := res.LastInsertId()
	database.Audit(s.db, ss.Username, "asset.create", "asset", id, str(b["app_vm_name"]), clientIP(r))
	jsonOut(w, 200, map[string]any{"id": id})
}
func (s *Server) updateAsset(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	var oldSite sql.NullInt64
	if e := s.db.QueryRow("SELECT site_id FROM assets WHERE id=?", id).Scan(&oldSite); e != nil {
		problem(w, 404, "Asset not found")
		return
	}
	if oldSite.Valid && !s.canAccessSite(ss, oldSite.Int64) {
		problem(w, 404, "Asset not found")
		return
	}
	sv, sid := siteVal(b)
	if sid > 0 && !s.canAccessSite(ss, sid) {
		problem(w, 403, "You cannot move an asset to that site.")
		return
	}
	typ := defaultStr(b["asset_type"], "Other")
	if !valid(typ, assetTypes) {
		problem(w, 400, "Invalid asset type")
		return
	}
	web, _ := enc(ss.DEK, b["web_url"])
	notes, _ := enc(ss.DEK, b["notes"])
	_, e := s.db.Exec(`UPDATE assets SET site_id=?,app_vm_name=?,asset_type=?,vm_id=?,hostname=?,ip_address=?,web_url_enc=?,environment=?,os_info=?,owner=?,status=?,notes_enc=?,updated_at=? WHERE id=?`, sv, b["app_vm_name"], typ, b["vm_id"], b["hostname"], b["ip_address"], web, b["environment"], b["os_info"], b["owner"], defaultStr(b["status"], "Active"), notes, database.Now(), id)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "asset.edit", "asset", id, str(b["app_vm_name"]), clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}
func (s *Server) deleteAsset(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	s.deleteScoped(w, r, ss, "assets", "asset", "app_vm_name")
}

func (s *Server) listCredentials(w http.ResponseWriter, _ *http.Request, ss *sessions.Session) {
	q, args := scopeQuery(`SELECT c.id,c.title,c.site_id,c.asset_id,c.cred_type,
		CASE WHEN c.username_enc!='' THEN '••••••' ELSE '' END username_masked,
		CASE WHEN c.password_enc!='' THEN 1 ELSE 0 END has_password,
		CASE WHEN c.password_enc!='' THEN '••••••••' ELSE '' END password_masked,
		CASE WHEN c.url_host_enc!='' THEN '••••••' ELSE '' END url_masked,
		c.port,c.rotation_due,c.status,c.created_at,c.updated_at,s.name site_name,a.app_vm_name asset_name
		FROM credentials c LEFT JOIN sites s ON s.id=c.site_id LEFT JOIN assets a ON a.id=c.asset_id WHERE `, s.allowedSites(ss), "c.site_id")
	rows, e := queryMaps(s.db, q+" ORDER BY c.title", args...)
	if e != nil {
		internal(w, e)
		return
	}
	jsonOut(w, 200, map[string]any{"items": rows, "cred_types": credTypes, "clipboard_ttl": s.cfg.ClipboardTTL})
}
func (s *Server) createCredential(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	typ := defaultStr(b["cred_type"], "Other")
	if !valid(typ, credTypes) {
		problem(w, 400, "Invalid credential type")
		return
	}
	sv, sid := siteVal(b)
	if sid > 0 && !s.canAccessSite(ss, sid) {
		problem(w, 403, "You cannot create credentials for that site.")
		return
	}
	u, _ := enc(ss.DEK, b["username"])
	p, _ := enc(ss.DEK, b["password"])
	url, _ := enc(ss.DEK, b["url_host"])
	n, _ := enc(ss.DEK, b["notes"])
	now := database.Now()
	res, e := s.db.Exec(`INSERT INTO credentials(title,site_id,asset_id,cred_type,username_enc,password_enc,url_host_enc,port,rotation_due,status,notes_enc,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, b["title"], sv, b["asset_id"], typ, u, p, url, b["port"], b["rotation_due"], defaultStr(b["status"], "Active"), n, now, now)
	if e != nil {
		problem(w, 400, e.Error())
		return
	}
	id, _ := res.LastInsertId()
	database.Audit(s.db, ss.Username, "credential.create", "credential", id, str(b["title"]), clientIP(r))
	jsonOut(w, 200, map[string]any{"id": id})
}
func (s *Server) updateCredential(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	var oldSite sql.NullInt64
	var ou, op, ourl, on string
	if e := s.db.QueryRow("SELECT site_id,username_enc,password_enc,url_host_enc,notes_enc FROM credentials WHERE id=?", id).Scan(&oldSite, &ou, &op, &ourl, &on); e != nil {
		problem(w, 404, "Credential not found")
		return
	}
	if oldSite.Valid && !s.canAccessSite(ss, oldSite.Int64) {
		problem(w, 404, "Credential not found")
		return
	}
	sv, sid := siteVal(b)
	if sid > 0 && !s.canAccessSite(ss, sid) {
		problem(w, 403, "You cannot move a credential to that site.")
		return
	}
	keep := func(k, old string) string {
		if str(b[k]) == "" {
			return old
		}
		x, _ := enc(ss.DEK, b[k])
		return x
	}
	typ := defaultStr(b["cred_type"], "Other")
	if !valid(typ, credTypes) {
		problem(w, 400, "Invalid credential type")
		return
	}
	_, e := s.db.Exec(`UPDATE credentials SET title=?,site_id=?,asset_id=?,cred_type=?,username_enc=?,password_enc=?,url_host_enc=?,port=?,rotation_due=?,status=?,notes_enc=?,updated_at=? WHERE id=?`, b["title"], sv, b["asset_id"], typ, keep("username", ou), keep("password", op), keep("url_host", ourl), b["port"], b["rotation_due"], defaultStr(b["status"], "Active"), keep("notes", on), database.Now(), id)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "credential.edit", "credential", id, str(b["title"]), clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}
func (s *Server) credentialRow(w http.ResponseWriter, id int64, ss *sessions.Session) (map[string]any, bool) {
	rows, e := queryMaps(s.db, "SELECT * FROM credentials WHERE id=?", id)
	if e != nil || len(rows) == 0 {
		problem(w, 404, "Credential not found")
		return nil, false
	}
	if v := rows[0]["site_id"]; v != nil && !s.canAccessSite(ss, toInt64(v)) {
		problem(w, 404, "Credential not found")
		return nil, false
	}
	return rows[0], true
}
func (s *Server) viewCredential(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if !s.sessions.RevealOpen(ss.ID) {
		problem(w, 403, "Reveal window closed. Re-enter master password to view/copy.")
		return
	}
	id := pathID(r)
	m, ok := s.credentialRow(w, id, ss)
	if !ok {
		return
	}
	for out, col := range map[string]string{"username": "username_enc", "password": "password_enc", "url_host": "url_host_enc", "notes": "notes_enc"} {
		v, e := vcrypto.DecryptField(ss.DEK, str(m[col]))
		if e != nil {
			internal(w, e)
			return
		}
		m[out] = v
		delete(m, col)
	}
	m["clipboard_ttl"] = s.cfg.ClipboardTTL
	database.Audit(s.db, ss.Username, "credential.view", "credential", id, str(m["title"]), clientIP(r))
	jsonOut(w, 200, m)
}
func (s *Server) copyCredential(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if !s.sessions.RevealOpen(ss.ID) {
		problem(w, 403, "Reveal window closed. Re-enter master password to view/copy.")
		return
	}
	id := pathID(r)
	m, ok := s.credentialRow(w, id, ss)
	if !ok {
		return
	}
	database.Audit(s.db, ss.Username, "credential.copy", "credential", id, str(m["title"]), clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true, "clipboard_ttl": s.cfg.ClipboardTTL})
}
func (s *Server) rotateCredential(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	id := pathID(r)
	m, ok := s.credentialRow(w, id, ss)
	if !ok {
		return
	}
	pw := randomPassword(24)
	tok, e := vcrypto.EncryptField(ss.DEK, pw)
	if e != nil {
		internal(w, e)
		return
	}
	due := time.Now().AddDate(0, 0, 90).Format("2006-01-02")
	_, e = s.db.Exec("UPDATE credentials SET password_enc=?,rotation_due=?,updated_at=? WHERE id=?", tok, due, database.Now(), id)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, "credential.rotate", "credential", id, str(m["title"]), clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true, "new_password": pw, "clipboard_ttl": s.cfg.ClipboardTTL})
}
func (s *Server) deleteCredential(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	s.deleteScoped(w, r, ss, "credentials", "credential", "title")
}

func (s *Server) listNetwork(w http.ResponseWriter, _ *http.Request, ss *sessions.Session) {
	q, args := scopeQuery(`SELECT n.*,s.name site_name FROM network_reference n LEFT JOIN sites s ON s.id=n.site_id WHERE `, s.allowedSites(ss), "n.site_id")
	rows, e := queryMaps(s.db, q+" ORDER BY n.vlan_id", args...)
	if e != nil {
		internal(w, e)
		return
	}
	jsonOut(w, 200, map[string]any{"items": rows})
}
func (s *Server) createNetwork(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	s.savePlainResource(w, r, ss, "network_reference", "network", 0, []string{"site_id", "vlan_id", "vlan_name", "subnet", "gateway", "dhcp_scope", "dns_servers", "notes"}, "vlan_name")
}
func (s *Server) updateNetwork(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	s.savePlainResource(w, r, ss, "network_reference", "network", pathID(r), []string{"site_id", "vlan_id", "vlan_name", "subnet", "gateway", "dhcp_scope", "dns_servers", "notes"}, "vlan_name")
}
func (s *Server) deleteNetwork(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	s.deleteScoped(w, r, ss, "network_reference", "network", "vlan_name")
}
func (s *Server) listChangelog(w http.ResponseWriter, _ *http.Request, ss *sessions.Session) {
	rows, e := queryMaps(s.db, `SELECT cl.*,s.name site_name FROM change_log cl LEFT JOIN sites s ON s.id=cl.site_id ORDER BY cl.id DESC`)
	if e != nil {
		internal(w, e)
		return
	}
	if a := s.allowedSites(ss); a != nil {
		keep := rows[:0]
		for _, m := range rows {
			if m["site_id"] != nil && s.canAccessSite(ss, toInt64(m["site_id"])) {
				keep = append(keep, m)
			}
		}
		rows = keep
	}
	jsonOut(w, 200, map[string]any{"items": rows})
}
func (s *Server) createChange(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	s.savePlainResource(w, r, ss, "change_log", "changelog", 0, []string{"event_date", "site_id", "asset_id", "asset_name", "field_changed", "changed_by", "reason_ticket", "approved_by", "notes"}, "asset_name")
}
func (s *Server) updateChange(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	s.savePlainResource(w, r, ss, "change_log", "changelog", pathID(r), []string{"event_date", "site_id", "asset_id", "asset_name", "field_changed", "changed_by", "reason_ticket", "approved_by", "notes"}, "asset_name")
}
func (s *Server) deleteChange(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	s.deleteScoped(w, r, ss, "change_log", "changelog", "asset_name")
}

func (s *Server) savePlainResource(w http.ResponseWriter, r *http.Request, ss *sessions.Session, table, kind string, id int64, fields []string, detail string) {
	creating := id == 0
	var b map[string]any
	if !decode(w, r, &b) {
		return
	}
	_, sid := siteVal(b)
	if sid > 0 && !s.canAccessSite(ss, sid) {
		problem(w, 403, "You cannot modify entries for that site.")
		return
	}
	vals := make([]any, 0, len(fields)+1)
	for _, f := range fields {
		vals = append(vals, b[f])
	}
	var e error
	if id == 0 {
		cols := append(append([]string{}, fields...), "created_at")
		vals = append(vals, database.Now())
		qs := strings.TrimSuffix(strings.Repeat("?,", len(cols)), ",")
		res, x := s.db.Exec("INSERT INTO "+table+"("+strings.Join(cols, ",")+") VALUES("+qs+")", vals...)
		e = x
		if e == nil {
			id, _ = res.LastInsertId()
		}
	} else {
		sets := make([]string, len(fields))
		for i, f := range fields {
			sets[i] = f + "=?"
		}
		vals = append(vals, id)
		_, e = s.db.Exec("UPDATE "+table+" SET "+strings.Join(sets, ",")+" WHERE id=?", vals...)
	}
	if e != nil {
		problem(w, 400, e.Error())
		return
	}
	action := ".edit"
	if creating {
		action = ".create"
	}
	database.Audit(s.db, ss.Username, kind+action, kind, id, str(b[detail]), clientIP(r))
	if id > 0 {
		jsonOut(w, 200, map[string]any{"id": id, "ok": true})
	}
}
func (s *Server) deleteScoped(w http.ResponseWriter, r *http.Request, ss *sessions.Session, table, kind, detailCol string) {
	id := pathID(r)
	var site sql.NullInt64
	var detail sql.NullString
	e := s.db.QueryRow("SELECT site_id,"+detailCol+" FROM "+table+" WHERE id=?", id).Scan(&site, &detail)
	if e != nil {
		problem(w, 404, "Not found")
		return
	}
	if site.Valid && !s.canAccessSite(ss, site.Int64) {
		problem(w, 404, "Not found")
		return
	}
	_, e = s.db.Exec("DELETE FROM "+table+" WHERE id=?", id)
	if e != nil {
		internal(w, e)
		return
	}
	database.Audit(s.db, ss.Username, kind+".delete", kind, id, detail.String, clientIP(r))
	jsonOut(w, 200, map[string]any{"ok": true})
}
func randomPassword(n int) string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+"
	b := make([]byte, n)
	raw := make([]byte, n)
	_, _ = rand.Read(raw)
	for i := range b {
		b[i] = chars[int(raw[i])%len(chars)]
	}
	return string(b)
}
func toInt64(v any) int64 {
	switch x := v.(type) {
	case int64:
		return x
	case float64:
		return int64(x)
	case int:
		return int64(x)
	default:
		var n int64
		fmt.Sscan(fmt.Sprint(v), &n)
		return n
	}
}
func init() { sort.Strings(assetTypes); sort.Strings(credTypes) }
