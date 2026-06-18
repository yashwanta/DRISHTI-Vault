"""Role-Based Access Control for DRISHTI-Vault.

Roles:
  super_admin   — the reserved identity `Yash`. Sees everything, can reset any
                  user's password, is hidden from all user lists unless Yash is
                  the one logged in. Can never be deleted / renamed / demoted.
  global_admin  — sees ALL sites and credentials. Cannot reset passwords.
  location_admin— sees only credentials for sites assigned to them (via user_sites).

Isolation model: POLICY-BASED. One DEK encrypts every secret; the SERVER decides
who may decrypt which rows. A global admin (or a host compromise) can still
decrypt everything — this is an access-control policy, not zero-knowledge
isolation. See docs/SECURITY.md.
"""
from __future__ import annotations

import sqlite3
from typing import Optional

SUPER_ADMIN_USERNAME = "Yash"          # reserved identity (case-insensitive)
SUPER_ADMIN_ROLE = "super_admin"
GLOBAL_ADMIN_ROLE = "global_admin"
LOCATION_ADMIN_ROLE = "location_admin"
ROLES = (SUPER_ADMIN_ROLE, GLOBAL_ADMIN_ROLE, LOCATION_ADMIN_ROLE)

# Roles that a global/super admin may create/manage. Super admin is reserved.
MANAGEABLE_ROLES = (GLOBAL_ADMIN_ROLE, LOCATION_ADMIN_ROLE)


def normalize_username(username: str) -> str:
    return (username or "").strip()


def is_reserved_username(username: str) -> bool:
    """True if this username is the reserved super-admin identity (Yash)."""
    return normalize_username(username).lower() == SUPER_ADMIN_USERNAME.lower()


def is_super_admin(user_row) -> bool:
    return bool(user_row) and user_row["role"] == SUPER_ADMIN_ROLE


def is_unrestricted(user_row) -> bool:
    """super_admin and global_admin see all sites/credentials."""
    return bool(user_row) and user_row["role"] in (
        SUPER_ADMIN_ROLE, GLOBAL_ADMIN_ROLE)


def user_row_by_id(conn: sqlite3.Connection, user_id: int):
    return conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()


def user_row_by_name(conn: sqlite3.Connection, username: str):
    return conn.execute(
        "SELECT * FROM users WHERE username=? COLLATE NOCASE", (username,)
    ).fetchone()


def visible_site_ids(conn: sqlite3.Connection, user_row) -> Optional[set]:
    """Return the set of site ids the user may see, or None for unrestricted.

    None  => all sites (super_admin / global_admin)
    set() => the location_admin's assigned site ids (possibly empty)
    """
    if user_row is None:
        return set()
    if is_unrestricted(user_row):
        return None
    rows = conn.execute(
        "SELECT site_id FROM user_sites WHERE user_id=?", (user_row["id"],)
    ).fetchall()
    return {r["site_id"] for r in rows}


def can_access_site(user_row, allowed: Optional[set], site_id) -> bool:
    """May this user see a row belonging to `site_id` (None site = unscoped)?"""
    if allowed is None:
        return True            # unrestricted
    if site_id is None:
        return False           # location admins can't see unscoped rows
    return site_id in allowed


def list_visible_users(conn: sqlite3.Connection, requester_row) -> list:
    """List users, hiding the reserved super admin unless the requester IS Yash.

    Never returns verifier/key columns (those are sensitive). The super admin's
    existence is hidden from global/location admins.
    """
    requester_is_super = is_super_admin(requester_row) if requester_row else False
    rows = conn.execute(
        "SELECT id, username, role, full_name, active, must_change_pw, "
        "created_at, updated_at FROM users ORDER BY id"
    ).fetchall()
    out = []
    for r in rows:
        if r["role"] == SUPER_ADMIN_ROLE and not requester_is_super:
            continue          # hide Yash from non-Yash users
        out.append(dict(r))
    return out


# ---------------------------------------------------------------------------
# Shared helpers used by resource routes (credentials/assets/network/changelog)
# ---------------------------------------------------------------------------

def viewer_scope(conn: sqlite3.Connection, session):
    """Return (user_row, allowed_site_ids_or_None) for the session."""
    row = conn.execute(
        "SELECT * FROM users WHERE id=?", (session.user_id,)
    ).fetchone()
    return row, visible_site_ids(conn, row)


def scope_sql(allowed, col: str = "site_id") -> tuple[str, list]:
    """Return (sql_fragment, params) to AND into a WHERE clause.

    Unrestricted viewers (allowed is None) get '1=1'. An empty set gets '1=0'
    (location admin with no sites sees nothing). Otherwise an IN (...) clause.
    """
    if allowed is None:
        return "1=1", []
    if not allowed:
        return "1=0", []
    ph = ",".join("?" for _ in allowed)
    return f"{col} IN ({ph})", list(allowed)


def can_access(allowed, site_id) -> bool:
    """May this viewer see a row belonging to site_id (None = unscoped)?"""
    return can_access_site(None, allowed, site_id)


def assert_not_protected(user_row) -> None:
    """Raise ValueError if an operation would mutate/delete the super admin."""
    from fastapi import HTTPException
    if user_row and user_row["role"] == SUPER_ADMIN_ROLE:
        raise HTTPException(
            status_code=403,
            detail="The super-admin account is protected and cannot be modified or removed.",
        )
