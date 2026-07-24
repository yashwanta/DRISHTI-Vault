package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/yashwanta/drishti-vault/api-go/internal/config"
	"github.com/yashwanta/drishti-vault/api-go/internal/database"
	"github.com/yashwanta/drishti-vault/api-go/internal/server"
)

func main() {
	cfg := config.Load()
	if cfg.Host != "127.0.0.1" && cfg.Host != "localhost" && os.Getenv("DRISHTIVAULT_ALLOW_CONTAINER_BIND") != "1" {
		log.Fatalf("refusing non-local bind %q", cfg.Host)
	}
	if err := cfg.EnsureDirs(); err != nil {
		log.Fatal(err)
	}
	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	addr := cfg.Host + ":" + cfg.Port
	log.Printf("DRISHTI-Vault Go server listening on http://%s", addr)
	s := &http.Server{Addr: addr, Handler: server.New(cfg, db).Handler(), ReadHeaderTimeout: 5e9, IdleTimeout: 60e9}
	if err = s.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(fmt.Errorf("serve: %w", err))
	}
}
