"""Audit Log read-only view. Never exposes secret values (none are stored)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..deps import get_session

router = APIRouter(tags=["audit"])


@router.get("/audit")
def list_audit(session=Depends(get_session),
               limit: int = Query(500, ge=1, le=5000),
               offset: int = Query(0, ge=0)):
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    rows = conn.execute(
        "SELECT id, event_ts, actor, action, target_type, target_id, detail, "
        "source_ip FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    return {"items": [dict(r) for r in rows], "total": total,
            "limit": limit, "offset": offset}
