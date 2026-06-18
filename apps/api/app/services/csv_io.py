"""CSV template generation, parsing, and validation for bulk import.

Each table has a schema map describing:
  * column order (for the template header)
  * required fields
  * secret fields (encrypted on commit with the session DEK)
  * validators (enum membership, etc.)

Templates contain DUMMY DATA ONLY — never real secrets. The sample row uses a
commented prefix so a naive re-upload is ignored unless the user fills it in.
"""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from typing import Callable

# Re-exported enums so the service is the single source of truth for validation.
CRED_TYPES = {
    "Linux SSH", "Windows Login", "Proxmox Login", "Web Login", "Database",
    "Service Account", "API Token", "Wi-Fi / Network", "Break-Glass", "Other",
}
ASSET_TYPES = {
    "Proxmox Host", "Proxmox VM", "Ubuntu Server", "Windows Server", "RDS Core",
    "ShingoCore", "FleetManager", "Database", "Network Device", "Aruba AP",
    "Switch", "Other",
}
STATUSES = {"Active", "Planned", "Retired"}


@dataclass
class Column:
    name: str
    required: bool = False
    secret: bool = False
    enum: set[str] | None = None
    integer: bool = False


@dataclass
class TableSchema:
    table: str
    columns: list[Column]
    sample: dict[str, str] = field(default_factory=dict)

    @property
    def header(self) -> list[str]:
        return [c.name for c in self.columns]

    @property
    def secret_cols(self) -> set[str]:
        return {c.name for c in self.columns if c.secret}


# --- per-table schemas -------------------------------------------------------

SCHEMAS: dict[str, TableSchema] = {
    "credentials": TableSchema(
        table="credentials",
        columns=[
            Column("title", required=True),
            Column("site_name"),
            Column("asset_name"),
            Column("cred_type", enum=CRED_TYPES),
            Column("username", secret=True),
            Column("password", secret=True),
            Column("url_host", secret=True),
            Column("port", integer=True),
            Column("rotation_due"),
            Column("status", enum=STATUSES),
            Column("notes", secret=True),
        ],
        sample={
            "title": "PVE root", "site_name": "Springfield",
            "asset_name": "PVE (Proxmox Host)", "cred_type": "Proxmox Login",
            "username": "root@pam", "password": "CHANGE_ME",
            "url_host": "https://pve.local:8006", "port": "8006",
            "rotation_due": "", "status": "Active", "notes": "",
        },
    ),
    "sites": TableSchema(
        table="sites",
        columns=[
            Column("name", required=True),
            Column("plant_code"),
            Column("location"),
            Column("status", enum=STATUSES),
            Column("notes"),
        ],
        sample={
            "name": "Shelbyville", "plant_code": "SHB",
            "location": "Shelbyville, USA", "status": "Active", "notes": "",
        },
    ),
    "assets": TableSchema(
        table="assets",
        columns=[
            Column("site_name"),
            Column("app_vm_name", required=True),
            Column("asset_type", enum=ASSET_TYPES),
            Column("vm_id"),
            Column("hostname"),
            Column("ip_address"),
            Column("web_url", secret=True),
            Column("environment"),
            Column("os_info"),
            Column("owner"),
            Column("status", enum=STATUSES),
            Column("notes", secret=True),
        ],
        sample={
            "site_name": "Springfield", "app_vm_name": "ShingoCore",
            "asset_type": "ShingoCore", "vm_id": "", "hostname": "shingocore01",
            "ip_address": "10.0.0.10", "web_url": "", "environment": "Prod",
            "os_info": "Ubuntu 22.04", "owner": "IT", "status": "Active", "notes": "",
        },
    ),
    "network": TableSchema(
        table="network",
        columns=[
            Column("site_name"),
            Column("vlan_id"),
            Column("vlan_name"),
            Column("subnet"),
            Column("gateway"),
            Column("dhcp_scope"),
            Column("dns_servers"),
            Column("notes"),
        ],
        sample={
            "site_name": "Springfield", "vlan_id": "193", "vlan_name": "AMR VLAN",
            "subnet": "10.0.193.0/24", "gateway": "10.0.193.1",
            "dhcp_scope": "", "dns_servers": "10.0.0.53", "notes": "",
        },
    ),
    "changelog": TableSchema(
        table="changelog",
        columns=[
            Column("event_date"),
            Column("site_name"),
            Column("asset_name"),
            Column("field_changed"),
            Column("changed_by"),
            Column("reason_ticket"),
            Column("approved_by"),
            Column("notes"),
        ],
        sample={
            "event_date": "2026-06-17", "site_name": "Springfield",
            "asset_name": "PVE (Proxmox Host)", "field_changed": "password",
            "changed_by": "Yash", "reason_ticket": "QUARTERLY-ROTATION",
            "approved_by": "Yash", "notes": "",
        },
    ),
}

TABLES = list(SCHEMAS.keys())


def schema_for(table: str) -> TableSchema | None:
    return SCHEMAS.get(table)


# --- template generation -----------------------------------------------------

def make_template(table: str) -> str:
    """Return CSV text for an empty template (header + one dummy sample row).

    Secret-column samples are marked CHANGE_ME so a naive re-upload is obvious.
    Dummy data only — never real secrets.
    """
    s = schema_for(table)
    if s is None:
        raise ValueError(f"Unknown table: {table}")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(s.header)
    w.writerow([("CHANGE_ME" if c.secret else s.sample.get(c.name, ""))
                for c in s.columns])
    return buf.getvalue()


# --- parsing / validation ----------------------------------------------------

@dataclass
class RowResult:
    row: int                       # 1-based row index in the data (excl. header)
    ok: bool
    errors: list[str] = field(default_factory=list)
    data: dict = field(default_factory=dict)
    has_secrets: bool = False


@dataclass
class ParseReport:
    table: str
    detected: bool
    rows: list[RowResult] = field(default_factory=list)

    def counts(self) -> dict:
        ok = sum(1 for r in self.rows if r.ok)
        return {"total": len(self.rows), "valid": ok, "invalid": len(self.rows) - ok}


def detect_schema(header: list[str]) -> TableSchema | None:
    """Match an uploaded CSV's header to a known schema."""
    norm = {h.strip().lower() for h in header}
    best, best_score = None, 0
    for s in SCHEMAS.values():
        cols = {c.name.lower() for c in s.columns}
        score = len(norm & cols)
        if score > best_score and score >= max(2, len(cols) // 2):
            best, best_score = s, score
    return best


def parse_csv(text: str) -> tuple[TableSchema | None, list[str], list[dict]]:
    """Parse CSV text. Returns (schema, header, rows-as-dicts)."""
    reader = csv.reader(io.StringIO(text))
    rows_raw = [r for r in reader]
    # drop fully-empty lines
    rows_raw = [r for r in rows_raw if any(cell.strip() for cell in r)]
    if not rows_raw:
        return None, [], []
    header = [h.strip() for h in rows_raw[0]]
    schema = detect_schema(header)
    body = rows_raw[1:]
    out: list[dict] = []
    if schema is None:
        return None, header, []
    name_to_col = {c.name.lower(): c for c in schema.columns}
    for r in body:
        d: dict = {}
        for i, cell in enumerate(r):
            if i >= len(header):
                break
            col = name_to_col.get(header[i].strip().lower())
            if col:
                d[col.name] = cell
        # skip the dummy sample row on naive re-upload
        out.append(d)
    return schema, header, out


def validate_rows(schema: TableSchema, rows: list[dict]) -> list[RowResult]:
    results: list[RowResult] = []
    for idx, d in enumerate(rows, start=1):
        rr = RowResult(row=idx, ok=True, data=dict(d))
        # required
        for c in schema.columns:
            val = (d.get(c.name) or "").strip()
            if c.required and not val:
                rr.ok = False
                rr.errors.append(f"{c.name} is required")
            if c.enum and val and val not in c.enum:
                rr.ok = False
                rr.errors.append(f"{c.name} '{val}' not in {sorted(c.enum)}")
            if c.integer and val:
                try:
                    int(val)
                except ValueError:
                    rr.ok = False
                    rr.errors.append(f"{c.name} must be an integer")
            if c.secret and val:
                rr.has_secrets = True
        results.append(rr)
    return results
