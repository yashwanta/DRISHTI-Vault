package config

import (
	"os"
	"path/filepath"
	"strconv"
)

type Config struct {
	Host, Port, DBPath, DataDir, BackupDir, LogDir, WebDist, SessionCookie string
	IdleMinutes, ClipboardTTL, RevealTTL                                   int
}

func Load() Config {
	root := env("DRISHTIVAULT_ROOT", findRoot())
	data := env("DRISHTIVAULT_DATA_DIR", filepath.Join(root, "data"))
	return Config{
		Host:          env("DRISHTIVAULT_HOST", "127.0.0.1"),
		Port:          env("DRISHTIVAULT_PORT", "7788"),
		DBPath:        env("DRISHTIVAULT_DB_PATH", filepath.Join(data, "drishtivault.db")),
		DataDir:       data,
		BackupDir:     env("DRISHTIVAULT_BACKUP_DIR", filepath.Join(root, "backups", "encrypted")),
		LogDir:        env("DRISHTIVAULT_LOG_DIR", filepath.Join(root, "logs")),
		WebDist:       env("DRISHTIVAULT_WEB_DIST", filepath.Join(root, "apps", "web", "dist")),
		SessionCookie: env("DRISHTIVAULT_SESSION_COOKIE", "drishtivault_session"),
		IdleMinutes:   envInt("DRISHTIVAULT_IDLE_LOCK_MINUTES", 15),
		ClipboardTTL:  envInt("DRISHTIVAULT_CLIPBOARD_TTL", 30),
		RevealTTL:     envInt("DRISHTIVAULT_REVEAL_TTL", 120),
	}
}

func (c Config) EnsureDirs() error {
	for _, p := range []string{c.DataDir, c.BackupDir, c.LogDir} {
		if err := os.MkdirAll(p, 0700); err != nil {
			return err
		}
	}
	return nil
}

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func envInt(k string, d int) int {
	v, e := strconv.Atoi(os.Getenv(k))
	if e == nil && v > 0 {
		return v
	}
	return d
}
func findRoot() string {
	wd, _ := os.Getwd()
	for p := wd; ; p = filepath.Dir(p) {
		if _, err := os.Stat(filepath.Join(p, "apps", "web")); err == nil {
			return p
		}
		if filepath.Dir(p) == p {
			return wd
		}
	}
}
