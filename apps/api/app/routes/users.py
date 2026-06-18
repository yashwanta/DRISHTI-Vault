"""User Management — admin-only RBAC administration.

Role rules (see app/rbac.py):
  * super_admin (reserved `Yash`) — created only at first-run setup; can never
    be deleted/renamed/demoted; hidden from listings unless Yash is the viewer.
  * global_admin — sees everything; CANNOT reset passwords.
  * location_admin — sees only assigned sites; managed here.

Shared-DEK model: all users decrypt with ONE vault DEK (policy-based
isolation). So creating a user / resetting a password re-wraps the SAME DEK
under the target user's password-derived KEK. The acting admin's session
already holds that shared DEK in memory.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from .. import crypto, rbac
from ..audit import log
from ..db import db_cursor, get_db, now_iso
from ..deps import (client_ip, get_session, require_admin, require_super_admin)

router = APIRouter(tags=["users"])

MIN_PW = 10


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    full_name: str | None = None
    role: str                              # global_admin | location_admin
    password: str = Field(min_length=MIN_PW, max_length=512)
    site_ids: list[int] = []               # for location_admin


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None
    active: bool | None = None


class SiteAssign(BaseModel):
    site_ids: list[int] = []


class ResetPassword(BaseModel):
    new_password: str = Field(min_length=MIN_PW, max_length=512)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _resolve_sites(conn, site_ids: list[int]) -> list[int]:
    """Return the subset of site_ids that actually exist."""
    valid: list[int] = []
    for sid in site_ids or []:
        if conn.execute("SELECT 1 FROM sites WHERE id=?", (sid,)).fetchone():
            valid.append(int(sid))
    return valid


def _creator_can_assign_role(creator_row, requested_role: str) -> bool:
    """Global admin can only create location_admins; super admin can do more."""
    if requested_role not in rbac.MANAGEABLE_ROLES:
        return False
    if creator_row["role"] == rbac.SUPER_ADMIN_ROLE:
        return True
    if creator_row["role"] == rbac.GLOBAL_ADMIN_ROLE:
        return requested_role == rbac.LOCATION_ADMIN_ROLE
    return False


def _public_user(r) -> dict:
    return dict(
        id=r["id"], username=r["username"], role=r["role"],
        full_name=r["full_name"], active=bool(r["active"]),
        must_change_pw=bool(r["must_change_pw"]),
        created_at=r["created_at"], updated_at=r["updated_at"],
    )


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(request: Request, admin=Depends(require_admin)):
    """List users. The super admin (Yash) is hidden unless the viewer is Yash."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, username, role, full_name, active, must_change_pw, "
        "created_at, updated_at FROM users ORDER BY id"
    ).fetchall()
    viewer_is_super = admin["role"] == rbac.SUPER_ADMIN_ROLE
    out = []
    for r in rows:
        if r["role"] == rbac.SUPER_ADMIN_ROLE and not viewer_is_super:
            continue
        d = _public_user(r)
        if r["role"] == rbac.LOCATION_ADMIN_ROLE:
            d["site_ids"] = [x["site_id"] for x in conn.execute(
                "SELECT site_id FROM user_sites WHERE user_id=?", (r["id"],)
            )]
        out.append(d)
    return {"items": out, "roles": list(rbac.ROLES),
            "can_reset_password": viewer_is_super}


@router.post("/users")
def create_user(body: UserCreate, request: Request,
                session=Depends(get_session), admin=Depends(require_admin)):
    conn = get_db()
    # reserved username may never be created here
    if rbac.is_reserved_username(body.username):
        raise HTTPException(400, "This username is reserved.")
    if not _creator_can_assign_role(admin, body.role):
        log(conn, "user.create_denied", actor=session.username,
            detail=f"role={body.role}", source_ip=client_ip(request))
        raise HTTPException(403, "You may not assign that role.")
    # username uniqueness
    if conn.execute("SELECT 1 FROM users WHERE username=? COLLATE NOCASE",
                    (body.username.strip(),)).fetchone():
        raise HTTPException(409, "Username already exists.")

    # Re-wrap the shared vault DEK under the new user's password-derived KEK.
    salt = crypto.gen_salt(16)
    kek = crypto.derive_kek(body.password, salt)
    wrapped = crypto.wrap_dek(kek, session.dek)   # shared DEK from this session
    verifier = crypto.hash_master_password(body.password)
    # zeroize transient key material
    _bzero(kek)

    with db_cursor() as cur:
        c = cur.connection
        cur.execute(
            "INSERT INTO users(username, verifier, kdf_salt, wrapped_dek, role, "
            "full_name, active, must_change_pw, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (body.username.strip(), verifier, salt, wrapped, body.role,
             body.full_name, 1, 1, now_iso(), now_iso()),
        )
        uid = cur.lastrowid
        # assign sites (only meaningful for location_admin, but harmless otherwise)
        for sid in _resolve_sites(c, body.site_ids):
            cur.execute(
                "INSERT OR IGNORE INTO user_sites(user_id, site_id) VALUES (?,?)",
                (uid, sid),
            )
        log(c, "user.create", actor=session.username, target_type="user",
            target_id=uid, detail=f"{body.username} role={body.role}",
            source_ip=client_ip(request))
    return {"id": uid}


@router.put("/users/{uid}")
def update_user(uid: int, body: UserUpdate, request: Request,
                session=Depends(get_session), admin=Depends(require_admin)):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if row is None:
        raise HTTPException(404, "User not found.")
    rbac.assert_not_protected(row)   # cannot mutate the super admin
    # role change: respect creator-can-assign hierarchy; never to super_admin
    new_role = body.role if body.role is not None else row["role"]
    if new_role == rbac.SUPER_ADMIN_ROLE:
        raise HTTPException(400, "Cannot assign the super-admin role.")
    if body.role is not None and not _creator_can_assign_role(admin, new_role):
        raise HTTPException(403, "You may not assign that role.")

    with db_cursor() as cur:
        c = cur.connection
        cur.execute(
            "UPDATE users SET full_name=?, role=?, active=?, updated_at=? WHERE id=?",
            (body.full_name if body.full_name is not None else row["full_name"],
             new_role,
             int(body.active) if body.active is not None else row["active"],
             now_iso(), uid),
        )
        # if promoted out of location_admin, clear site assignments
        if new_role != rbac.LOCATION_ADMIN_ROLE:
            cur.execute("DELETE FROM user_sites WHERE user_id=?", (uid,))
        log(c, "user.edit", actor=session.username, target_type="user",
            target_id=uid, detail=f"role={new_role}", source_ip=client_ip(request))
    return {"ok": True}


@router.post("/users/{uid}/sites")
def assign_sites(uid: int, body: SiteAssign, request: Request,
                 session=Depends(get_session), admin=Depends(require_admin)):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if row is None:
        raise HTTPException(404, "User not found.")
    rbac.assert_not_protected(row)
    if row["role"] != rbac.LOCATION_ADMIN_ROLE:
        raise HTTPException(400, "Site assignment only applies to location admins.")
    valid = _resolve_sites(conn, body.site_ids)
    with db_cursor() as cur:
        c = cur.connection
        cur.execute("DELETE FROM user_sites WHERE user_id=?", (uid,))
        for sid in valid:
            cur.execute(
                "INSERT OR IGNORE INTO user_sites(user_id, site_id) VALUES (?,?)",
                (uid, sid),
            )
        log(c, "user.assign_sites", actor=session.username, target_type="user",
            target_id=uid, detail=f"sites={len(valid)}",
            source_ip=client_ip(request))
    return {"site_ids": valid}


@router.delete("/users/{uid}")
def deactivate_user(uid: int, request: Request,
                    session=Depends(get_session), admin=Depends(require_admin)):
    """Deactivate a user (soft delete — preserves audit trail & FK integrity)."""
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if row is None:
        raise HTTPException(404, "User not found.")
    rbac.assert_not_protected(row)   # super admin cannot be removed
    if row["id"] == admin["id"]:
        raise HTTPException(400, "You cannot deactivate your own account.")
    with db_cursor() as cur:
        c = cur.connection
        cur.execute("UPDATE users SET active=0, updated_at=? WHERE id=?",
                    (now_iso(), uid))
        log(c, "user.deactivate", actor=session.username, target_type="user",
            target_id=uid, detail=row["username"], source_ip=client_ip(request))
    return {"ok": True}


@router.post("/users/{uid}/reset-password")
def reset_password(uid: int, body: ResetPassword, request: Request,
                   session=Depends(get_session),
                   super_admin=Depends(require_super_admin)):
    """Super-admin only: set a new temporary password (target must change it)."""
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if row is None:
        raise HTTPException(404, "User not found.")
    # super admin may reset anyone EXCEPT themselves via this endpoint
    # (self-reset uses /change-master-password). Refuse self to avoid a
    # confusing two-paths situation.
    if row["id"] == super_admin["id"]:
        raise HTTPException(400, "Use Change Master Password to change your own password.")

    salt = crypto.gen_salt(16)
    kek = crypto.derive_kek(body.new_password, salt)
    wrapped = crypto.wrap_dek(kek, session.dek)   # re-wrap shared DEK
    verifier = crypto.hash_master_password(body.new_password)
    _bzero(kek)

    with db_cursor() as cur:
        c = cur.connection
        cur.execute(
            "UPDATE users SET verifier=?, kdf_salt=?, wrapped_dek=?, "
            "must_change_pw=1, updated_at=? WHERE id=?",
            (verifier, salt, wrapped, now_iso(), uid),
        )
        log(c, "user.reset_password", actor=session.username,
            target_type="user", target_id=uid, detail=row["username"],
            source_ip=client_ip(request))
    return {"ok": True, "message": "Password reset. The user must set a new one at next login."}


def _bzero(b: bytes) -> None:
    try:
        a = bytearray(b)
        for i in range(len(a)):
            a[i] = 0
    except Exception:
        pass
