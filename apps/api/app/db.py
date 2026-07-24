"""SQLite schema + connection management for DRISHTI-Vault.

Schema versioned via vault_settings.key='schema_version'.
"""
from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from typing import Iterator

from . import config

SCHEMA_VERSION = "4"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    verifier        TEXT NOT NULL,            -- Argon2id PHC string of master password
    kdf_salt        BLOB NOT NULL,            -- salt for KEK derivation (NOT the verifier salt)
    wrapped_dek     BLOB NOT NULL,            -- AES-256-GCM(KEK, DEK)
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    -- RBAC (schema v3):
    role            TEXT NOT NULL DEFAULT 'global_admin',  -- super_admin | global_admin | location_admin
    full_name       TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    must_change_pw  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sites (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    plant_code      TEXT,
    location        TEXT,
    status          TEXT NOT NULL DEFAULT 'Active',
    notes           TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    UNIQUE(name)
);

-- RBAC: which sites a location_admin may see (schema v3)
CREATE TABLE IF NOT EXISTS user_sites (
    user_id         INTEGER NOT NULL,
    site_id         INTEGER NOT NULL,
    PRIMARY KEY (user_id, site_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assets (
    id              INTEGER PRIMARY KEY,
    site_id         INTEGER,
    app_vm_name     TEXT NOT NULL,
    asset_type      TEXT NOT NULL,
    vm_id           TEXT,
    hostname        TEXT,
    ip_address      TEXT,
    web_url_enc     TEXT,                     -- encrypted (sensitive)
    environment     TEXT,
    os_info         TEXT,
    owner           TEXT,
    status          TEXT NOT NULL DEFAULT 'Active',
    notes_enc       TEXT,                     -- encrypted (sensitive)
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS credentials (
    id              INTEGER PRIMARY KEY,
    title           TEXT NOT NULL,
    site_id         INTEGER,
    asset_id        INTEGER,
    cred_type       TEXT NOT NULL,
    username_enc    TEXT,                     -- encrypted
    password_enc    TEXT,                     -- encrypted
    url_host_enc    TEXT,                     -- encrypted
    port            INTEGER,
    rotation_due    TEXT,
    status          TEXT NOT NULL DEFAULT 'Active',
    notes_enc       TEXT,                     -- encrypted
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE SET NULL,
    FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS network_reference (
    id              INTEGER PRIMARY KEY,
    site_id         INTEGER,
    vlan_id         TEXT,
    vlan_name       TEXT,
    subnet          TEXT,
    gateway         TEXT,
    dhcp_scope      TEXT,
    dns_servers     TEXT,
    notes           TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS change_log (
    id              INTEGER PRIMARY KEY,
    event_date      TEXT,
    site_id         INTEGER,
    asset_id        INTEGER,
    asset_name      TEXT,
    field_changed   TEXT,
    changed_by      TEXT,
    reason_ticket   TEXT,
    approved_by     TEXT,
    notes           TEXT,
    created_at      TEXT NOT NULL,
    FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE SET NULL,
    FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id              INTEGER PRIMARY KEY,
    event_ts        TEXT NOT NULL,
    actor           TEXT,
    action          TEXT NOT NULL,            -- e.g. 'credential.view', 'asset.edit'
    target_type     TEXT,                     -- 'credential' | 'asset' | 'site' | ...
    target_id       INTEGER,
    detail          TEXT,                     -- NEVER secret values; metadata only
    source_ip       TEXT
);

CREATE TABLE IF NOT EXISTS vault_settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_events (
    id              INTEGER PRIMARY KEY,
    event_ts        TEXT NOT NULL,
    kind            TEXT NOT NULL,            -- 'export' | 'restore_replace' | 'restore_merge'
    success         INTEGER NOT NULL,         -- 1 success, 0 failure
    filename        TEXT,                     -- backup filename (no path secrets)
    actor           TEXT,
    detail          TEXT                      -- metadata only; NEVER a password/key/secret
);

-- Encrypted notes (schema v4). EVERYTHING sensitive is AES-256-GCM encrypted
-- with the session DEK: the title, body, and tags are all stored encrypted so
-- that even a user with DB-file access cannot read note contents without the
-- master password. Color/pinned/timestamps stay plaintext for sorting & display.
-- Search is therefore CLIENT-SIDE: the API returns decrypted notes only inside
-- the reveal window, and the browser does the matching.
CREATE TABLE IF NOT EXISTS notes (
    id              INTEGER PRIMARY KEY,
    title_enc       TEXT NOT NULL,            -- encrypted (sensitive)
    body_enc        TEXT NOT NULL,            -- encrypted (sensitive)
    tags_enc        TEXT,                     -- encrypted JSON array (sensitive)
    color           TEXT NOT NULL DEFAULT '', -- UI palette key, non-secret
    pinned          INTEGER NOT NULL DEFAULT 0,
    owner_id        INTEGER NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);
"""

_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(
        config.DB_PATH,
        detect_types=sqlite3.PARSE_DECLTYPES,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


_db: sqlite3.Connection | None = None


def get_db() -> sqlite3.Connection:
    global _db
    if _db is None:
        _db = _connect()
    return _db


@contextmanager
def db_cursor() -> Iterator[sqlite3.Cursor]:
    """Serialized write context. Commits on success, rolls back on error."""
    with _lock:
        conn = get_db()
        cur = conn.cursor()
        try:
            yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def init_db() -> None:
    config.ensure_dirs()
    conn = get_db()
    conn.executescript(SCHEMA)
    # Seed schema version
    conn.execute(
        "INSERT INTO vault_settings(key, value) VALUES('schema_version', ?) "
        "ON CONFLICT(key) DO NOTHING",
        (SCHEMA_VERSION,),
    )
    conn.commit()
    _migrate(conn)
    # Seed sample sites only if the sites table is empty
    cur = conn.execute("SELECT COUNT(*) AS c FROM sites")
    (count,) = cur.fetchone()
    if count == 0:
        from .seed import seed_sample_data
        seed_sample_data(conn)
    conn.commit()


_MIGRATIONS = [
    # (from_version, to_version, sql_or_callable)
]


def _add_column(conn, table: str, column: str, decl: str) -> None:
    """Add a column if it does not already exist (idempotent ALTER)."""
    cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def _migrate(conn: sqlite3.Connection) -> None:
    """Apply incremental migrations for pre-existing databases.

    Tables created with CREATE TABLE IF NOT EXISTS in SCHEMA are added
    automatically; new columns on existing tables need explicit ALTERs here.
    """
    # v3: RBAC columns on users (idempotent — safe on fresh DBs too)
    _add_column(conn, "users", "role", "TEXT NOT NULL DEFAULT 'global_admin'")
    _add_column(conn, "users", "full_name", "TEXT")
    _add_column(conn, "users", "active", "INTEGER NOT NULL DEFAULT 1")
    _add_column(conn, "users", "must_change_pw", "INTEGER NOT NULL DEFAULT 0")
    # user_sites table is created by CREATE TABLE IF NOT EXISTS in SCHEMA.
    conn.execute(
        "INSERT INTO vault_settings(key, value) VALUES('schema_version', ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (SCHEMA_VERSION,),
    )
    conn.commit()


# ---- small helpers used across routes --------------------------------------
def now_iso() -> str:
    # Local server time, ISO. (Date.now equivalent; kept simple.)
    import datetime as _dt
    return _dt.datetime.now().isoformat(timespec="seconds")
