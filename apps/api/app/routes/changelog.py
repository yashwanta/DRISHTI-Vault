"""Change Log CRUD."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .. import rbac
from ..audit import log
from ..db import db_cursor, get_db, now_iso
from ..deps import client_ip, get_session

router = APIRouter(tags=["changelog"])


class ChangeIn(BaseModel):
    event_date: str | None = None
    site_id: int | None = None
    asset_id: int | None = None
    asset_name: str | None = None
    field_changed: str | None = None
    changed_by: str | None = None
    reason_ticket: str | None = None
    approved_by: str | None = None
    notes: str | None = None


def _resolve_site(conn, site_id, asset_id):
    """Best-effort site for a changelog row: explicit site, else asset's site."""
    if site_id is not None:
        return site_id
    if asset_id is not None:
        row = conn.execute("SELECT site_id FROM assets WHERE id=?",
                           (asset_id,)).fetchone()
        return row["site_id"] if row else None
    return None


@router.get("/changelog")
def list_changelog(session=Depends(get_session)):
    conn = get_db()
    _, allowed = rbac.viewer_scope(conn, session)
    out = []
    for r in conn.execute(
        "SELECT cl.*, s.name AS site_name FROM change_log cl "
        "LEFT JOIN sites s ON s.id=cl.site_id ORDER BY cl.id DESC"
    ):
        if allowed is not None:
            site = _resolve_site(conn, r["site_id"], r["asset_id"])
            if not rbac.can_access(allowed, site):
                continue
        d = dict(r)
        d["site_name"] = r["site_name"]
        out.append(d)
    return {"items": out}


@router.post("/changelog")
def create_changelog(body: ChangeIn, request: Request,
                     session=Depends(get_session)):
    conn = get_db()
    _, allowed = rbac.viewer_scope(conn, session)
    site = _resolve_site(conn, body.site_id, body.asset_id)
    if not rbac.can_access(allowed, site):
        raise HTTPException(403, "You cannot log changes for that site/asset.")
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO change_log(event_date, site_id, asset_id, asset_name, "
            "field_changed, changed_by, reason_ticket, approved_by, notes, "
            "created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (body.event_date, body.site_id, body.asset_id, body.asset_name,
             body.field_changed, body.changed_by, body.reason_ticket,
             body.approved_by, body.notes, now_iso()),
        )
        clid = cur.lastrowid
        log(cur.connection, "changelog.create", actor=session.username,
            target_type="changelog", target_id=clid,
            detail=body.asset_name or body.field_changed,
            source_ip=client_ip(request))
    return {"id": clid}


@router.put("/changelog/{clid}")
def update_changelog(clid: int, body: ChangeIn, request: Request,
                     session=Depends(get_session)):
    conn = get_db()
    _, allowed = rbac.viewer_scope(conn, session)
    with db_cursor() as cur:
        r = cur.execute("SELECT site_id, asset_id FROM change_log WHERE id=?",
                        (clid,)).fetchone()
        if r is None:
            raise HTTPException(404, "Not found")
        if not rbac.can_access(allowed, _resolve_site(conn, r["site_id"], r["asset_id"])):
            raise HTTPException(404, "Not found")
        if not rbac.can_access(allowed, _resolve_site(conn, body.site_id, body.asset_id)):
            raise HTTPException(403, "You cannot move a change entry to that site.")
        cur.execute(
            "UPDATE change_log SET event_date=?, site_id=?, asset_id=?, "
            "asset_name=?, field_changed=?, changed_by=?, reason_ticket=?, "
            "approved_by=?, notes=? WHERE id=?",
            (body.event_date, body.site_id, body.asset_id, body.asset_name,
             body.field_changed, body.changed_by, body.reason_ticket,
             body.approved_by, body.notes, clid),
        )
        log(cur.connection, "changelog.edit", actor=session.username,
            target_type="changelog", target_id=clid,
            detail=body.asset_name or body.field_changed,
            source_ip=client_ip(request))
    return {"ok": True}


@router.delete("/changelog/{clid}")
def delete_changelog(clid: int, request: Request, session=Depends(get_session)):
    conn = get_db()
    _, allowed = rbac.viewer_scope(conn, session)
    with db_cursor() as cur:
        r = cur.execute("SELECT site_id, asset_id FROM change_log WHERE id=?",
                        (clid,)).fetchone()
        if r is None:
            raise HTTPException(404, "Not found")
        if not rbac.can_access(allowed, _resolve_site(conn, r["site_id"], r["asset_id"])):
            raise HTTPException(404, "Not found")
        cur.execute("DELETE FROM change_log WHERE id=?", (clid,))
        log(cur.connection, "changelog.delete", actor=session.username,
            target_type="changelog", target_id=clid, source_ip=client_ip(request))
    return {"ok": True}
