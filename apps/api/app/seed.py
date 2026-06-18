"""Sample/dummy data seeding (NO real passwords).

Seeded only on first launch when the DB is empty, so the app is explorable.
All secret fields are obvious dummy values.
"""
from __future__ import annotations

import sqlite3
from .db import now_iso


def seed_sample_data(conn: sqlite3.Connection) -> None:
    now = now_iso()
    rows = conn.execute("SELECT COUNT(*) FROM sites").fetchone()
    if rows[0] > 0:
        return

    # --- Sites ---
    sites = [
        ("Springfield", "SPR", "Springfield, USA", "Active",
         "AMR deployment live — sample data"),
        ("Hopkinsville", "HOP", "Hopkinsville, KY, USA", "Active",
         "AP-565 on VLAN 28 / mreWireless — sample data"),
    ]
    site_ids: dict[str, int] = {}
    for name, code, loc, status, notes in sites:
        cur = conn.execute(
            "INSERT INTO sites(name, plant_code, location, status, notes, "
            "created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
            (name, code, loc, status, notes, now, now),
        )
        site_ids[name] = cur.lastrowid

    # --- Network Reference (mirror Excel seed) ---
    net = [
        (None, "10", "Office / Management", "", "", "", "", "Default mgmt VLAN"),
        (None, "28", "mreWireless", "", "", "", "", "Wireless — AP-565"),
        (None, "193", "AMR VLAN", "", "", "", "", "AMR robot network"),
        (None, "", "Hikrobot RDS", "", "", "", "", "RDS camera VLAN"),
    ]
    for sid_name, *vals in net:
        sid = site_ids.get(sid_name) if sid_name else None
        conn.execute(
            "INSERT INTO network_reference(site_id, vlan_id, vlan_name, subnet, "
            "gateway, dhcp_scope, dns_servers, notes, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (sid, *vals, now, now),
        )

    # Note: secret (encrypted) fields for assets/credentials are created via the
    # normal API after the master password is set. We seed plaintext metadata
    # only so the inventory tables are immediately populated and explorable.
    asset_defs = [
        # name, type, env
        ("ShingoEdge", "Ubuntu Server", "Prod"),
        ("PVE (Proxmox Host)", "Proxmox Host", "Prod"),
        ("ShingoCore", "ShingoCore", "Prod"),
        ("Kafka/Warlink", "Ubuntu Server", "Prod"),
        ("FleetManager", "FleetManager", "Prod"),
        ("RDS Core", "RDS Core", "Prod"),
        ("PostgreSQL", "Database", "Prod"),
        ("AMRFlight", "Ubuntu Server", "Prod"),
    ]
    hop_extra = [("Aruba AP-565 Controller", "Aruba AP", "Prod")]
    for site_name, defs in (("Springfield", asset_defs), ("Hopkinsville", asset_defs + hop_extra)):
        sid = site_ids[site_name]
        for name, atype, env in defs:
            conn.execute(
                "INSERT INTO assets(site_id, app_vm_name, asset_type, vm_id, hostname, "
                "ip_address, web_url_enc, environment, os_info, owner, status, notes_enc, "
                "created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (sid, name, atype, "", "", "", "", env, "", "IT", "Active", "", now, now),
            )

    # --- A welcome change-log row ---
    conn.execute(
        "INSERT INTO change_log(event_date, site_id, asset_id, asset_name, field_changed, "
        "changed_by, reason_ticket, approved_by, notes, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?)",
        (now[:10], None, None, "(vault)", "Init", "system", "Initial seed", "system",
         "DRISHTI-Vault initialized with sample data", now),
    )
