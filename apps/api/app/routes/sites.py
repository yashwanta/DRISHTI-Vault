"""Sites / Plants CRUD."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..audit import log
from ..db import db_cursor, get_db, now_iso
from ..deps import client_ip, get_session

router = APIRouter(tags=["sites"])


class SiteIn(BaseModel):
    name: str
    plant_code: str | None = None
    location: str | None = None
    status: str = "Active"
    notes: str | None = None


def _row(r):
    return dict(id=r["id"], name=r["name"], plant_code=r["plant_code"],
                location=r["location"], status=r["status"], notes=r["notes"],
                created_at=r["created_at"], updated_at=r["updated_at"])


@router.get("/sites")
def list_sites(session=Depends(get_session)):
    conn = get_db()
    out = []
    for r in conn.execute(
        "SELECT s.*, "
        "(SELECT COUNT(*) FROM assets a WHERE a.site_id=s.id) AS vm_count, "
        "(SELECT COUNT(*) FROM credentials c WHERE c.site_id=s.id) AS cred_count "
        "FROM sites s ORDER BY s.name"
    ):
        d = _row(r)
        d["vm_count"] = r["vm_count"]
        d["credential_count"] = r["cred_count"]
        out.append(d)
    return {"items": out}


@router.post("/sites")
def create_site(body: SiteIn, request: Request, session=Depends(get_session)):
    with db_cursor() as cur:
        try:
            cur.execute(
                "INSERT INTO sites(name, plant_code, location, status, notes, "
                "created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                (body.name, body.plant_code, body.location, body.status,
                 body.notes, now_iso(), now_iso()),
            )
        except Exception:
            raise HTTPException(409, "Site already exists.")
        sid = cur.lastrowid
        log(cur.connection, "site.create", actor=session.username,
            target_type="site", target_id=sid, detail=body.name,
            source_ip=client_ip(request))
    return {"id": sid}


@router.put("/sites/{site_id}")
def update_site(site_id: int, body: SiteIn, request: Request,
                session=Depends(get_session)):
    with db_cursor() as cur:
        cur.execute("SELECT 1 FROM sites WHERE id=?", (site_id,))
        if cur.fetchone() is None:
            raise HTTPException(404, "Site not found")
        cur.execute(
            "UPDATE sites SET name=?, plant_code=?, location=?, status=?, "
            "notes=?, updated_at=? WHERE id=?",
            (body.name, body.plant_code, body.location, body.status,
             body.notes, now_iso(), site_id),
        )
        log(cur.connection, "site.edit", actor=session.username,
            target_type="site", target_id=site_id, detail=body.name,
            source_ip=client_ip(request))
    return {"ok": True}


@router.get("/sites/{site_id}")
def get_site(site_id: int, session=Depends(get_session)):
    conn = get_db()
    r = conn.execute("SELECT * FROM sites WHERE id=?", (site_id,)).fetchone()
    if r is None:
        raise HTTPException(404, "Site not found")
    return _row(r)


@router.delete("/sites/{site_id}")
def delete_site(site_id: int, request: Request, session=Depends(get_session)):
    with db_cursor() as cur:
        cur.execute("SELECT name FROM sites WHERE id=?", (site_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Site not found")
        cur.execute("DELETE FROM sites WHERE id=?", (site_id,))
        log(cur.connection, "site.delete", actor=session.username,
            target_type="site", target_id=site_id, detail=row["name"],
            source_ip=client_ip(request))
    return {"ok": True}
