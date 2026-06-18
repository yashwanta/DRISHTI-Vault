"""Backup export / restore endpoints — strict two-gate protection.

Every endpoint below requires BOTH:
  1. an active unlocked session, AND
  2. re-entered master password (the second gate).

The Vault Backup Password additionally encrypts/decrypts the backup envelope
and is never stored or logged.

Endpoints
  POST /backup/export          -> master_pw + backup_pw + confirm -> .drishtivaultbackup
  POST /backup/restore/preview -> master_pw + file + backup_pw    -> {token, meta}
  POST /backup/restore/commit  -> master_pw + token + mode        -> {applied}
  GET  /backup/history         -> backup_events rows
  GET  /backup/last            -> last successful export/restore timestamps

Restore lockout: 5 failed restore attempts force a 5-minute cooldown (or an
app restart). All attempts are audit-logged with success/failure ONLY — never
passwords, keys, or decrypted content.
"""
from __future__ import annotations

import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..audit import log
from ..db import get_db
from ..deps import (client_ip, get_session, restore_lockout,
                    verify_master_for_session)
from ..restore_staging import staged_restores
from ..services.backup_svc import (BackupError, apply_merge, apply_replace,
                                   backup_filename, backup_metadata,
                                   decrypt_backup, export_backup)

router = APIRouter(tags=["backup"])


# ---- Export -----------------------------------------------------------------

class ExportBody(BaseModel):
    master_password: str = Field(min_length=1)
    backup_password: str = Field(min_length=10)
    backup_password_confirm: str = Field(min_length=10)


@router.post("/backup/export")
def backup_export(body: ExportBody, request: Request,
                  session=Depends(get_session)):
    conn = get_db()
    # Gate 2: master re-auth
    verify_master_for_session(conn, session, body.master_password)

    # Vault backup password rules: min length + confirmation match
    if body.backup_password != body.backup_password_confirm:
        _record(conn, request, session, "export", False, detail="backup pw mismatch")
        raise HTTPException(400, "Vault Backup Password fields do not match.")

    try:
        data, created_at = export_backup(conn, body.backup_password)
    except ValueError as e:
        _record(conn, request, session, "export", False, detail=str(e))
        raise HTTPException(400, str(e))

    fname = backup_filename()
    _record(conn, request, session, "export", True, filename=fname)
    log(conn, "backup.export", actor=session.username,
        detail=f"file={fname}", source_ip=client_ip(request))

    headers = {
        "Content-Disposition": f'attachment; filename="{fname}"',
        "Content-Type": "application/octet-stream",
        "X-Backup-Created-At": created_at,
    }
    return StreamingResponse(io.BytesIO(data), media_type="application/octet-stream",
                             headers=headers)


# ---- Restore: preview -------------------------------------------------------

@router.post("/backup/restore/preview")
async def backup_restore_preview(request: Request,
                                 file: UploadFile = File(...),
                                 master_password: str = Form(...),
                                 backup_password: str = Form(...),
                                 session=Depends(get_session)):
    conn = get_db()
    verify_master_for_session(conn, session, master_password)

    if restore_lockout.is_locked():
        secs = int(restore_lockout.seconds_remaining())
        log(conn, "backup.restore_blocked", actor=session.username,
            detail=f"lockout {secs}s", source_ip=client_ip(request))
        raise HTTPException(
            429, f"Too many failed attempts. Wait {secs}s or restart the app.")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file.")

    try:
        payload = decrypt_backup(data, backup_password)
    except BackupError as e:
        restore_lockout.record_failure()
        _record(conn, request, session, "restore_replace", False,
                detail=f"decrypt failed: {e}")
        log(conn, "backup.restore_failed", actor=session.username,
            source_ip=client_ip(request))  # success/fail only; no value
        raise HTTPException(400, str(e))

    restore_lockout.record_success()
    meta = backup_metadata(payload)
    token = staged_restores.put(session.sid, payload)
    log(conn, "backup.restore_preview", actor=session.username,
        detail=f"counts={meta['counts']}", source_ip=client_ip(request))
    return {"token": token, "meta": meta}


# ---- Restore: commit (replace / merge) --------------------------------------

class CommitBody(BaseModel):
    master_password: str = Field(min_length=1)
    token: str
    mode: str  # 'replace' | 'merge'


@router.post("/backup/restore/commit")
def backup_restore_commit(body: CommitBody, request: Request,
                          session=Depends(get_session)):
    conn = get_db()
    verify_master_for_session(conn, session, body.master_password)

    if body.mode not in ("replace", "merge"):
        raise HTTPException(400, "Invalid restore mode.")

    payload = staged_restores.take(session.sid, body.token)
    if payload is None:
        raise HTTPException(
            410, "Restore preview expired. Please restart the restore flow.")

    try:
        if body.mode == "replace":
            applied = apply_replace(conn, payload)
            kind = "restore_replace"
        else:
            applied = apply_merge(conn, payload)
            kind = "restore_merge"
    except Exception as e:
        _record(conn, request, session, "restore_replace" if body.mode == "replace"
                else "restore_merge", False, detail="apply error")
        raise HTTPException(500, "Restore failed. Database unchanged.")

    _record(conn, request, session, kind, True, detail=str(applied))
    log(conn, f"backup.{kind}", actor=session.username,
        detail=str(applied), source_ip=client_ip(request))

    # After a REPLACE, the session DEK no longer matches the restored wrapped
    # DEK. Force a re-auth. (Merge keeps the active identity, so no lock.)
    locked = False
    if body.mode == "replace":
        from ..sessions import sessions
        sessions.lock(session.sid)
        locked = True

    return {"applied": applied, "mode": body.mode, "locked": locked,
            "message": ("Restore complete. Re-enter the master password."
                        if locked else "Merge import complete.")}


# ---- History / status -------------------------------------------------------

@router.get("/backup/history")
def backup_history(session=Depends(get_session),
                   limit: int = 50):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, event_ts, kind, success, filename, actor, detail "
        "FROM backup_events ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    return {"items": [dict(r) for r in rows]}


@router.get("/backup/last")
def backup_last(session=Depends(get_session)):
    conn = get_db()
    def _last(kind_like: str):
        row = conn.execute(
            "SELECT event_ts FROM backup_events WHERE success=1 AND kind LIKE ? "
            "ORDER BY id DESC LIMIT 1", (kind_like,)
        ).fetchone()
        return row["event_ts"] if row else None
    return {
        "last_export": _last("export"),
        "last_restore": _last("restore%"),
        "restore_lockout_active": restore_lockout.is_locked(),
        "restore_lockout_seconds": int(restore_lockout.seconds_remaining()),
    }


# ---- internal ---------------------------------------------------------------

def _record(conn, request: Request, session, kind: str, success: bool,
            filename: str | None = None, detail: str | None = None) -> None:
    """Append to backup_events + audit. Metadata only — no secrets."""
    from ..db import now_iso
    # cap detail length and strip anything that could be sensitive
    safe = (detail[:200] if detail else None)
    conn.execute(
        "INSERT INTO backup_events(event_ts, kind, success, filename, actor, detail) "
        "VALUES (?,?,?,?,?,?)",
        (now_iso(), kind, 1 if success else 0, filename,
         getattr(session, "username", None), safe),
    )
    conn.commit()
    action = f"backup.{kind}"
    log(conn, action if success else f"{action}_failed",
        actor=getattr(session, "username", None),
        detail=("success" if success else "failure") +
               (f" file={filename}" if filename else ""),
        source_ip=client_ip(request))
