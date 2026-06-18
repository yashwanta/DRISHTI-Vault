"""CSV template download + bulk import (preview / commit).

Security rules (mirror the Excel import's discipline):
  * Templates contain DUMMY DATA ONLY — never real secrets.
  * Secret columns are encrypted on commit with the session DEK.
  * Preview is a dry run: no writes, no secrets echoed (only "has value").
  * RBAC: a location admin can only import rows for their assigned sites;
    out-of-scope rows are skipped + reported, not inserted.
  * Every commit is audit-logged with counts/table only (no values).
"""
from __future__ import annotations

import io

from fastapi import (APIRouter, Depends, File, Form, HTTPException, Request,
                     UploadFile)
from fastapi.responses import StreamingResponse

from .. import crypto, rbac
from ..audit import log
from ..db import db_cursor, get_db, now_iso
from ..deps import client_ip, get_session
from ..services.csv_io import (SCHEMAS, TABLES, make_template, parse_csv,
                               validate_rows)

router = APIRouter(tags=["csv"])


# ---- template download ------------------------------------------------------

@router.get("/csv/template/{table}")
def csv_template(table: str, session=Depends(get_session)):
    """Download an empty CSV template for a table (dummy data only)."""
    if table not in SCHEMAS:
        raise HTTPException(404, f"No template for table '{table}'.")
    text = make_template(table)
    data = text.encode("utf-8")
    fname = f"drishtivault-{table}-template.csv"
    headers = {"Content-Disposition": f'attachment; filename="{fname}"'}
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv",
        headers=headers,
    )


@router.get("/csv/tables")
def csv_tables(session=Depends(get_session)):
    """List tables that support CSV templates + their columns."""
    out = []
    for t in TABLES:
        s = SCHEMAS[t]
        out.append({
            "table": t,
            "columns": s.header,
            "required": [c.name for c in s.columns if c.required],
            "secret": [c.name for c in s.columns if c.secret],
        })
    return {"tables": out}


# ---- preview (dry) ----------------------------------------------------------

@router.post("/csv/preview")
async def csv_preview(file: UploadFile = File(...),
                      session=Depends(get_session)):
    """Parse + validate an uploaded CSV. No writes, no secrets echoed."""
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    schema, header, rows = parse_csv(raw)
    if schema is None:
        raise HTTPException(422, "Could not detect a known table from the CSV headers.")
    results = validate_rows(schema, rows)
    # never echo secret values back; report presence only
    preview_rows = []
    for r in results:
        safe = {}
        for k, v in r.data.items():
            col = next((c for c in schema.columns if c.name == k), None)
            if col and col.secret:
                safe[k] = "••••" if (v or "").strip() else ""
            else:
                safe[k] = v
        preview_rows.append({
            "row": r.row, "ok": r.ok, "errors": r.errors, "data": safe,
            "has_secrets": r.has_secrets,
        })
    return {
        "table": schema.table,
        "header": header,
        "rows": preview_rows,
        "counts": {"total": len(results),
                   "valid": sum(1 for r in results if r.ok),
                   "invalid": sum(1 for r in results if not r.ok)},
        "secret_columns": sorted(schema.secret_cols),
    }


# ---- commit -----------------------------------------------------------------

@router.post("/csv/commit")
async def csv_commit(request: Request,
                     file: UploadFile = File(...),
                     table: str = Form(...),
                     session=Depends(get_session)):
    """Bulk-insert the CSV. Re-parses the ORIGINAL file server-side.

    Secrets never round-trip through the browser: the preview masks them in its
    response, and the commit re-reads the real values from the uploaded file.
    Secret columns are encrypted with the session DEK; RBAC-scoped.
    """
    schema = SCHEMAS.get(table)
    if schema is None:
        raise HTTPException(400, "Unknown table.")
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    parsed_schema, _header, rows = parse_csv(raw)
    if parsed_schema is None or parsed_schema.table != table:
        raise HTTPException(400, "CSV does not match the selected table.")
    results = validate_rows(parsed_schema, rows)
    valid_rows = [r.data for r in results if r.ok]

    conn = get_db()
    _, allowed = rbac.viewer_scope(conn, session)

    # caches for FK resolution (site_name -> site_id, asset_name -> asset_id)
    site_by_name = {r["name"]: r["id"] for r in
                    conn.execute("SELECT id, name FROM sites")}
    asset_by_name = {r["app_vm_name"]: r["id"] for r in
                     conn.execute("SELECT id, app_vm_name FROM assets")}

    def enc(v):
        return crypto.encrypt_field(session.dek, v)

    def resolve_site(name):
        if not name:
            return None
        return site_by_name.get(name.strip())

    inserted = skipped = 0
    errors: list[dict] = []

    with db_cursor() as cur:
        c = cur.connection
        for i, row in enumerate(valid_rows, start=1):
            try:
                site_id = None
                if "site_name" in schema.header:
                    site_id = resolve_site(row.get("site_name"))
                    if row.get("site_name") and site_id is None:
                        skipped += 1
                        errors.append({"row": i,
                                       "error": f"unknown site '{row.get('site_name')}'"})
                        continue
                    if allowed is not None and not rbac.can_access(allowed, site_id):
                        skipped += 1
                        errors.append({"row": i, "error": "out of your site scope"})
                        continue

                _insert_row(cur, schema, table, row, site_id,
                            asset_by_name, enc, now_iso)
                inserted += 1
            except Exception as e:
                skipped += 1
                errors.append({"row": i, "error": str(e)[:200]})

        log(c, "csv.import", actor=session.username,
            detail=f"table={table} inserted={inserted} skipped={skipped}",
            source_ip=client_ip(request))

    return {"table": table, "inserted": inserted, "skipped": skipped,
            "errors": errors}


# ---- per-table insert -------------------------------------------------------

def _insert_row(cur, schema, table, row, site_id, asset_by_name, enc, ts):
    s = lambda k: (row.get(k) or "").strip() or None
    if table == "credentials":
        asset_id = asset_by_name.get((row.get("asset_name") or "").strip())
        port = row.get("port")
        try:
            port = int(port) if str(port).strip() else None
        except ValueError:
            port = None
        cur.execute(
            "INSERT INTO credentials(title, site_id, asset_id, cred_type, "
            "username_enc, password_enc, url_host_enc, port, rotation_due, "
            "status, notes_enc, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (s("title"), site_id, asset_id, s("cred_type") or "Other",
             enc(s("username")), enc(s("password")), enc(s("url_host")),
             port, s("rotation_due"), s("status") or "Active",
             enc(s("notes")), ts(), ts()))
    elif table == "sites":
        cur.execute(
            "INSERT INTO sites(name, plant_code, location, status, notes, "
            "created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
            (s("name"), s("plant_code"), s("location"), s("status") or "Active",
             s("notes"), ts(), ts()))
    elif table == "assets":
        cur.execute(
            "INSERT INTO assets(site_id, app_vm_name, asset_type, vm_id, hostname, "
            "ip_address, web_url_enc, environment, os_info, owner, status, "
            "notes_enc, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (site_id, s("app_vm_name"), s("asset_type") or "Other",
             s("vm_id"), s("hostname"), s("ip_address"), enc(s("web_url")),
             s("environment"), s("os_info"), s("owner"),
             s("status") or "Active", enc(s("notes")), ts(), ts()))
    elif table == "network":
        cur.execute(
            "INSERT INTO network_reference(site_id, vlan_id, vlan_name, subnet, "
            "gateway, dhcp_scope, dns_servers, notes, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (site_id, s("vlan_id"), s("vlan_name"), s("subnet"),
             s("gateway"), s("dhcp_scope"), s("dns_servers"), s("notes"),
             ts(), ts()))
    elif table == "changelog":
        asset_id = asset_by_name.get((row.get("asset_name") or "").strip())
        cur.execute(
            "INSERT INTO change_log(event_date, site_id, asset_id, asset_name, "
            "field_changed, changed_by, reason_ticket, approved_by, notes, "
            "created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (s("event_date"), site_id, asset_id, s("asset_name"),
             s("field_changed"), s("changed_by"), s("reason_ticket"),
             s("approved_by"), s("notes"), ts()))
    else:
        raise ValueError(f"no inserter for table {table}")
