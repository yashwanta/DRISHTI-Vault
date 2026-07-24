package server

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/yashwanta/drishti-vault/api-go/internal/database"
	"github.com/yashwanta/drishti-vault/api-go/internal/sessions"
)

type excelPreviewData struct {
	Sites     []map[string]any `json:"sites"`
	Assets    []map[string]any `json:"assets"`
	Network   []map[string]any `json:"network"`
	Changelog []map[string]any `json:"changelog"`
	Secrets   []map[string]any `json:"detected_secrets"`
	Sheets    []string         `json:"sheet_names"`
}

func norm(v string) string { return strings.TrimSpace(v) }
func headerRow(rows [][]string) int {
	best, score := 0, 0
	for i, row := range rows {
		if i >= 6 {
			break
		}
		n := 0
		for _, v := range row {
			if norm(v) != "" {
				n++
			}
		}
		if n > score {
			best, score = i, n
		}
	}
	return best
}
func cell(headers, row []string, candidates ...string) string {
	for _, c := range candidates {
		for i, h := range headers {
			h = strings.ToLower(norm(h))
			if h == c || strings.Contains(h, c) {
				if i < len(row) {
					return norm(row[i])
				}
			}
		}
	}
	return ""
}
func passwordHeader(v string) bool {
	v = strings.ToLower(norm(v))
	for _, x := range []string{"password", "passwd", "pwd", "secret", "token", "key", "pass"} {
		if strings.Contains(v, x) {
			return true
		}
	}
	return false
}
func guessAsset(v string) string {
	x := strings.ToLower(v)
	switch {
	case strings.Contains(x, "proxmox host") || strings.Contains(x, "pve"):
		return "Proxmox Host"
	case strings.Contains(x, "aruba") || strings.Contains(x, "ap-"):
		return "Aruba AP"
	case strings.Contains(x, "switch"):
		return "Switch"
	case strings.Contains(x, "shingocore"):
		return "ShingoCore"
	case strings.Contains(x, "fleet"):
		return "FleetManager"
	case strings.Contains(x, "rds"):
		return "RDS Core"
	case strings.Contains(x, "postgres") || strings.Contains(x, "database"):
		return "Database"
	}
	return "Ubuntu Server"
}
func (s *Server) excelPreview(w http.ResponseWriter, r *http.Request, _ *sessions.Session) {
	if e := r.ParseMultipartForm(64 << 20); e != nil {
		problem(w, 400, "Invalid workbook upload.")
		return
	}
	f, _, e := r.FormFile("file")
	if e != nil {
		problem(w, 400, "Workbook file required.")
		return
	}
	defer f.Close()
	data, e := io.ReadAll(io.LimitReader(f, 64<<20))
	if e != nil {
		internal(w, e)
		return
	}
	book, e := excelize.OpenReader(bytes.NewReader(data))
	if e != nil {
		problem(w, 422, "Could not read the .xlsx workbook.")
		return
	}
	defer book.Close()
	out := excelPreviewData{Sheets: book.GetSheetList(), Sites: []map[string]any{}, Assets: []map[string]any{}, Network: []map[string]any{}, Changelog: []map[string]any{}, Secrets: []map[string]any{}}
	seen := map[string]bool{}
	addSite := func(name string, extra map[string]any) {
		if name == "" || seen[name] {
			return
		}
		seen[name] = true
		m := map[string]any{"name": name, "plant_code": "", "location": "", "status": "Active", "notes": "Imported from workbook"}
		for k, v := range extra {
			m[k] = v
		}
		out.Sites = append(out.Sites, m)
	}
	for _, sheet := range out.Sheets {
		rows, e := book.GetRows(sheet)
		if e != nil || len(rows) == 0 {
			continue
		}
		hi := headerRow(rows)
		headers := rows[hi]
		lower := strings.ToLower(sheet)
		switch {
		case strings.Contains(lower, "sites index"):
			for _, row := range rows[hi+1:] {
				name := cell(headers, row, "site / plant", "site/plant", "site", "plant")
				if name != "" {
					addSite(name, map[string]any{"plant_code": cell(headers, row, "plant code", "code"), "status": defaultStr(cell(headers, row, "status"), "Active"), "notes": cell(headers, row, "notes")})
				}
			}
		case lower == "change log":
			for _, row := range rows[hi+1:] {
				if len(row) == 0 {
					continue
				}
				out.Changelog = append(out.Changelog, map[string]any{"event_date": cell(headers, row, "date"), "asset_name": cell(headers, row, "vm / application", "vm/application", "asset", "application"), "field_changed": cell(headers, row, "field changed"), "changed_by": cell(headers, row, "changed by"), "reason_ticket": cell(headers, row, "reason / ticket #", "reason / ticket", "reason", "ticket"), "approved_by": cell(headers, row, "approved by"), "notes": ""})
			}
		case lower == "network reference":
			for _, row := range rows[hi+1:] {
				if len(row) == 0 {
					continue
				}
				out.Network = append(out.Network, map[string]any{"site_name": cell(headers, row, "plant", "site"), "vlan_id": cell(headers, row, "vlan id", "vlan"), "vlan_name": cell(headers, row, "vlan name"), "subnet": cell(headers, row, "subnet"), "gateway": cell(headers, row, "gateway"), "dhcp_scope": cell(headers, row, "dhcp scope", "dhcp"), "dns_servers": cell(headers, row, "dns"), "notes": cell(headers, row, "notes")})
			}
		default:
			site := strings.TrimSpace(strings.ReplaceAll(sheet, "📋", ""))
			addSite(site, nil)
			pwCols := []int{}
			for i, h := range headers {
				if passwordHeader(h) {
					pwCols = append(pwCols, i)
				}
			}
			for _, row := range rows[hi+1:] {
				app := cell(headers, row, "application / vm name", "app / vm name", "vm name", "application", "name")
				if app == "" {
					continue
				}
				out.Assets = append(out.Assets, map[string]any{"site_name": site, "app_vm_name": app, "asset_type": guessAsset(app), "vm_id": cell(headers, row, "vm id", "id"), "hostname": "", "ip_address": cell(headers, row, "ip address", "ip", "ipaddress"), "environment": cell(headers, row, "notes / environment", "environment"), "web_url": cell(headers, row, "web url", "url"), "notes": "", "username": cell(headers, row, "username", "user")})
				for _, i := range pwCols {
					if i < len(row) && norm(row[i]) != "" {
						out.Secrets = append(out.Secrets, map[string]any{"site_name": site, "app_vm_name": app, "column_header": headers[i], "field": "password", "preview": ""})
					}
				}
			}
		}
	}
	jsonOut(w, 200, map[string]any{"sites": out.Sites, "assets": out.Assets, "network": out.Network, "changelog": out.Changelog, "detected_secrets": out.Secrets, "detected_secrets_count": len(out.Secrets), "sheet_names": out.Sheets})
}
func (s *Server) excelCommit(w http.ResponseWriter, r *http.Request, ss *sessions.Session) {
	var p excelPreviewData
	if !decode(w, r, &p) {
		return
	}
	inserted := map[string]int{"sites": 0, "assets": 0, "network": 0, "changelog": 0}
	for _, m := range p.Sites {
		name := str(m["name"])
		if name == "" {
			continue
		}
		var id int64
		if s.db.QueryRow("SELECT id FROM sites WHERE name=?", name).Scan(&id) == nil {
			continue
		}
		now := database.Now()
		if _, e := s.db.Exec("INSERT INTO sites(name,plant_code,location,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)", name, m["plant_code"], m["location"], defaultStr(m["status"], "Active"), m["notes"], now, now); e == nil {
			inserted["sites"]++
		}
	}
	for _, m := range p.Assets {
		if e := s.insertCSV("assets", m, ss); e == nil {
			inserted["assets"]++
		}
	}
	for _, m := range p.Network {
		if e := s.insertCSV("network", m, ss); e == nil {
			inserted["network"]++
		}
	}
	for _, m := range p.Changelog {
		if e := s.insertCSV("changelog", m, ss); e == nil {
			inserted["changelog"]++
		}
	}
	database.Audit(s.db, ss.Username, "excel.import", "", nil, fmt.Sprint(inserted), clientIP(r))
	jsonOut(w, 200, map[string]any{"inserted": inserted})
}
