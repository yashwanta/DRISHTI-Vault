"""Credentials Vault — the secure core.

Secret fields (username, password, url_host, notes) are AES-256-GCM encrypted
at rest with the session DEK. List responses return metadata ONLY (masked).
Plaintext is returned by /credentials/{id}/view and /credentials/{id}/copy
ONLY while the reveal window is open (master re-auth within REVEAL_TTL).

Every view/copy is audit-logged with metadata only — never secret values.
"""
from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .. import config, crypto, rbac
from ..audit import log
from ..db import db_cursor, get_db, now_iso
from ..deps import client_ip, get_session, require_reveal

router = APIRouter(tags=["credentials"])

CRED_TYPES = {
    "Linux SSH", "Windows Login", "Proxmox Login", "Web Login", "Database",
    "Service Account", "API Token", "Wi-Fi / Network", "Break-Glass", "Other",
}


class CredentialIn(BaseModel):
    title: str
    site_id: int | None = None
    asset_id: int | None = None
    cred_type: str = "Other"
    username: str | None = None       # encrypted
    password: str | None = None       # encrypted
    url_host: str | None = None       # encrypted
    port: int | None = None
    rotation_due: str | None = None
    status: str = "Active"
    notes: str | None = None          # encrypted


def _enc(s, v):
    return crypto.encrypt_field(s.dek, v)


def _dec(s, t):
    return crypto.decrypt_field(s.dek, t)


def _masked(r):
    """List view: metadata only, secrets masked."""
    has_pw = bool(r["password_enc"])
    return dict(
        id=r["id"], title=r["title"], site_id=r["site_id"], asset_id=r["asset_id"],
        cred_type=r["cred_type"], username_masked=_mask(r["username_enc"]),
        has_password=has_pw, password_masked="••••••••" if has_pw else "",
        url_masked=_mask(r["url_host_enc"]), port=r["port"],
        rotation_due=r["rotation_due"], status=r["status"],
        created_at=r["created_at"], updated_at=r["updated_at"],
    )


def _mask(token):
    if not token:
        return ""
    return "••••••"


def _viewer(conn, session):
    """Return (user_row, allowed_site_ids_or_None) for the session."""
    row = conn.execute("SELECT * FROM users WHERE id=?", (session.user_id,)).fetchone()
    return row, rbac.visible_site_ids(conn, row)


def _can_access_site(allowed, site_id) -> bool:
    return rbac.can_access_site(None, allowed, site_id)


def _scope_clause(allowed, col="c.site_id"):
    """Return ('SQL', []) to AND-into a WHERE, or ('1=1', []) if unrestricted."""
    if allowed is None:
        return "1=1", []
    if not allowed:
        return "1=0", []
    ph = ",".join("?" for _ in allowed)
    return f"{col} IN ({ph})", list(allowed)


def _require_access_or_404(conn, session, allowed, cred_row, cid):
    """404 (not 403) when out of scope — avoid leaking existence."""
    if cred_row is None or not _can_access_site(allowed, cred_row["site_id"]):
        raise HTTPException(404, "Credential not found")


@router.get("/credentials")
def list_credentials(session=Depends(get_session)):
    conn = get_db()
    _, allowed = _viewer(conn, session)
    clause, args = _scope_clause(allowed)
    out = []
    for r in conn.execute(
        "SELECT c.*, s.name AS site_name, a.app_vm_name AS asset_name "
        "FROM credentials c "
        "LEFT JOIN sites s ON s.id=c.site_id "
        "LEFT JOIN assets a ON a.id=c.asset_id "
        f"WHERE {clause} "
        "ORDER BY c.title",
        args,
    ):
        d = _masked(r)
        d["site_name"] = r["site_name"]
        d["asset_name"] = r["asset_name"]
        d["site_id"] = r["site_id"]
        d["asset_id"] = r["asset_id"]
        out.append(d)
    return {"items": out, "cred_types": sorted(CRED_TYPES),
            "clipboard_ttl": config.CLIPBOARD_TTL}


@router.post("/credentials")
def create_credential(body: CredentialIn, request: Request,
                      session=Depends(get_session)):
    if body.cred_type not in CRED_TYPES:
        raise HTTPException(400, "Invalid credential type")
    conn = get_db()
    _, allowed = _viewer(conn, session)
    if not _can_access_site(allowed, body.site_id):
        raise HTTPException(403, "You cannot create credentials for that site.")
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO credentials(title, site_id, asset_id, cred_type, "
            "username_enc, password_enc, url_host_enc, port, rotation_due, status, "
            "notes_enc, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (body.title, body.site_id, body.asset_id, body.cred_type,
             _enc(session, body.username), _enc(session, body.password),
             _enc(session, body.url_host), body.port, body.rotation_due,
             body.status, _enc(session, body.notes), now_iso(), now_iso()),
        )
        cid = cur.lastrowid
        log(cur.connection, "credential.create", actor=session.username,
            target_type="credential", target_id=cid, detail=body.title,
            source_ip=client_ip(request))
    return {"id": cid}


@router.put("/credentials/{cid}")
def update_credential(cid: int, body: CredentialIn, request: Request,
                      session=Depends(get_session)):
    if body.cred_type not in CRED_TYPES:
        raise HTTPException(400, "Invalid credential type")
    conn = get_db()
    _, allowed = _viewer(conn, session)
    with db_cursor() as cur:
        r = cur.execute("SELECT site_id FROM credentials WHERE id=?", (cid,)).fetchone()
        if r is None or not _can_access_site(allowed, r["site_id"]):
            raise HTTPException(404, "Credential not found")
        if not _can_access_site(allowed, body.site_id):
            raise HTTPException(403, "You cannot move a credential to that site.")
        cur.execute(
            "UPDATE credentials SET title=?, site_id=?, asset_id=?, cred_type=?, "
            "username_enc=?, password_enc=?, url_host_enc=?, port=?, rotation_due=?, "
            "status=?, notes_enc=?, updated_at=? WHERE id=?",
            (body.title, body.site_id, body.asset_id, body.cred_type,
             _enc(session, body.username), _enc(session, body.password),
             _enc(session, body.url_host), body.port, body.rotation_due,
             body.status, _enc(session, body.notes), now_iso(), cid),
        )
        log(cur.connection, "credential.edit", actor=session.username,
            target_type="credential", target_id=cid, detail=body.title,
            source_ip=client_ip(request))
    return {"ok": True}


@router.post("/credentials/{cid}/rotate")
def rotate_credential(cid: int, request: Request, session=Depends(get_session)):
    """Generate a new strong random password and store it (encrypted).

    Returns the new plaintext ONCE to the caller — copy it now. Does not
    require reveal (this is a create/generate op), but is audit-logged.
    """
    conn = get_db()
    _, allowed = _viewer(conn, session)
    with db_cursor() as cur:
        r = cur.execute("SELECT title, site_id FROM credentials WHERE id=?",
                        (cid,)).fetchone()
        if r is None or not _can_access_site(allowed, r["site_id"]):
            raise HTTPException(404, "Credential not found")
        new_pw = _gen_password()
        cur.execute(
            "UPDATE credentials SET password_enc=?, rotation_due=?, updated_at=? WHERE id=?",
            (_enc(session, new_pw), _next_rotation_due(), now_iso(), cid),
        )
        log(cur.connection, "credential.rotate", actor=session.username,
            target_type="credential", target_id=cid, detail=r["title"],
            source_ip=client_ip(request))
    return {"ok": True, "new_password": new_pw,
            "clipboard_ttl": config.CLIPBOARD_TTL}


@router.get("/credentials/{cid}/view")
def view_credential(cid: int, request: Request,
                    session=Depends(require_reveal)):
    """Reveal plaintext. Requires open reveal window (master re-auth)."""
    conn = get_db()
    _, allowed = _viewer(conn, session)
    r = conn.execute("SELECT * FROM credentials WHERE id=?", (cid,)).fetchone()
    _require_access_or_404(conn, session, allowed, r, cid)
    log(conn, "credential.view", actor=session.username,
        target_type="credential", target_id=cid, detail=r["title"],
        source_ip=client_ip(request))
    return {
        "id": r["id"], "title": r["title"], "cred_type": r["cred_type"],
        "username": _dec(session, r["username_enc"]),
        "password": _dec(session, r["password_enc"]),
        "url_host": _dec(session, r["url_host_enc"]),
        "port": r["port"], "notes": _dec(session, r["notes_enc"]),
        "clipboard_ttl": config.CLIPBOARD_TTL,
    }


@router.post("/credentials/{cid}/copy")
def copy_credential(cid: int, request: Request,
                    session=Depends(require_reveal)):
    """Acknowledge a copy event (client performs the actual clipboard write).

    Requires open reveal window. Audit-logged. The server never logs the value.
    """
    conn = get_db()
    _, allowed = _viewer(conn, session)
    r = conn.execute("SELECT title, site_id FROM credentials WHERE id=?",
                     (cid,)).fetchone()
    if r is None or not _can_access_site(allowed, r["site_id"]):
        raise HTTPException(404, "Credential not found")
    log(conn, "credential.copy", actor=session.username,
        target_type="credential", target_id=cid, detail=r["title"],
        source_ip=client_ip(request))
    return {"ok": True, "clipboard_ttl": config.CLIPBOARD_TTL}


@router.delete("/credentials/{cid}")
def delete_credential(cid: int, request: Request, session=Depends(get_session)):
    conn = get_db()
    _, allowed = _viewer(conn, session)
    with db_cursor() as cur:
        r = cur.execute("SELECT title, site_id FROM credentials WHERE id=?",
                        (cid,)).fetchone()
        if r is None or not _can_access_site(allowed, r["site_id"]):
            raise HTTPException(404, "Credential not found")
        cur.execute("DELETE FROM credentials WHERE id=?", (cid,))
        log(cur.connection, "credential.delete", actor=session.username,
            target_type="credential", target_id=cid, detail=r["title"],
            source_ip=client_ip(request))
    return {"ok": True}


# ---- helpers ----------------------------------------------------------------
def _gen_password(length: int = 24) -> str:
    alphabet = ("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
                "23456789!@#$%^&*-_=+")
    rng = secrets.SystemRandom()
    return "".join(rng.choice(alphabet) for _ in range(length))


def _next_rotation_due() -> str:
    import datetime as _dt
    return (_dt.date.today() + _dt.timedelta(days=90)).isoformat()
