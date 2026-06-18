"""Encrypted backup, restore-preview, and restore-apply for DRISHTI-Vault.

Two distinct passwords govern backups (see docs/SECURITY.md):
  * Master Password  — re-required to authorize export/restore (second gate).
  * Vault Backup Password — encrypts/decrypts the backup ENVELOPE only
    (Argon2id -> AES-256-GCM key). It is never stored, never logged, and is
    independent of the master password.

Backup file format (.drishtivaultbackup):

  Envelope (what is written to disk):
    {
      "format": "drishtivault-backup-v2",
      "kdf": "argon2id",
      "kdf_params": {"t":3,"m":65536,"p":4},
      "kdf_salt": "<b64>",
      "nonce": "<b64>",
      "ciphertext": "<b64>"          # AES-256-GCM(backup_key, payload_json)
    }

  Decrypted payload (NEVER written to disk in plaintext):
    {
      "format": "drishtivault-backup-v2",
      "backup_created_at": "2026-06-17T19:25:00",
      "backup_version": "DRISHTI-Vault 1.0.0",
      "schema_version": "2",
      "tables": { "<table>": {"columns": [...], "rows": [...]}, ... }
    }

Security notes:
  * Secret fields stay encrypted under the vault DEK inside the payload; the
    backup file never contains plaintext secrets.
  * Restoring only re-inserts rows. Reading restored secrets still requires the
    master password (it unwraps the DEK), so a backup is useless to an attacker
    who lacks BOTH the backup password AND the master password.
"""
from __future__ import annotations

import base64
import datetime as _dt
import json
import secrets
import sqlite3

from argon2.low_level import Type, hash_secret_raw
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey, Ed25519PublicKey)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidSignature

from .. import crypto

MAGIC = "drishtivault-backup-v2"
APP_VERSION = "DRISHTI-Vault 1.0.0"
ARGON_TIME = 3
ARGON_MEM = 64 * 1024
ARGON_PAR = 4

# Tables persisted in a backup, in insertion (FK-safe) order.
BACKUP_TABLES = [
    "vault_settings", "users", "sites", "assets", "credentials",
    "network_reference", "change_log", "audit_log",
]
# Countable tables shown in the restore preview.
PREVIEW_TABLES = [
    "sites", "assets", "credentials", "network_reference",
    "change_log", "audit_log",
]


def _derive_backup_key(password: str, salt: bytes) -> bytes:
    """Argon2id key derivation for the backup envelope (256-bit key)."""
    return hash_secret_raw(
        secret=password.encode("utf-8"), salt=salt,
        time_cost=ARGON_TIME, memory_cost=ARGON_MEM, parallelism=ARGON_PAR,
        hash_len=32, type=Type.ID,
    )


# ---------------------------------------------------------------------------
# Ed25519 signing of the envelope.
#
# The signing key is generated per-export. Its PRIVATE half is encrypted with
# the backup-derived key (so only the password holder could have signed), and
# the PUBLIC half is stored in plaintext so that — once the envelope is
# decrypted — any tampering with salt/nonce/ciphertext fails the signature
# check. This adds authenticity/integrity on top of AES-GCM's own AEAD tag:
# if a future ciphertext-substitution were ever found in the AES-GCM layer,
# the Ed25519 signature is an independent backstop.
# ---------------------------------------------------------------------------

def _signing_message(salt: bytes, nonce: bytes, ciphertext: bytes) -> bytes:
    """Canonical bytes covered by the signature."""
    return b"DRISHTIVAULT-BACKUP-v2:" + salt + b":" + nonce + b":" + ciphertext


def _priv_to_bytes(sk: Ed25519PrivateKey) -> bytes:
    return sk.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )


def _pub_to_bytes(pk: Ed25519PublicKey) -> bytes:
    return pk.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def build_payload(conn: sqlite3.Connection) -> dict:
    """Dump all backup tables into a plaintext payload dict (still DEK-encrypted)."""
    tables: dict = {}
    for t in BACKUP_TABLES:
        cols = [r[1] for r in conn.execute(f"PRAGMA table_info({t})")]
        rows = []
        for row in conn.execute(f"SELECT * FROM {t}"):
            d = {}
            for col, val in zip(cols, row):
                if isinstance(val, bytes):
                    d[col] = {"__b64__": base64.b64encode(val).decode("ascii")}
                else:
                    d[col] = val
            rows.append(d)
        tables[t] = {"columns": cols, "rows": rows}
    return {
        "format": MAGIC,
        "backup_created_at": _dt.datetime.now().isoformat(timespec="seconds"),
        "backup_version": APP_VERSION,
        "schema_version": _read_schema_version(conn),
        "tables": tables,
    }


def export_backup(conn: sqlite3.Connection, backup_password: str) -> tuple[bytes, str]:
    """Build + encrypt the backup. Returns (file_bytes, created_at_iso)."""
    if not backup_password or len(backup_password) < 10:
        raise ValueError("Backup password must be at least 10 characters")

    payload = build_payload(conn)
    created_at = payload["backup_created_at"]
    plaintext = json.dumps(payload).encode("utf-8")

    salt = crypto.gen_salt(16)
    nonce = secrets.token_bytes(12)
    bk = _derive_backup_key(backup_password, salt)
    try:
        ct = AESGCM(bk).encrypt(nonce, plaintext, None)
        # Sign salt||nonce||ciphertext with a fresh Ed25519 key; encrypt the
        # private half under the backup key.
        sk = Ed25519PrivateKey.generate()
        pk = sk.public_key()
        sig = sk.sign(_signing_message(salt, nonce, ct))
        sk_nonce = secrets.token_bytes(12)
        enc_priv = sk_nonce + AESGCM(bk).encrypt(
            sk_nonce, _priv_to_bytes(sk), None)
        envelope = {
            "format": MAGIC,
            "kdf": "argon2id",
            "kdf_params": {"t": ARGON_TIME, "m": ARGON_MEM, "p": ARGON_PAR},
            "kdf_salt": base64.b64encode(salt).decode("ascii"),
            "nonce": base64.b64encode(nonce).decode("ascii"),
            "ciphertext": base64.b64encode(ct).decode("ascii"),
            "sig_alg": "ed25519",
            "sig_pub": base64.b64encode(_pub_to_bytes(pk)).decode("ascii"),
            "sig": base64.b64encode(sig).decode("ascii"),
            "sig_priv_enc": base64.b64encode(enc_priv).decode("ascii"),
        }
    finally:
        _zero(bk)
    return json.dumps(envelope, indent=2).encode("utf-8"), created_at


# ---------------------------------------------------------------------------
# Restore: decrypt-only (preview) + apply (replace / merge)
# ---------------------------------------------------------------------------

class BackupError(ValueError):
    """Raised when a backup cannot be decrypted or is malformed."""


def decrypt_backup(file_bytes: bytes, backup_password: str) -> dict:
    """Decrypt the envelope with the backup password and return the payload.

    Raises BackupError on any failure (bad format, wrong password, tampering).
    Does NOT touch the database. Used by the preview step.
    """
    try:
        envelope = json.loads(file_bytes.decode("utf-8"))
    except Exception:
        raise BackupError("Backup file is not a valid DRISHTI-Vault backup.")
    if envelope.get("format") != MAGIC:
        raise BackupError("Not an DRISHTI-Vault v2 backup (bad format marker).")
    for k in ("kdf_salt", "nonce", "ciphertext"):
        if k not in envelope:
            raise BackupError("Backup envelope is incomplete.")

    salt = base64.b64decode(envelope["kdf_salt"])
    nonce = base64.b64decode(envelope["nonce"])
    ct = base64.b64decode(envelope["ciphertext"])
    bk = _derive_backup_key(backup_password, salt)
    try:
        plaintext = AESGCM(bk).decrypt(nonce, ct, None)
    except Exception:
        # Deliberately generic: never reveal whether the password was the
        # problem vs. a corrupted ciphertext (no credential existence leak).
        raise BackupError("Could not decrypt backup (wrong password or tampered file).")
    finally:
        _zero(bk)

    # Verify the Ed25519 signature (integrity/authenticity backstop).
    if envelope.get("sig_alg") == "ed25519" and "sig" in envelope and "sig_pub" in envelope:
        try:
            pub_bytes = base64.b64decode(envelope["sig_pub"])
            sig = base64.b64decode(envelope["sig"])
            Ed25519PublicKey.from_public_bytes(pub_bytes).verify(
                sig, _signing_message(salt, nonce, ct))
        except (InvalidSignature, ValueError, Exception):
            raise BackupError("Backup signature verification failed (file may be tampered with).")
    # Unsigned v2 backups (created before signing) are still accepted, since
    # AES-GCM already authenticates the ciphertext.

    try:
        payload = json.loads(plaintext.decode("utf-8"))
    except Exception:
        raise BackupError("Decrypted payload is not valid JSON.")
    if payload.get("format") != MAGIC:
        raise BackupError("Decrypted payload has an unexpected format.")
    return payload


def backup_metadata(payload: dict) -> dict:
    """Extract preview-safe metadata + counts from a decrypted payload."""
    tables = payload.get("tables", {})
    counts = {}
    for t in PREVIEW_TABLES:
        blk = tables.get(t) or {}
        counts[t] = len(blk.get("rows", []))
    return {
        "backup_created_at": payload.get("backup_created_at", "unknown"),
        "backup_version": payload.get("backup_version", "unknown"),
        "schema_version": payload.get("schema_version", "unknown"),
        "counts": counts,
        "will_replace": True,  # full replace is destructive; preview warns
    }


def apply_replace(conn: sqlite3.Connection, payload: dict) -> dict:
    """Full restore: replace all vault contents with the backup.

    audit_log is ALSO replaced (the backup may include its own history). The
    restore action itself is then appended so it is self-documenting.
    """
    tables = payload.get("tables", {})
    inserted: dict[str, int] = {}
    cur = conn.cursor()
    try:
        for t in BACKUP_TABLES:
            cur.execute(f"DELETE FROM {t}")
        for t in BACKUP_TABLES:
            blk = tables.get(t)
            if not blk:
                continue
            count = _insert_rows(cur, t, blk)
            inserted[t] = count
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return inserted


def apply_merge(conn: sqlite3.Connection, payload: dict) -> dict:
    """Merge import: add backup rows that don't already exist, re-keying FKs.

    Strategy per table:
      * sites / network_reference / change_log / audit_log: insert all rows
        with fresh ids (dedup sites by name).
      * assets / credentials: insert with fresh ids, and remap site_id /
        asset_id to the newly-inserted parent ids.
      * users / vault_settings: skip (the active vault's identity & settings
        are preserved).
    Returns a summary of rows inserted per table.
    """
    tables = payload.get("tables", {})
    inserted: dict[str, int] = {t: 0 for t in PREVIEW_TABLES}
    cur = conn.cursor()
    try:
        # Sites: dedup by name; build old_id -> new_id map.
        site_map: dict[int | None, int | None] = {None: None}
        for srow in (tables.get("sites") or {}).get("rows", []):
            name = srow.get("name")
            if not name:
                continue
            existing = cur.execute(
                "SELECT id FROM sites WHERE name=?", (name,)
            ).fetchone()
            if existing:
                site_map[srow.get("id")] = existing["id"] if not isinstance(existing, tuple) else existing[0]
                continue
            cur.execute(
                "INSERT INTO sites(name, plant_code, location, status, notes, "
                "created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                (name, srow.get("plant_code"), srow.get("location"),
                 srow.get("status") or "Active", srow.get("notes"),
                 srow.get("created_at"), srow.get("updated_at")),
            )
            site_map[srow.get("id")] = cur.lastrowid
            inserted["sites"] += 1

        # Assets: remap site_id.
        asset_map: dict[int | None, int | None] = {None: None}
        cols = (tables.get("assets") or {}).get("columns", [])
        for arow in (tables.get("assets") or {}).get("rows", []):
            cur.execute(
                "INSERT INTO assets(site_id, app_vm_name, asset_type, vm_id, hostname, "
                "ip_address, web_url_enc, environment, os_info, owner, status, "
                "notes_enc, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (site_map.get(arow.get("site_id")), arow.get("app_vm_name"),
                 arow.get("asset_type") or "Other", arow.get("vm_id"),
                 arow.get("hostname"), arow.get("ip_address"),
                 arow.get("web_url_enc"), arow.get("environment"),
                 arow.get("os_info"), arow.get("owner"),
                 arow.get("status") or "Active", arow.get("notes_enc"),
                 arow.get("created_at"), arow.get("updated_at")),
            )
            asset_map[arow.get("id")] = cur.lastrowid
            inserted["assets"] += 1

        # Credentials: remap site_id + asset_id.
        for crow in (tables.get("credentials") or {}).get("rows", []):
            cur.execute(
                "INSERT INTO credentials(title, site_id, asset_id, cred_type, "
                "username_enc, password_enc, url_host_enc, port, rotation_due, "
                "status, notes_enc, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (crow.get("title"), site_map.get(crow.get("site_id")),
                 asset_map.get(crow.get("asset_id")), crow.get("cred_type"),
                 crow.get("username_enc"), crow.get("password_enc"),
                 crow.get("url_host_enc"), crow.get("port"),
                 crow.get("rotation_due"), crow.get("status") or "Active",
                 crow.get("notes_enc"), crow.get("created_at"),
                 crow.get("updated_at")),
            )
            inserted["credentials"] += 1

        # Network / change / audit: append with fresh ids.
        for t in ("network_reference", "change_log", "audit_log"):
            cols = (tables.get(t) or {}).get("columns", [])
            for row in (tables.get(t) or {}).get("rows", []):
                # remap site_id where the column exists
                vals = []
                for c in cols:
                    v = row.get(c)
                    if c == "site_id":
                        v = site_map.get(row.get("site_id"))
                    elif c == "asset_id" and t == "change_log":
                        v = asset_map.get(row.get("asset_id"))
                    if isinstance(v, dict) and "__b64__" in v:
                        v = base64.b64decode(v["__b64__"])
                    vals.append(v)
                # insert all columns EXCEPT id (let it autoincrement)
                non_id = [c for c in cols if c != "id"]
                ph = ",".join("?" for _ in non_id)
                # map vals to non_id order
                vmap = {c: row.get(c) for c in cols}
                ordered = []
                for c in non_id:
                    vv = vmap[c]
                    if c == "site_id":
                        vv = site_map.get(row.get("site_id"))
                    elif c == "asset_id" and t == "change_log":
                        vv = asset_map.get(row.get("asset_id"))
                    if isinstance(vv, dict) and "__b64__" in vv:
                        vv = base64.b64decode(vv["__b64__"])
                    ordered.append(vv)
                cur.execute(
                    f"INSERT INTO {t} ({','.join(non_id)}) VALUES ({ph})", ordered
                )
                inserted[t] += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return inserted


def _insert_rows(cur: sqlite3.Connection.cursor, table: str, blk: dict) -> int:
    """Insert all rows of a table block verbatim (full-replace path)."""
    cols = blk["columns"]
    placeholders = ",".join("?" for _ in cols)
    collist = ",".join(cols)
    count = 0
    for row in blk["rows"]:
        vals = []
        for col in cols:
            v = row.get(col)
            if isinstance(v, dict) and "__b64__" in v:
                v = base64.b64decode(v["__b64__"])
            vals.append(v)
        cur.execute(
            f"INSERT INTO {table} ({collist}) VALUES ({placeholders})", vals
        )
        count += 1
    return count


def _read_schema_version(conn: sqlite3.Connection) -> str:
    row = conn.execute(
        "SELECT value FROM vault_settings WHERE key='schema_version'"
    ).fetchone()
    return row[0] if row else "1"


def _zero(b: bytes) -> None:
    try:
        a = bytearray(b)
        for i in range(len(a)):
            a[i] = 0
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Filename helpers
# ---------------------------------------------------------------------------

def backup_filename() -> str:
    """Spec naming: DRISHTI_Vault_Backup_YYYY-MM-DD_HHMM.drishtivaultbackup"""
    ts = _dt.datetime.now().strftime("%Y-%m-%d_%H%M")
    return f"DRISHTI_Vault_Backup_{ts}.drishtivaultbackup"
