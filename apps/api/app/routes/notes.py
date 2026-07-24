"""Encrypted Notes — OneNote-style searchable notes.

Security model (consistent with the rest of the vault):
  * EVERYTHING sensitive is AES-256-GCM encrypted at rest with the session DEK:
    the title, the body, AND the tags. A user with raw DB access cannot read a
    note's content without the master password.
  * Because content is encrypted, there is no server-side full-text search. The
    list endpoint returns DECRYPTED notes (title/body/tags) and the browser does
    the matching. NOTE: unlike credentials, GET /notes requires only an
    authenticated session — NOT the reveal window (no master re-auth). See the
    SECURITY NOTE on the list endpoint for the trade-off.
  * Metadata that must stay readable for sorting/display — color, pinned,
    timestamps, owner — is stored in plaintext (never the content itself).
  * Notes are owner-scoped: a user sees/edits only their own notes. The reserved
    super_admin sees all. Every create/edit/delete is audit-logged with metadata
    only (never the note text).
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .. import crypto
from ..audit import log
from ..db import db_cursor, get_db, now_iso
from ..deps import client_ip, get_session

router = APIRouter(tags=["notes"])

ALLOWED_COLORS = {"", "yellow", "green", "blue", "pink", "purple", "gray"}


class NoteIn(BaseModel):
    title: str = ""
    body: str = ""
    tags: list[str] = []
    color: str = ""
    pinned: bool = False


class NotePatch(BaseModel):
    title: str | None = None
    body: str | None = None
    tags: list[str] | None = None
    color: str | None = None
    pinned: bool | None = None


def _enc(s, v: str) -> str:
    # crypto.encrypt_field stores an empty-string sentinel for falsy input, so
    # notes created with a blank title/body still round-trip cleanly.
    return crypto.encrypt_field(s.dek, v)


def _dec(s, token):
    return crypto.decrypt_field(s.dek, token)


def _is_super(session) -> bool:
    row = get_db().execute(
        "SELECT role FROM users WHERE id=?", (session.user_id,)
    ).fetchone()
    return bool(row and row["role"] == "super_admin")


def _can_see(session, owner_id: int) -> bool:
    """A user sees their own notes; super_admin sees all."""
    return owner_id == session.user_id or _is_super(session)


def _row_to_note(s, r) -> dict:
    """Decrypt a note row for an authenticated, reveal-open session."""
    try:
        tags = json.loads(_dec(s, r["tags_enc"])) if r["tags_enc"] else []
    except (ValueError, TypeError):
        tags = []
    return {
        "id": r["id"],
        "title": _dec(s, r["title_enc"]),
        "body": _dec(s, r["body_enc"]),
        "tags": tags,
        "color": r["color"],
        "pinned": bool(r["pinned"]),
        "owner_id": r["owner_id"],
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
    }


def _scope_filter(session):
    """Return ('SQL', params) limiting note rows to what this session may see."""
    if _is_super(session):
        return "", []
    return "WHERE owner_id = ?", [session.user_id]


# ---- list (decrypted; authenticated login only, no reveal re-auth) -----------
#
# SECURITY NOTE: Unlike credentials, notes do NOT require the reveal window
# (master-password re-auth). A valid logged-in session is enough. This is a
# deliberate UX choice requested by the operator: it means anyone with access
# to an unlocked browser (or a live session cookie within the idle window) can
# read all decrypted notes the user may see — without the second gate. Note
# content remains fully AES-256-GCM encrypted at rest; only the read gate was
# relaxed. If stronger protection is ever needed, switch the dependency back to
# `require_reveal`.

@router.get("/notes")
def list_notes(session=Depends(get_session)):
    """Return all notes the user may see, DECRYPTED.

    Requires only an authenticated session (no reveal re-auth). Pinned notes
    sort first, then by most-recently-updated.
    """
    where, params = _scope_filter(session)
    rows = get_db().execute(
        f"SELECT * FROM notes {where} "
        "ORDER BY pinned DESC, updated_at DESC",
        params,
    ).fetchall()
    return {"items": [_row_to_note(session, r) for r in rows]}


# ---- create -----------------------------------------------------------------

@router.post("/notes")
def create_note(note: NoteIn, request: Request,
                session=Depends(get_session)):
    if note.color not in ALLOWED_COLORS:
        raise HTTPException(400, f"Invalid color. Use one of: "
                                 f"{sorted(c for c in ALLOWED_COLORS if c) or 'default'}")
    with db_cursor() as cur:
        conn = cur.connection
        cur.execute(
            "INSERT INTO notes(title_enc, body_enc, tags_enc, color, pinned, "
            "owner_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
            (_enc(session, note.title), _enc(session, note.body),
             _enc(session, json.dumps(note.tags)),
             note.color, 1 if note.pinned else 0, session.user_id,
             now_iso(), now_iso()),
        )
        nid = cur.lastrowid
        log(conn, "note.create", actor=session.username,
            target_type="note", target_id=nid,
            detail=f"color={note.color or 'default'} pinned={int(bool(note.pinned))}",
            source_ip=client_ip(request))
    return {"id": nid}


# ---- update -----------------------------------------------------------------

@router.put("/notes/{nid}")
def update_note(nid: int, patch: NotePatch, request: Request,
                session=Depends(get_session)):
    conn = get_db()
    row = conn.execute("SELECT * FROM notes WHERE id=?", (nid,)).fetchone()
    if row is None or not _can_see(session, row["owner_id"]):
        # 404, not 403 — no existence leak
        raise HTTPException(404, "Note not found.")
    if patch.color is not None and patch.color not in ALLOWED_COLORS:
        raise HTTPException(400, "Invalid color.")

    fields: list[str] = []
    params: list = []
    if patch.title is not None:
        fields.append("title_enc = ?"); params.append(_enc(session, patch.title))
    if patch.body is not None:
        fields.append("body_enc = ?"); params.append(_enc(session, patch.body))
    if patch.tags is not None:
        fields.append("tags_enc = ?")
        params.append(_enc(session, json.dumps(patch.tags)))
    if patch.color is not None:
        fields.append("color = ?"); params.append(patch.color)
    if patch.pinned is not None:
        fields.append("pinned = ?"); params.append(1 if patch.pinned else 0)
    if not fields:
        return {"ok": True, "updated": False}
    fields.append("updated_at = ?"); params.append(now_iso())
    params.append(nid)
    with db_cursor() as cur:
        conn = cur.connection
        cur.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id=?", params)
        log(conn, "note.edit", actor=session.username,
            target_type="note", target_id=nid,
            detail=f"fields={','.join(f.split(' ')[0] for f in fields[:-1])}",
            source_ip=client_ip(request))
    return {"ok": True, "updated": True}


# ---- delete -----------------------------------------------------------------

@router.delete("/notes/{nid}")
def delete_note(nid: int, request: Request, session=Depends(get_session)):
    conn = get_db()
    row = conn.execute("SELECT owner_id FROM notes WHERE id=?", (nid,)).fetchone()
    if row is None or not _can_see(session, row["owner_id"]):
        raise HTTPException(404, "Note not found.")
    with db_cursor() as cur:
        conn = cur.connection
        cur.execute("DELETE FROM notes WHERE id=?", (nid,))
        log(conn, "note.delete", actor=session.username,
            target_type="note", target_id=nid,
            source_ip=client_ip(request))
    return {"ok": True}


# ---- toggle pin (metadata-only, no reveal needed) ---------------------------

@router.post("/notes/{nid}/pin")
def toggle_pin(nid: int, request: Request, session=Depends(get_session)):
    conn = get_db()
    row = conn.execute("SELECT owner_id, pinned FROM notes WHERE id=?", (nid,)).fetchone()
    if row is None or not _can_see(session, row["owner_id"]):
        raise HTTPException(404, "Note not found.")
    new_val = 0 if row["pinned"] else 1
    with db_cursor() as cur:
        conn = cur.connection
        cur.execute("UPDATE notes SET pinned=?, updated_at=? WHERE id=?",
                    (new_val, now_iso(), nid))
        log(conn, "note.pin", actor=session.username,
            target_type="note", target_id=nid,
            detail=f"pinned={new_val}", source_ip=client_ip(request))
    return {"id": nid, "pinned": bool(new_val)}
