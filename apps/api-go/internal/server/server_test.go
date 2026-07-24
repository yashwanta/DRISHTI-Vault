package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/yashwanta/drishti-vault/api-go/internal/config"
	"github.com/yashwanta/drishti-vault/api-go/internal/database"
)

func TestCoreAPIFlow(t *testing.T) {
	tmp := t.TempDir()
	cfg := config.Config{Host: "127.0.0.1", Port: "7788", DBPath: filepath.Join(tmp, "vault.db"),
		DataDir: tmp, BackupDir: filepath.Join(tmp, "backups"), LogDir: filepath.Join(tmp, "logs"),
		WebDist: filepath.Join(tmp, "dist"), SessionCookie: "drishtivault_session",
		IdleMinutes: 15, ClipboardTTL: 30, RevealTTL: 120}
	if err := cfg.EnsureDirs(); err != nil {
		t.Fatal(err)
	}
	db, err := database.Open(cfg.DBPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ts := httptest.NewServer(New(cfg, db).Handler())
	defer ts.Close()
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar}
	call := func(method, path string, body any) (*http.Response, map[string]any) {
		var raw []byte
		if body != nil {
			raw, _ = json.Marshal(body)
		}
		req, _ := http.NewRequest(method, ts.URL+path, bytes.NewReader(raw))
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		res, e := client.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		var out map[string]any
		_ = json.NewDecoder(res.Body).Decode(&out)
		res.Body.Close()
		return res, out
	}
	res, b := call("GET", "/api/bootstrap", nil)
	if res.StatusCode != 200 || b["initialized"] != false {
		t.Fatalf("bootstrap: %d %#v", res.StatusCode, b)
	}
	res, _ = call("POST", "/api/setup", map[string]any{"username": "admin", "master_password": "correct horse battery staple"})
	if res.StatusCode != 400 {
		t.Fatalf("non-Yash setup status %d", res.StatusCode)
	}
	res, _ = call("POST", "/api/setup", map[string]any{"username": "Yash", "master_password": "correct horse battery staple"})
	if res.StatusCode != 200 {
		t.Fatalf("setup status %d", res.StatusCode)
	}
	res, _ = call("POST", "/api/login", map[string]any{"username": "Yash", "master_password": "correct horse battery staple"})
	if res.StatusCode != 200 {
		t.Fatalf("login status %d", res.StatusCode)
	}
	res, b = call("POST", "/api/sites", map[string]any{"name": "Test Plant", "status": "Active"})
	if res.StatusCode != 200 {
		t.Fatalf("site status %d %#v", res.StatusCode, b)
	}
	siteID := b["id"]
	res, b = call("POST", "/api/credentials", map[string]any{"title": "PVE root", "site_id": siteID, "cred_type": "Proxmox Login", "username": "root@pam", "password": "secret-value", "status": "Active"})
	if res.StatusCode != 200 {
		t.Fatalf("credential status %d %#v", res.StatusCode, b)
	}
	cid := b["id"]
	res, _ = call("GET", "/api/credentials/"+itoa(cid)+"/view", nil)
	if res.StatusCode != 403 {
		t.Fatalf("view before reveal %d", res.StatusCode)
	}
	res, _ = call("POST", "/api/reveal", map[string]any{"master_password": "correct horse battery staple"})
	if res.StatusCode != 200 {
		t.Fatalf("reveal %d", res.StatusCode)
	}
	res, b = call("GET", "/api/credentials/"+itoa(cid)+"/view", nil)
	if res.StatusCode != 200 || b["password"] != "secret-value" {
		t.Fatalf("view: %d %#v", res.StatusCode, b)
	}
	res, b = call("POST", "/api/notes", map[string]any{"title": "Encrypted", "body": "note body", "tags": []string{"ops"}, "color": "blue"})
	if res.StatusCode != 200 {
		t.Fatalf("note: %d %#v", res.StatusCode, b)
	}
	res, b = call("GET", "/api/notes", nil)
	if res.StatusCode != 200 {
		t.Fatalf("notes: %d %#v", res.StatusCode, b)
	}
}
func itoa(v any) string {
	if x, ok := v.(float64); ok {
		return fmt.Sprintf("%.0f", x)
	}
	return fmt.Sprint(v)
}
