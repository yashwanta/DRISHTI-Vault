"""DRISHTI-Vault configuration.

No secrets are read from the environment or from .env files.
Only operational knobs (host/port/paths/timers) come from the environment.
"""
from __future__ import annotations

import os
from pathlib import Path

# Project root = .../DRISHTI-Vault  (apps/api/app/config.py -> 3 levels up)
PROJECT_ROOT = Path(__file__).resolve().parents[3]

DATA_DIR = Path(os.getenv("DRISHTIVAULT_DATA_DIR", PROJECT_ROOT / "data"))
BACKUP_DIR = Path(os.getenv("DRISHTIVAULT_BACKUP_DIR", PROJECT_ROOT / "backups" / "encrypted"))
LOG_DIR = Path(os.getenv("DRISHTIVAULT_LOG_DIR", PROJECT_ROOT / "logs"))

DB_PATH = Path(os.getenv("DRISHTIVAULT_DB_PATH", DATA_DIR / "drishtivault.db"))

HOST = os.getenv("DRISHTIVAULT_HOST", "127.0.0.1")  # NEVER 0.0.0.0
PORT = int(os.getenv("DRISHTIVAULT_PORT", "7788"))

SESSION_COOKIE = os.getenv("DRISHTIVAULT_SESSION_COOKIE", "drishtivault_session")

IDLE_LOCK_MINUTES = int(os.getenv("DRISHTIVAULT_IDLE_LOCK_MINUTES", "15"))
CLIPBOARD_TTL = int(os.getenv("DRISHTIVAULT_CLIPBOARD_TTL", "30"))
REVEAL_TTL = int(os.getenv("DRISHTIVAULT_REVEAL_TTL", "120"))

# Static frontend (built React SPA) served by the API at "/"
WEB_DIST = PROJECT_ROOT / "apps" / "web" / "dist"

# Marker file for filesystem lockout (created on every app start, checked
# before binding). Not security-critical; the bind address is the real guard.
LOCKFILE = DATA_DIR / ".lock"


def ensure_dirs() -> None:
    for d in (DATA_DIR, BACKUP_DIR, LOG_DIR):
        d.mkdir(parents=True, exist_ok=True)
