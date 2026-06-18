"""Dashboard aggregate metrics."""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends

from ..db import get_db
from ..deps import get_session

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def dashboard(session=Depends(get_session)):
    conn = get_db()
    def count(sql, *a):
        return conn.execute(sql, a).fetchone()[0]

    today = date.today()
    rotation_cutoff = (today - timedelta(days=0)).isoformat()  # due date <= today
    due = conn.execute(
        "SELECT COUNT(*) FROM credentials WHERE rotation_due IS NOT NULL "
        "AND rotation_due != '' AND rotation_due <= ? AND status='Active'",
        (rotation_cutoff,),
    ).fetchone()[0]

    recent_changes = [dict(r) for r in conn.execute(
        "SELECT id, event_date, asset_name, field_changed, changed_by, "
        "reason_ticket, approved_by FROM change_log ORDER BY id DESC LIMIT 10"
    )]
    recent_audit = [dict(r) for r in conn.execute(
        "SELECT id, event_ts, actor, action, target_type, target_id, detail "
        "FROM audit_log ORDER BY id DESC LIMIT 10"
    )]

    return {
        "total_sites": count("SELECT COUNT(*) FROM sites"),
        "total_assets": count("SELECT COUNT(*) FROM assets"),
        "total_credentials": count("SELECT COUNT(*) FROM credentials"),
        "credentials_due_rotation": int(due),
        "recent_changes": recent_changes,
        "recent_audit": recent_audit,
    }
