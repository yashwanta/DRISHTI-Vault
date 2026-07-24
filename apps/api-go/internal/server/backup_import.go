package server

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	vcrypto "github.com/yashwanta/drishti-vault/api-go/internal/crypto"
	"github.com/yashwanta/drishti-vault/api-go/internal/database"
	"github.com/yashwanta/drishti-vault/api-go/internal/sessions"
)

var backupTables = []string{"vault_settings", "users", "sites", "user_sites", "assets", "credentials", "network_reference", "change_log", "audit_log", "notes"}

type stagedPayload struct {
	Owner   string
	Payload map[string]any
	Expires time.Time
}

var restoreStages = struct {
	sync.Mutex
	m map[string]stagedPayload
}{m: map[string]stagedPayload{}}

func (s *Server) registerBackupAndImport() {
	s.mux.HandleFunc("POST /api/backup/export", s.authed(s.exportBackup))
	s.mux.HandleFunc("POST /api/backup/restore/preview", s.authed(s.restorePreview))
	s.mux.HandleFunc("POST /api/backup/restore/commit", s.authed(s.restoreCommit))
	s.mux.HandleFunc("GET /api/backup/history", s.authed(s.backupHistory))
	s.mux.HandleFunc("GET /api/backup/last", s.authed(s.backupLast))
	s.mux.HandleFunc("GET /api/csv/tables", s.authed(s.csvTables))
	s.mux.HandleFunc("GET /api/csv/template/{table}", s.authed(s.csvTemplate))
	s.mux.HandleFunc("POST /api/csv/preview", s.authed(s.csvPreview))
	s.mux.HandleFunc("POST /api/csv/commit", s.authed(s.csvCommit))
	s.mux.HandleFunc("POST /api/import/excel/preview", s.authed(s.excelPreview))
	s.mux.HandleFunc("POST /api/import/excel/commit", s.authed(s.excelCommit))
}
func (s *Server) verifyMaster(ss *sessions.Session, pw string) bool {
	u, e := s.userByName(ss.Username)
	if e != nil {
		return false
	}
	ok, _ := vcrypto.VerifyMasterPassword(u.Verifier, pw)
	return ok
}
func backupGCM(key []byte) (cipher.AEAD, error) {
	b, e := aes.NewCipher(key)
	if e != nil {
		return nil, e
	}
	return cipher.NewGCM(b)
}
func b64(b []byte) string         { return base64.StdEncoding.EncodeToString(b) }
func unb64(v any) ([]byte, error) { return base64.StdEncoding.DecodeString(str(v)) }
func (s *Server) backupPayload() (map[string]any, error) {
	tables := map[string]any{}
	for _, t := range backupTables {
		rows, e := s.db.Query("SELECT * FROM " + t)
		if e != nil {
			return nil, e
		}
		cols, _ := rows.Columns()
		items := []map[string]any{}
		for rows.Next() {
			vals := make([]any, len(cols))
			ptr := make([]any, len(cols))
			for i := range vals {
				ptr[i] = &vals[i]
			}
			if e = rows.Scan(ptr...); e != nil {
				rows.Close()
				return nil, e
			}
			m := map[string]any{}
			for i, c := range cols {
				if x, ok := vals[i].([]byte); ok {
					m[c] = map[string]any{"__b64__": b64(x)}
				} else {
					m[c] = vals[i]
				}
			}
			items = append(items, m)
		}
		rows.Close()
		tables[t] = map[string]any{"columns": cols, "rows": items}
	}
	return map[string]any{"format": "drishtivault-backup-v2", "backup_created_at": database.Now(), "backup_version": "DRISHTI-Vault 2.0.0-go", "schema_version": "4", "tables": tables}, nil
}
func (s *Server) exportBackup(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	var b struct {
		Master  string `json:"master_password"`
		Backup  string `json:"backup_password"`
		Confirm string `json:"backup_password_confirm"`
	}
	if !decode(w, r, &b) {
		return
	}
	if !s.verifyMaster(ss, b.Master) {
		problem(w, 401, "Master password incorrect.")
		return
	}
	if len(b.Backup) < 10 {
		problem(w, 400, "Backup password must be at least 10 characters")
		return
	}
	if b.Backup != b.Confirm {
		problem(w, 400, "Vault Backup Password fields do not match.")
		return
	}
	payload, e := s.backupPayload()
	if e != nil {
		internal(w, e)
		return
	}
	plain, _ := json.Marshal(payload)
	salt, _ := vcrypto.GenSalt(16)
	nonce, _ := vcrypto.GenSalt(12)
	key := vcrypto.DeriveKEK(b.Backup, salt)
	g, e := backupGCM(key)
	if e != nil {
		internal(w, e)
		return
	}
	ct := g.Seal(nil, nonce, plain, nil)
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	msg := append(append(append([]byte("DRISHTIVAULT-BACKUP-v2:"), salt...), ':'), nonce...)
	msg = append(msg, ':')
	msg = append(msg, ct...)
	sig := ed25519.Sign(priv, msg)
	sknonce, _ := vcrypto.GenSalt(12)
	skct := g.Seal(nil, sknonce, priv.Seed(), nil)
	zero(key)
	env := map[string]any{"format": "drishtivault-backup-v2", "kdf": "argon2id", "kdf_params": map[string]int{"t": 3, "m": 65536, "p": 4}, "kdf_salt": b64(salt), "nonce": b64(nonce), "ciphertext": b64(ct), "sig_alg": "ed25519", "sig_pub": b64(pub), "sig": b64(sig), "sig_priv_enc": b64(append(sknonce, skct...))}
	data, _ := json.MarshalIndent(env, "", "  ")
	name := "DRISHTI_Vault_Backup_" + time.Now().Format("2006-01-02_1504") + ".drishtivaultbackup"
	_, _ = s.db.Exec("INSERT INTO backup_events(event_ts,kind,success,filename,actor,detail) VALUES(?,'export',1,?,?,?)", database.Now(), name, ss.Username, "Go v2 backup")
	database.Audit(s.db, ss.Username, "backup.export", "", nil, "file="+name, clientIP(r))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
	w.Header().Set("X-Backup-Created-At", str(payload["backup_created_at"]))
	w.WriteHeader(200)
	_, _ = w.Write(data)
}
func decryptEnvelope(data []byte, pw string) (map[string]any, error) {
	var e map[string]any
	if json.Unmarshal(data, &e) != nil || e["format"] != "drishtivault-backup-v2" {
		return nil, fmt.Errorf("Backup file is not a valid DRISHTI-Vault backup.")
	}
	salt, x := unb64(e["kdf_salt"])
	if x != nil {
		return nil, x
	}
	nonce, x := unb64(e["nonce"])
	if x != nil {
		return nil, x
	}
	ct, x := unb64(e["ciphertext"])
	if x != nil {
		return nil, x
	}
	key := vcrypto.DeriveKEK(pw, salt)
	g, x := backupGCM(key)
	if x != nil {
		return nil, x
	}
	plain, x := g.Open(nil, nonce, ct, nil)
	zero(key)
	if x != nil {
		return nil, fmt.Errorf("Could not decrypt backup (wrong password or tampered file).")
	}
	if e["sig_alg"] == "ed25519" {
		pub, _ := unb64(e["sig_pub"])
		sig, _ := unb64(e["sig"])
		msg := append(append(append([]byte("DRISHTIVAULT-BACKUP-v2:"), salt...), ':'), nonce...)
		msg = append(msg, ':')
		msg = append(msg, ct...)
		if !ed25519.Verify(pub, msg, sig) {
			return nil, fmt.Errorf("Backup signature verification failed.")
		}
	}
	var p map[string]any
	if json.Unmarshal(plain, &p) != nil {
		return nil, fmt.Errorf("Decrypted payload is not valid JSON.")
	}
	return p, nil
}
func (s *Server) restorePreview(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	if e := r.ParseMultipartForm(64 << 20); e != nil {
		problem(w, 400, "Invalid upload.")
		return
	}
	if !s.verifyMaster(ss, r.FormValue("master_password")) {
		problem(w, 401, "Master password incorrect.")
		return
	}
	f, _, e := r.FormFile("file")
	if e != nil {
		problem(w, 400, "Backup file required.")
		return
	}
	defer f.Close()
	data, e := io.ReadAll(io.LimitReader(f, 64<<20))
	if e != nil {
		internal(w, e)
		return
	}
	p, e := decryptEnvelope(data, r.FormValue("backup_password"))
	if e != nil {
		problem(w, 400, e.Error())
		return
	}
	tokenBytes, _ := vcrypto.GenSalt(24)
	token := base64.RawURLEncoding.EncodeToString(tokenBytes)
	restoreStages.Lock()
	restoreStages.m[token] = stagedPayload{Owner: ss.ID, Payload: p, Expires: time.Now().Add(10 * time.Minute)}
	restoreStages.Unlock()
	counts := map[string]int{}
	tables, _ := p["tables"].(map[string]any)
	for _, t := range []string{"sites", "assets", "credentials", "network_reference", "change_log", "audit_log", "notes"} {
		if block, ok := tables[t].(map[string]any); ok {
			if rows, ok := block["rows"].([]any); ok {
				counts[t] = len(rows)
			}
		}
	}
	meta := map[string]any{"backup_created_at": p["backup_created_at"], "backup_version": p["backup_version"], "schema_version": p["schema_version"], "counts": counts, "will_replace": true}
	jsonOut(w, 200, map[string]any{"token": token, "meta": meta})
}
func (s *Server) restoreCommit(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	var b struct {
		Master string `json:"master_password"`
		Token  string `json:"token"`
		Mode   string `json:"mode"`
	}
	if !decode(w, r, &b) {
		return
	}
	if !s.verifyMaster(ss, b.Master) {
		problem(w, 401, "Master password incorrect.")
		return
	}
	restoreStages.Lock()
	st, ok := restoreStages.m[b.Token]
	if ok {
		delete(restoreStages.m, b.Token)
	}
	restoreStages.Unlock()
	if !ok || st.Owner != ss.ID || time.Now().After(st.Expires) {
		problem(w, 410, "Restore preview expired. Please restart the restore flow.")
		return
	}
	if b.Mode != "replace" && b.Mode != "merge" {
		problem(w, 400, "Invalid restore mode.")
		return
	}
	if b.Mode == "merge" {
		applied, err := s.applyMergeRestore(st.Payload, ss.UserID)
		if err != nil {
			internal(w, err)
			return
		}
		_, _ = s.db.Exec("INSERT INTO backup_events(event_ts,kind,success,actor,detail) VALUES(?,'restore_merge',1,?,?)",
			database.Now(), ss.Username, fmt.Sprint(applied))
		database.Audit(s.db, ss.Username, "backup.restore_merge", "", nil, fmt.Sprint(applied), clientIP(r))
		jsonOut(w, 200, map[string]any{"applied": applied, "mode": "merge", "locked": false, "message": "Merge import complete."})
		return
	}
	tables, _ := st.Payload["tables"].(map[string]any)
	tx, e := s.db.Begin()
	if e != nil {
		internal(w, e)
		return
	}
	defer tx.Rollback()
	for i := len(backupTables) - 1; i >= 0; i-- {
		_, _ = tx.Exec("DELETE FROM " + backupTables[i])
	}
	applied := map[string]int{}
	for _, t := range backupTables {
		block, ok := tables[t].(map[string]any)
		if !ok {
			continue
		}
		colsRaw, _ := block["columns"].([]any)
		cols := make([]string, len(colsRaw))
		for i, v := range colsRaw {
			cols[i] = str(v)
		}
		rows, _ := block["rows"].([]any)
		ph := strings.TrimSuffix(strings.Repeat("?,", len(cols)), ",")
		for _, rv := range rows {
			m, _ := rv.(map[string]any)
			vals := make([]any, len(cols))
			for i, c := range cols {
				v := m[c]
				if z, ok := v.(map[string]any); ok && z["__b64__"] != nil {
					v, _ = unb64(z["__b64__"])
				}
				vals[i] = v
			}
			if _, e = tx.Exec("INSERT INTO "+t+"("+strings.Join(cols, ",")+") VALUES("+ph+")", vals...); e != nil {
				internal(w, e)
				return
			}
			applied[t]++
		}
	}
	if e = tx.Commit(); e != nil {
		internal(w, e)
		return
	}
	s.sessions.Lock(ss.ID)
	jsonOut(w, 200, map[string]any{"applied": applied, "mode": "replace", "locked": true, "message": "Restore complete. Re-enter the master password."})
}

func payloadRows(payload map[string]any, table string) []map[string]any {
	tables, _ := payload["tables"].(map[string]any)
	block, _ := tables[table].(map[string]any)
	raw, _ := block["rows"].([]any)
	out := make([]map[string]any, 0, len(raw))
	for _, v := range raw {
		if m, ok := v.(map[string]any); ok {
			out = append(out, m)
		}
	}
	return out
}
func backupValue(v any) any {
	if m, ok := v.(map[string]any); ok && m["__b64__"] != nil {
		b, _ := unb64(m["__b64__"])
		return b
	}
	return v
}
func (s *Server) applyMergeRestore(payload map[string]any, noteOwner int64) (map[string]int, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	applied := map[string]int{"sites": 0, "assets": 0, "credentials": 0, "network_reference": 0, "change_log": 0, "audit_log": 0, "notes": 0}
	siteMap, assetMap := map[int64]int64{}, map[int64]int64{}
	for _, m := range payloadRows(payload, "sites") {
		name := str(m["name"])
		if name == "" {
			continue
		}
		var id int64
		if tx.QueryRow("SELECT id FROM sites WHERE name=?", name).Scan(&id) == nil {
			siteMap[toInt64(m["id"])] = id
			continue
		}
		res, e := tx.Exec(`INSERT INTO sites(name,plant_code,location,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`,
			name, m["plant_code"], m["location"], defaultStr(m["status"], "Active"), m["notes"], m["created_at"], m["updated_at"])
		if e != nil {
			return nil, e
		}
		id, _ = res.LastInsertId()
		siteMap[toInt64(m["id"])] = id
		applied["sites"]++
	}
	for _, m := range payloadRows(payload, "assets") {
		var sid any
		if old := toInt64(m["site_id"]); old > 0 {
			sid = siteMap[old]
		}
		res, e := tx.Exec(`INSERT INTO assets(site_id,app_vm_name,asset_type,vm_id,hostname,ip_address,web_url_enc,environment,os_info,owner,status,notes_enc,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			sid, m["app_vm_name"], defaultStr(m["asset_type"], "Other"), m["vm_id"], m["hostname"], m["ip_address"], m["web_url_enc"], m["environment"], m["os_info"], m["owner"], defaultStr(m["status"], "Active"), m["notes_enc"], m["created_at"], m["updated_at"])
		if e != nil {
			return nil, e
		}
		id, _ := res.LastInsertId()
		assetMap[toInt64(m["id"])] = id
		applied["assets"]++
	}
	for _, m := range payloadRows(payload, "credentials") {
		var sid, aid any
		if x := toInt64(m["site_id"]); x > 0 {
			sid = siteMap[x]
		}
		if x := toInt64(m["asset_id"]); x > 0 {
			aid = assetMap[x]
		}
		_, e := tx.Exec(`INSERT INTO credentials(title,site_id,asset_id,cred_type,username_enc,password_enc,url_host_enc,port,rotation_due,status,notes_enc,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			m["title"], sid, aid, m["cred_type"], m["username_enc"], m["password_enc"], m["url_host_enc"], m["port"], m["rotation_due"], defaultStr(m["status"], "Active"), m["notes_enc"], m["created_at"], m["updated_at"])
		if e != nil {
			return nil, e
		}
		applied["credentials"]++
	}
	for _, m := range payloadRows(payload, "network_reference") {
		var sid any
		if x := toInt64(m["site_id"]); x > 0 {
			sid = siteMap[x]
		}
		_, e := tx.Exec(`INSERT INTO network_reference(site_id,vlan_id,vlan_name,subnet,gateway,dhcp_scope,dns_servers,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`, sid, m["vlan_id"], m["vlan_name"], m["subnet"], m["gateway"], m["dhcp_scope"], m["dns_servers"], m["notes"], m["created_at"], m["updated_at"])
		if e != nil {
			return nil, e
		}
		applied["network_reference"]++
	}
	for _, m := range payloadRows(payload, "change_log") {
		var sid, aid any
		if x := toInt64(m["site_id"]); x > 0 {
			sid = siteMap[x]
		}
		if x := toInt64(m["asset_id"]); x > 0 {
			aid = assetMap[x]
		}
		_, e := tx.Exec(`INSERT INTO change_log(event_date,site_id,asset_id,asset_name,field_changed,changed_by,reason_ticket,approved_by,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`, m["event_date"], sid, aid, m["asset_name"], m["field_changed"], m["changed_by"], m["reason_ticket"], m["approved_by"], m["notes"], m["created_at"])
		if e != nil {
			return nil, e
		}
		applied["change_log"]++
	}
	for _, m := range payloadRows(payload, "audit_log") {
		_, e := tx.Exec(`INSERT INTO audit_log(event_ts,actor,action,target_type,target_id,detail,source_ip) VALUES(?,?,?,?,?,?,?)`, m["event_ts"], m["actor"], m["action"], m["target_type"], m["target_id"], m["detail"], m["source_ip"])
		if e != nil {
			return nil, e
		}
		applied["audit_log"]++
	}
	for _, m := range payloadRows(payload, "notes") {
		_, e := tx.Exec(`INSERT INTO notes(title_enc,body_enc,tags_enc,color,pinned,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
			m["title_enc"], m["body_enc"], m["tags_enc"], m["color"], m["pinned"], noteOwner, m["created_at"], m["updated_at"])
		if e != nil {
			return nil, e
		}
		applied["notes"]++
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return applied, nil
}
func (s *Server) backupHistory(w http.ResponseWriter, r *http.Request, _ *sessions.Session) {
	limit := clamp(queryInt(r, "limit", 50), 1, 200)
	rows, e := queryMaps(s.db, "SELECT id,event_ts,kind,success,filename,actor,detail FROM backup_events ORDER BY id DESC LIMIT ?", limit)
	if e != nil {
		internal(w, e)
		return
	}
	jsonOut(w, 200, map[string]any{"items": rows})
}
func (s *Server) backupLast(w http.ResponseWriter, _ *http.Request, _ *sessions.Session) {
	var ex, rs any
	var x string
	if s.db.QueryRow("SELECT event_ts FROM backup_events WHERE success=1 AND kind='export' ORDER BY id DESC LIMIT 1").Scan(&x) == nil {
		ex = x
	}
	x = ""
	if s.db.QueryRow("SELECT event_ts FROM backup_events WHERE success=1 AND kind LIKE 'restore%' ORDER BY id DESC LIMIT 1").Scan(&x) == nil {
		rs = x
	}
	jsonOut(w, 200, map[string]any{"last_export": ex, "last_restore": rs, "restore_lockout_active": false, "restore_lockout_seconds": 0})
}

type csvDef struct {
	Name                     string
	Header, Required, Secret []string
}

var csvDefs = map[string]csvDef{
	"sites":       {"sites", []string{"name", "plant_code", "location", "status", "notes"}, []string{"name"}, nil},
	"assets":      {"assets", []string{"site_name", "app_vm_name", "asset_type", "vm_id", "hostname", "ip_address", "web_url", "environment", "os_info", "owner", "status", "notes"}, []string{"app_vm_name"}, []string{"web_url", "notes"}},
	"credentials": {"credentials", []string{"title", "site_name", "asset_name", "cred_type", "username", "password", "url_host", "port", "rotation_due", "status", "notes"}, []string{"title"}, []string{"username", "password", "url_host", "notes"}},
	"network":     {"network", []string{"site_name", "vlan_id", "vlan_name", "subnet", "gateway", "dhcp_scope", "dns_servers", "notes"}, nil, nil},
	"changelog":   {"changelog", []string{"event_date", "site_name", "asset_name", "field_changed", "changed_by", "reason_ticket", "approved_by", "notes"}, nil, nil},
}

func (s *Server) csvTables(w http.ResponseWriter, _ *http.Request, _ *sessions.Session) {
	items := []map[string]any{}
	for _, k := range []string{"sites", "assets", "credentials", "network", "changelog"} {
		d := csvDefs[k]
		items = append(items, map[string]any{"table": d.Name, "columns": d.Header, "required": d.Required, "secret": d.Secret})
	}
	jsonOut(w, 200, map[string]any{"tables": items})
}
func (s *Server) csvTemplate(w http.ResponseWriter, r *http.Request, _ *sessions.Session) {
	d, ok := csvDefs[r.PathValue("table")]
	if !ok {
		problem(w, 404, "No template for table.")
		return
	}
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="drishtivault-`+d.Name+`-template.csv"`)
	cw := csv.NewWriter(w)
	_ = cw.Write(d.Header)
	cw.Flush()
}
func readCSVUpload(w http.ResponseWriter, r *http.Request) ([][]string, error) {
	if e := r.ParseMultipartForm(32 << 20); e != nil {
		return nil, e
	}
	f, _, e := r.FormFile("file")
	if e != nil {
		return nil, e
	}
	defer f.Close()
	return csv.NewReader(io.LimitReader(f, 32<<20)).ReadAll()
}
func detectCSV(rows [][]string) (csvDef, bool) {
	if len(rows) == 0 {
		return csvDef{}, false
	}
	head := strings.Join(rows[0], ",")
	for _, d := range csvDefs {
		if strings.Join(d.Header, ",") == head {
			return d, true
		}
	}
	return csvDef{}, false
}
func (s *Server) csvPreview(w http.ResponseWriter, r *http.Request, _ *sessions.Session) {
	rows, e := readCSVUpload(w, r)
	if e != nil {
		problem(w, 400, "Invalid CSV.")
		return
	}
	d, ok := detectCSV(rows)
	if !ok {
		problem(w, 422, "Could not detect a known table from the CSV headers.")
		return
	}
	out := []map[string]any{}
	valid := 0
	for i, row := range rows[1:] {
		m := map[string]any{}
		errs := []string{}
		for j, h := range d.Header {
			v := ""
			if j < len(row) {
				v = row[j]
			}
			secret := false
			for _, x := range d.Secret {
				if x == h {
					secret = true
				}
			}
			if secret && v != "" {
				m[h] = "••••"
			} else {
				m[h] = v
			}
		}
		for _, req := range d.Required {
			if str(m[req]) == "" {
				errs = append(errs, req+" is required")
			}
		}
		if len(errs) == 0 {
			valid++
		}
		out = append(out, map[string]any{"row": i + 2, "ok": len(errs) == 0, "errors": errs, "data": m, "has_secrets": len(d.Secret) > 0})
	}
	jsonOut(w, 200, map[string]any{"table": d.Name, "header": d.Header, "rows": out, "counts": map[string]int{"total": len(out), "valid": valid, "invalid": len(out) - valid}, "secret_columns": d.Secret})
}
func (s *Server) csvCommit(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	rows, e := readCSVUpload(w, r)
	if e != nil {
		problem(w, 400, "Invalid CSV.")
		return
	}
	d, ok := detectCSV(rows)
	if !ok || r.FormValue("table") != d.Name {
		problem(w, 400, "CSV does not match the selected table.")
		return
	}
	inserted := 0
	errs := []map[string]any{}
	for i, row := range rows[1:] {
		m := map[string]any{}
		for j, h := range d.Header {
			if j < len(row) {
				m[h] = row[j]
			}
		}
		if e = s.insertCSV(d.Name, m, ss); e != nil {
			errs = append(errs, map[string]any{"row": i + 2, "error": e.Error()})
			continue
		}
		inserted++
	}
	database.Audit(s.db, ss.Username, "csv.import", "", nil, "table="+d.Name+" inserted="+strconv.Itoa(inserted), clientIP(r))
	jsonOut(w, 200, map[string]any{"table": d.Name, "inserted": inserted, "skipped": len(errs), "errors": errs})
}
func (s *Server) insertCSV(table string, m map[string]any, ss *sessions.Session) error {
	siteID := any(nil)
	if name := str(m["site_name"]); name != "" {
		if e := s.db.QueryRow("SELECT id FROM sites WHERE name=?", name).Scan(&siteID); e != nil {
			return fmt.Errorf("unknown site %q", name)
		}
	}
	assetID := any(nil)
	if name := str(m["asset_name"]); name != "" {
		_ = s.db.QueryRow("SELECT id FROM assets WHERE app_vm_name=?", name).Scan(&assetID)
	}
	now := database.Now()
	switch table {
	case "sites":
		_, e := s.db.Exec("INSERT INTO sites(name,plant_code,location,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)", m["name"], m["plant_code"], m["location"], defaultStr(m["status"], "Active"), m["notes"], now, now)
		return e
	case "assets":
		web, _ := enc(ss.DEK, m["web_url"])
		notes, _ := enc(ss.DEK, m["notes"])
		_, e := s.db.Exec(`INSERT INTO assets(site_id,app_vm_name,asset_type,vm_id,hostname,ip_address,web_url_enc,environment,os_info,owner,status,notes_enc,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, siteID, m["app_vm_name"], defaultStr(m["asset_type"], "Other"), m["vm_id"], m["hostname"], m["ip_address"], web, m["environment"], m["os_info"], m["owner"], defaultStr(m["status"], "Active"), notes, now, now)
		return e
	case "credentials":
		u, _ := enc(ss.DEK, m["username"])
		p, _ := enc(ss.DEK, m["password"])
		url, _ := enc(ss.DEK, m["url_host"])
		notes, _ := enc(ss.DEK, m["notes"])
		_, e := s.db.Exec(`INSERT INTO credentials(title,site_id,asset_id,cred_type,username_enc,password_enc,url_host_enc,port,rotation_due,status,notes_enc,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, m["title"], siteID, assetID, defaultStr(m["cred_type"], "Other"), u, p, url, nil, m["rotation_due"], defaultStr(m["status"], "Active"), notes, now, now)
		return e
	case "network":
		_, e := s.db.Exec(`INSERT INTO network_reference(site_id,vlan_id,vlan_name,subnet,gateway,dhcp_scope,dns_servers,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
			siteID, m["vlan_id"], m["vlan_name"], m["subnet"], m["gateway"], m["dhcp_scope"], m["dns_servers"], m["notes"], now, now)
		return e
	case "changelog":
		_, e := s.db.Exec(`INSERT INTO change_log(event_date,site_id,asset_id,asset_name,field_changed,changed_by,reason_ticket,approved_by,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
			m["event_date"], siteID, assetID, m["asset_name"], m["field_changed"], m["changed_by"], m["reason_ticket"], m["approved_by"], m["notes"], now)
		return e
	}
	return fmt.Errorf("table import not implemented")
}
