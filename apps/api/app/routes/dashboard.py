"""Dashboard aggregate metrics (role-scoped)."""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends

from .. import rbac
from ..db import get_db
from ..deps import get_session

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def dashboard(session=Depends(get_session)):
    conn = get_db()
    _, allowed = rbac.viewer_scope(conn, session)
    site_clause, site_args = rbac.scope_sql(allowed)           # for sites-scoped tables

    def scoped_count(table, col="site_id"):
        c, a = rbac.scope_sql(allowed, col)
        return conn.execute(
            f"SELECT COUNT(*) FROM {table} WHERE {c}", a
        ).fetchone()[0]

    today = date.today()
    rotation_cutoff = today.isoformat()  # due date <= today
    c_clause, c_args = rbac.scope_sql(allowed, "site_id")
    due = conn.execute(
        f"SELECT COUNT(*) FROM credentials WHERE rotation_due IS NOT NULL "
        f"AND rotation_due != '' AND rotation_due <= ? AND status='Active' "
        f"AND ({c_clause})",
        (rotation_cutoff, *c_args),
    ).fetchone()[0]

    # recent changes (scoped; resolve asset site when needed)
    recent_changes = []
    for r in conn.execute(
        "SELECT id, event_date, asset_name, field_changed, changed_by, "
        "reason_ticket, approved_by, site_id, asset_id FROM change_log "
        "ORDER BY id DESC LIMIT 10"
    ):
        if allowed is not None:
            site = r["site_id"]
            if site is None and r["asset_id"] is not None:
                a = conn.execute("SELECT site_id FROM assets WHERE id=?",
                                 (r["asset_id"],)).fetchone()
                site = a["site_id"] if a else None
            if not rbac.can_access(allowed, site):
                continue
        recent_changes.append({
            "id": r["id"], "event_date": r["event_date"],
            "asset_name": r["asset_name"], "field_changed": r["field_changed"],
            "changed_by": r["changed_by"], "reason_ticket": r["reason_ticket"],
            "approved_by": r["approved_by"],
        })

    # recent audit: super/global admins see all; location admins see their own
    if allowed is None:
        recent_audit = [dict(r) for r in conn.execute(
            "SELECT id, event_ts, actor, action, target_type, target_id, detail "
            "FROM audit_log ORDER BY id DESC LIMIT 10"
        )]
    else:
        recent_audit = [dict(r) for r in conn.execute(
            "SELECT id, event_ts, actor, action, target_type, target_id, detail "
            "FROM audit_log WHERE actor=? ORDER BY id DESC LIMIT 10",
            (session.username,),
        )]

    return {
        "total_sites": scoped_count("sites"),
        "total_assets": scoped_count("assets"),
        "total_credentials": scoped_count("credentials"),
        "credentials_due_rotation": int(due),
        "recent_changes": recent_changes,
        "recent_audit": recent_audit,
    }
