"""Excel import endpoints: preview (parse) and commit (insert non-secret rows).

Secrets detected in the workbook are NEVER auto-imported. They can only be
imported via /import/secrets/confirm, which requires an open reveal window
(proof of master-password re-auth in the same session).
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from .. import crypto
from ..audit import log
from ..db import db_cursor, get_db, now_iso
from ..deps import client_ip, get_session, require_reveal
from ..services.excel_import import parse_workbook

router = APIRouter(tags=["import"])


@router.post("/import/excel/preview")
async def import_preview(file: UploadFile = File(...),
                         session=Depends(get_session)):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(400, "Only .xlsx workbooks are supported")
    try:
        preview = parse_workbook(data)
    except Exception as e:
        raise HTTPException(422, f"Failed to parse workbook: {e}")
    return preview.to_dict()


@router.post("/import/excel/commit")
def import_commit(payload: dict, request: Request,
                  session=Depends(get_session)):
    """Insert the non-secret rows from a preview into the DB.

    `payload` is the preview object (sites/assets/network/changelog) the user
    confirmed in the UI. Detected secrets are ignored here on purpose.
    """
    inserted = {"sites": 0, "assets": 0, "network": 0, "changelog": 0}
    with db_cursor() as cur:
        conn = cur.connection
        # map workbook site name -> db site id (existing or newly inserted)
        name_to_id = {row["name"]: row["id"] for row in
                      conn.execute("SELECT id, name FROM sites").fetchall()}

        for site in payload.get("sites", []):
            name = (site.get("name") or "").strip()
            if not name or name in name_to_id:
                continue
            cur.execute(
                "INSERT INTO sites(name, plant_code, location, status, notes, "
                "created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                (name, site.get("plant_code") or "", site.get("location") or "",
                 site.get("status") or "Active", site.get("notes") or "",
                 now_iso(), now_iso()),
            )
            name_to_id[name] = cur.lastrowid
            inserted["sites"] += 1

        for asset in payload.get("assets", []):
            site_name = asset.get("site_name")
            site_id = name_to_id.get(site_name) if site_name else None
            cur.execute(
                "INSERT INTO assets(site_id, app_vm_name, asset_type, vm_id, "
                "hostname, ip_address, web_url_enc, environment, os_info, owner, "
                "status, notes_enc, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (site_id, asset.get("app_vm_name") or "Unnamed",
                 asset.get("asset_type") or "Other",
                 asset.get("vm_id") or "", "", asset.get("ip_address") or "",
                 crypto.encrypt_field(session.dek, asset.get("web_url") or ""),
                 asset.get("environment") or "", "", "IT", "Active",
                 crypto.encrypt_field(session.dek, asset.get("notes") or ""),
                 now_iso(), now_iso()),
            )
            inserted["assets"] += 1

        for net in payload.get("network", []):
            site_name = net.get("site_name")
            site_id = name_to_id.get(site_name) if site_name else None
            cur.execute(
                "INSERT INTO network_reference(site_id, vlan_id, vlan_name, "
                "subnet, gateway, dhcp_scope, dns_servers, notes, "
                "created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (site_id, net.get("vlan_id") or "", net.get("vlan_name") or "",
                 net.get("subnet") or "", net.get("gateway") or "",
                 net.get("dhcp_scope") or "", net.get("dns_servers") or "",
                 net.get("notes") or "", now_iso(), now_iso()),
            )
            inserted["network"] += 1

        for cl in payload.get("changelog", []):
            site_name = cl.get("site_name")
            site_id = name_to_id.get(site_name) if site_name else None
            cur.execute(
                "INSERT INTO change_log(event_date, site_id, asset_id, asset_name, "
                "field_changed, changed_by, reason_ticket, approved_by, notes, "
                "created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (cl.get("event_date") or "", site_id, None,
                 cl.get("asset_name") or "", cl.get("field_changed") or "",
                 cl.get("changed_by") or "", cl.get("reason_ticket") or "",
                 cl.get("approved_by") or "", "", now_iso()),
            )
            inserted["changelog"] += 1

        log(conn, "import.excel", actor=session.username,
            detail=json.dumps(inserted), source_ip=client_ip(request))
    return {"inserted": inserted}
