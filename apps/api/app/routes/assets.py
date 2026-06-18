"""VM & Server Inventory CRUD.

web_url and notes are encrypted (sensitive). Everything else is metadata
and stored plain for filtering/search.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .. import crypto
from ..audit import log
from ..db import db_cursor, get_db, now_iso
from ..deps import client_ip, get_session

router = APIRouter(tags=["assets"])

ASSET_TYPES = {
    "Proxmox Host", "Proxmox VM", "Ubuntu Server", "Windows Server", "RDS Core",
    "ShingoCore", "FleetManager", "Database", "Network Device", "Aruba AP",
    "Switch", "Other",
}


class AssetIn(BaseModel):
    site_id: int | None = None
    app_vm_name: str
    asset_type: str = "Other"
    vm_id: str | None = None
    hostname: str | None = None
    ip_address: str | None = None
    web_url: str | None = None          # sensitive -> encrypted
    environment: str | None = None
    os_info: str | None = None
    owner: str | None = None
    status: str = "Active"
    notes: str | None = None            # sensitive -> encrypted


def _enc(session, val):
    return crypto.encrypt_field(session.dek, val)


def _dec(session, token):
    return crypto.decrypt_field(session.dek, token)


def _row_meta(r):
    return dict(
        id=r["id"], site_id=r["site_id"], app_vm_name=r["app_vm_name"],
        asset_type=r["asset_type"], vm_id=r["vm_id"], hostname=r["hostname"],
        ip_address=r["ip_address"], environment=r["environment"],
        os_info=r["os_info"], owner=r["owner"], status=r["status"],
        created_at=r["created_at"], updated_at=r["updated_at"],
        # web_url/notes are NOT returned in list; only via /assets/{id} (reveal not required
        # since these are operational URLs/notes; but still decrypt on demand).
        has_web_url=bool(r["web_url_enc"]), has_notes=bool(r["notes_enc"]),
    )


@router.get("/assets")
def list_assets(session=Depends(get_session)):
    conn = get_db()
    out = []
    for r in conn.execute(
        "SELECT a.*, s.name AS site_name FROM assets a "
        "LEFT JOIN sites s ON s.id=a.site_id ORDER BY a.app_vm_name"
    ):
        d = _row_meta(r)
        d["site_name"] = r["site_name"]
        out.append(d)
    return {"items": out, "asset_types": sorted(ASSET_TYPES)}


@router.get("/assets/{asset_id}")
def get_asset(asset_id: int, request: Request, session=Depends(get_session)):
    conn = get_db()
    r = conn.execute(
        "SELECT a.*, s.name AS site_name FROM assets a "
        "LEFT JOIN sites s ON s.id=a.site_id WHERE a.id=?", (asset_id,)
    ).fetchone()
    if r is None:
        raise HTTPException(404, "Asset not found")
    d = _row_meta(r)
    d["site_name"] = r["site_name"]
    d["web_url"] = _dec(session, r["web_url_enc"])
    d["notes"] = _dec(session, r["notes_enc"])
    return d


@router.post("/assets")
def create_asset(body: AssetIn, request: Request, session=Depends(get_session)):
    if body.asset_type not in ASSET_TYPES:
        raise HTTPException(400, "Invalid asset type")
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO assets(site_id, app_vm_name, asset_type, vm_id, hostname, "
            "ip_address, web_url_enc, environment, os_info, owner, status, notes_enc, "
            "created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (body.site_id, body.app_vm_name, body.asset_type, body.vm_id,
             body.hostname, body.ip_address, _enc(session, body.web_url),
             body.environment, body.os_info, body.owner, body.status,
             _enc(session, body.notes), now_iso(), now_iso()),
        )
        aid = cur.lastrowid
        log(cur.connection, "asset.create", actor=session.username,
            target_type="asset", target_id=aid, detail=body.app_vm_name,
            source_ip=client_ip(request))
    return {"id": aid}


@router.put("/assets/{asset_id}")
def update_asset(asset_id: int, body: AssetIn, request: Request,
                 session=Depends(get_session)):
    if body.asset_type not in ASSET_TYPES:
        raise HTTPException(400, "Invalid asset type")
    with db_cursor() as cur:
        cur.execute("SELECT 1 FROM assets WHERE id=?", (asset_id,))
        if cur.fetchone() is None:
            raise HTTPException(404, "Asset not found")
        cur.execute(
            "UPDATE assets SET site_id=?, app_vm_name=?, asset_type=?, vm_id=?, "
            "hostname=?, ip_address=?, web_url_enc=?, environment=?, os_info=?, "
            "owner=?, status=?, notes_enc=?, updated_at=? WHERE id=?",
            (body.site_id, body.app_vm_name, body.asset_type, body.vm_id,
             body.hostname, body.ip_address, _enc(session, body.web_url),
             body.environment, body.os_info, body.owner, body.status,
             _enc(session, body.notes), now_iso(), asset_id),
        )
        log(cur.connection, "asset.edit", actor=session.username,
            target_type="asset", target_id=asset_id, detail=body.app_vm_name,
            source_ip=client_ip(request))
    return {"ok": True}


@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: int, request: Request, session=Depends(get_session)):
    with db_cursor() as cur:
        cur.execute("SELECT app_vm_name FROM assets WHERE id=?", (asset_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Asset not found")
        cur.execute("DELETE FROM assets WHERE id=?", (asset_id,))
        log(cur.connection, "asset.delete", actor=session.username,
            target_type="asset", target_id=asset_id, detail=row["app_vm_name"],
            source_ip=client_ip(request))
    return {"ok": True}
