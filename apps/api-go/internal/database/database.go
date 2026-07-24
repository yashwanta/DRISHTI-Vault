package database

import (
	"database/sql"
	"fmt"
	"time"
)

func Open(path string) (*sql.DB, error) {
	db, err := sql.Open(driverName, path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	for _, q := range []string{
		"PRAGMA journal_mode=WAL", "PRAGMA foreign_keys=ON",
		"PRAGMA synchronous=NORMAL", "PRAGMA busy_timeout=5000",
	} {
		if _, err = db.Exec(q); err != nil {
			db.Close()
			return nil, err
		}
	}
	if err = initSchema(db); err != nil {
		db.Close()
		return nil, err
	}
	if err = seedSampleData(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func seedSampleData(db *sql.DB) error {
	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM sites").Scan(&n); err != nil || n > 0 {
		return err
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := Now()
	type site struct{ name, code, location, notes string }
	sites := []site{
		{"Springfield", "SPR", "Springfield, USA", "AMR deployment live — sample data"},
		{"Hopkinsville", "HOP", "Hopkinsville, KY, USA", "AP-565 on VLAN 28 / mreWireless — sample data"},
	}
	ids := map[string]int64{}
	for _, v := range sites {
		res, e := tx.Exec("INSERT INTO sites(name,plant_code,location,status,notes,created_at,updated_at) VALUES(?,?,?,'Active',?,?,?)",
			v.name, v.code, v.location, v.notes, now, now)
		if e != nil {
			return e
		}
		ids[v.name], _ = res.LastInsertId()
	}
	assets := []struct{ name, kind string }{
		{"ShingoEdge", "Ubuntu Server"}, {"PVE (Proxmox Host)", "Proxmox Host"},
		{"ShingoCore", "ShingoCore"}, {"Kafka/Warlink", "Ubuntu Server"},
		{"FleetManager", "FleetManager"}, {"RDS Core", "RDS Core"}, {"PostgreSQL", "Database"}, {"AMRFlight", "Ubuntu Server"},
	}
	for siteName, sid := range ids {
		list := assets
		if siteName == "Hopkinsville" {
			list = append(append([]struct{ name, kind string }{}, assets...), struct{ name, kind string }{"Aruba AP-565 Controller", "Aruba AP"})
		}
		for _, a := range list {
			if _, e := tx.Exec(`INSERT INTO assets(site_id,app_vm_name,asset_type,vm_id,hostname,ip_address,web_url_enc,environment,os_info,owner,status,notes_enc,created_at,updated_at)
				VALUES(?,?,?,'','','','','Prod','','IT','Active','',?,?)`, sid, a.name, a.kind, now, now); e != nil {
				return e
			}
		}
	}
	for _, v := range [][2]string{{"10", "Office / Management"}, {"28", "mreWireless"}, {"193", "AMR VLAN"}, {"", "Hikrobot RDS"}} {
		if _, e := tx.Exec(`INSERT INTO network_reference(vlan_id,vlan_name,notes,created_at,updated_at) VALUES(?,?,?,?,?)`, v[0], v[1], "Sample data", now, now); e != nil {
			return e
		}
	}
	_, err = tx.Exec(`INSERT INTO change_log(event_date,asset_name,field_changed,changed_by,reason_ticket,approved_by,notes,created_at)
		VALUES(?, '(vault)','Init','system','Initial seed','system','DRISHTI-Vault initialized with sample data',?)`, now[:10], now)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func Now() string { return time.Now().Format("2006-01-02T15:04:05") }

func Audit(db *sql.DB, actor, action, targetType string, targetID any, detail, ip string) {
	_, _ = db.Exec(`INSERT INTO audit_log(event_ts,actor,action,target_type,target_id,detail,source_ip)
		VALUES(?,?,?,?,?,?,?)`, Now(), null(actor), action, null(targetType), targetID, null(detail), ip)
}
func null(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func initSchema(db *sql.DB) error {
	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("initialize schema: %w", err)
	}
	_, err := db.Exec(`INSERT INTO vault_settings(key,value) VALUES('schema_version','4')
		ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
	return err
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, verifier TEXT NOT NULL,
 kdf_salt BLOB NOT NULL, wrapped_dek BLOB NOT NULL, created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'global_admin',
 full_name TEXT, active INTEGER NOT NULL DEFAULT 1, must_change_pw INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sites (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, plant_code TEXT, location TEXT,
 status TEXT NOT NULL DEFAULT 'Active', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_sites (
 user_id INTEGER NOT NULL, site_id INTEGER NOT NULL, PRIMARY KEY(user_id,site_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS assets (
 id INTEGER PRIMARY KEY, site_id INTEGER, app_vm_name TEXT NOT NULL, asset_type TEXT NOT NULL,
 vm_id TEXT, hostname TEXT, ip_address TEXT, web_url_enc TEXT, environment TEXT, os_info TEXT,
 owner TEXT, status TEXT NOT NULL DEFAULT 'Active', notes_enc TEXT, created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL, FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS credentials (
 id INTEGER PRIMARY KEY, title TEXT NOT NULL, site_id INTEGER, asset_id INTEGER,
 cred_type TEXT NOT NULL, username_enc TEXT, password_enc TEXT, url_host_enc TEXT,
 port INTEGER, rotation_due TEXT, status TEXT NOT NULL DEFAULT 'Active', notes_enc TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE SET NULL,
 FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS network_reference (
 id INTEGER PRIMARY KEY, site_id INTEGER, vlan_id TEXT, vlan_name TEXT, subnet TEXT,
 gateway TEXT, dhcp_scope TEXT, dns_servers TEXT, notes TEXT, created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL, FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS change_log (
 id INTEGER PRIMARY KEY, event_date TEXT, site_id INTEGER, asset_id INTEGER, asset_name TEXT,
 field_changed TEXT, changed_by TEXT, reason_ticket TEXT, approved_by TEXT, notes TEXT,
 created_at TEXT NOT NULL, FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE SET NULL,
 FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS audit_log (
 id INTEGER PRIMARY KEY, event_ts TEXT NOT NULL, actor TEXT, action TEXT NOT NULL,
 target_type TEXT, target_id INTEGER, detail TEXT, source_ip TEXT);
CREATE TABLE IF NOT EXISTS vault_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS backup_events (
 id INTEGER PRIMARY KEY, event_ts TEXT NOT NULL, kind TEXT NOT NULL, success INTEGER NOT NULL,
 filename TEXT, actor TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS notes (
 id INTEGER PRIMARY KEY, title_enc TEXT NOT NULL, body_enc TEXT NOT NULL, tags_enc TEXT,
 color TEXT NOT NULL DEFAULT '', pinned INTEGER NOT NULL DEFAULT 0, owner_id INTEGER NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE);`
