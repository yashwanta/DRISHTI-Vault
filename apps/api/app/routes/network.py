"""Network Reference CRUD (VLAN/subnet inventory)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .. import rbac
from ..audit import log
from ..db import db_cursor, get_db, now_iso
from ..deps import client_ip, get_session

router = APIRouter(tags=["network"])


class NetIn(BaseModel):
    site_id: int | None = None
    vlan_id: str | None = None
    vlan_name: str | None = None
    subnet: str | None = None
    gateway: str | None = None
    dhcp_scope: str | None = None
    dns_servers: str | None = None
    notes: str | None = None


@router.get("/network")
def list_network(session=Depends(get_session)):
    conn = get_db()
    _, allowed = rbac.viewer_scope(conn, session)
    clause, args = rbac.scope_sql(allowed, "n.site_id")
    out = []
    for r in conn.execute(
        f"SELECT n.*, s.name AS site_name FROM network_reference n "
        f"LEFT JOIN sites s ON s.id=n.site_id WHERE {clause} ORDER BY n.vlan_id",
        args,
    ):
        d = dict(r)
        d["site_name"] = r["site_name"]
        out.append(d)
    return {"items": out}


@router.post("/network")
def create_network(body: NetIn, request: Request, session=Depends(get_session)):
    conn = get_db()
    _, allowed = rbac.viewer_scope(conn, session)
    if not rbac.can_access(allowed, body.site_id):
        raise HTTPException(403, "You cannot create network entries for that site.")
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO network_reference(site_id, vlan_id, vlan_name, subnet, "
            "gateway, dhcp_scope, dns_servers, notes, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (body.site_id, body.vlan_id, body.vlan_name, body.subnet,
             body.gateway, body.dhcp_scope, body.dns_servers, body.notes,
             now_iso(), now_iso()),
        )
        nid = cur.lastrowid
        log(cur.connection, "network.create", actor=session.username,
            target_type="network", target_id=nid,
            detail=body.vlan_name or body.vlan_id, source_ip=client_ip(request))
    return {"id": nid}


@router.put("/network/{nid}")
def update_network(nid: int, body: NetIn, request: Request,
                   session=Depends(get_session)):
    conn = get_db()
    _, allowed = rbac.viewer_scope(conn, session)
    with db_cursor() as cur:
        r = cur.execute("SELECT site_id FROM network_reference WHERE id=?",
                        (nid,)).fetchone()
        if r is None or not rbac.can_access(allowed, r["site_id"]):
            raise HTTPException(404, "Not found")
        if not rbac.can_access(allowed, body.site_id):
            raise HTTPException(403, "You cannot move a network entry to that site.")
        cur.execute(
            "UPDATE network_reference SET site_id=?, vlan_id=?, vlan_name=?, "
            "subnet=?, gateway=?, dhcp_scope=?, dns_servers=?, notes=?, "
            "updated_at=? WHERE id=?",
            (body.site_id, body.vlan_id, body.vlan_name, body.subnet,
             body.gateway, body.dhcp_scope, body.dns_servers, body.notes,
             now_iso(), nid),
        )
        log(cur.connection, "network.edit", actor=session.username,
            target_type="network", target_id=nid,
            detail=body.vlan_name or body.vlan_id, source_ip=client_ip(request))
    return {"ok": True}


@router.delete("/network/{nid}")
def delete_network(nid: int, request: Request, session=Depends(get_session)):
    conn = get_db()
    _, allowed = rbac.viewer_scope(conn, session)
    with db_cursor() as cur:
        r = cur.execute("SELECT vlan_name, site_id FROM network_reference WHERE id=?",
                        (nid,)).fetchone()
        if r is None or not rbac.can_access(allowed, r["site_id"]):
            raise HTTPException(404, "Not found")
        cur.execute("DELETE FROM network_reference WHERE id=?", (nid,))
        log(cur.connection, "network.delete", actor=session.username,
            target_type="network", target_id=nid, detail=r["vlan_name"],
            source_ip=client_ip(request))
    return {"ok": True}
