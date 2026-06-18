"""Auth: setup (create master password), login (derive DEK), lock, reveal-open.

NEVER logs passwords, DEK, KEK, or verifiers.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from .. import config, crypto
from ..audit import log
from ..db import get_db, now_iso
from ..deps import auth_throttle, client_ip, db, get_session
from ..sessions import sessions

router = APIRouter(tags=["auth"])


class SetupRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    master_password: str = Field(min_length=10, max_length=512)


class LoginRequest(BaseModel):
    username: str
    master_password: str


class RevealRequest(BaseModel):
    master_password: str


def _user_row(conn, username: str):
    return conn.execute(
        "SELECT * FROM users WHERE username=? COLLATE NOCASE", (username,)
    ).fetchone()


def _enforce_auth_throttle(request: Request, conn):
    """Block (429) if too many recent failed master-password attempts."""
    if auth_throttle.is_locked():
        secs = int(auth_throttle.seconds_remaining())
        log(conn, "auth.throttle_blocked",
            detail=f"lockout {secs}s", source_ip=client_ip(request))
        raise HTTPException(
            429, f"Too many failed attempts. Wait {secs}s or restart the app.")


@router.post("/setup")
def setup(body: SetupRequest, request: Request, response: Response):
    """First-launch: create the master password & wrap a fresh DEK."""
    conn = get_db()
    _enforce_auth_throttle(request, conn)
    existing = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()
    if existing["c"] > 0:
        auth_throttle.record_failure()
        raise HTTPException(409, "Vault already initialized.")
    auth_throttle.record_success()

    pw = body.master_password
    salt = crypto.gen_salt(16)
    dek = crypto.gen_dek()
    kek = crypto.derive_kek(pw, salt)
    wrapped = crypto.wrap_dek(kek, dek)
    verifier = crypto.hash_master_password(pw)
    # zeroize transient key material
    _zero(kek); _zero(dek)

    conn.execute(
        "INSERT INTO users(username, verifier, kdf_salt, wrapped_dek, "
        "created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (body.username, verifier, salt, wrapped, now_iso(), now_iso()),
    )
    conn.commit()
    log(conn, "auth.setup", actor=body.username, source_ip=client_ip(request),
        detail="master password set")
    return {"initialized": True}


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response):
    """Verify master password, unwrap DEK into a new in-memory session."""
    conn = get_db()
    _enforce_auth_throttle(request, conn)
    user = _user_row(conn, body.username)
    if user is None:
        auth_throttle.record_failure()
        log(conn, "auth.login_failed", detail=f"unknown user={body.username!r}",
            source_ip=client_ip(request))
        raise HTTPException(401, "Invalid credentials.")

    ok = crypto.verify_master_password(user["verifier"], body.master_password)
    if not ok:
        auth_throttle.record_failure()
        log(conn, "auth.login_failed", actor=body.username,
            source_ip=client_ip(request))
        raise HTTPException(401, "Invalid credentials.")

    # optional rehash if params changed
    if crypto.needs_rehash(user["verifier"]):
        new_verifier = crypto.hash_master_password(body.master_password)
        conn.execute("UPDATE users SET verifier=?, updated_at=? WHERE id=?",
                     (new_verifier, now_iso(), user["id"]))
        conn.commit()

    kek = crypto.derive_kek(body.master_password, bytes(user["kdf_salt"]))
    try:
        dek = crypto.unwrap_dek(kek, bytes(user["wrapped_dek"]))
    except Exception:
        _zero(kek)
        auth_throttle.record_failure()
        log(conn, "auth.login_failed", actor=body.username, detail="dek unwrap failed",
            source_ip=client_ip(request))
        raise HTTPException(401, "Invalid credentials (key mismatch).")
    _zero(kek)
    auth_throttle.record_success()

    sid = sessions.create(body.username, dek)
    response.set_cookie(
        key=config.SESSION_COOKIE, value=sid,
        httponly=True, secure=False, samesite="strict",  # localhost http
        path="/",
    )
    log(conn, "auth.login", actor=body.username, source_ip=client_ip(request))
    return {"ok": True, "username": body.username,
            "idle_lock_minutes": config.IDLE_LOCK_MINUTES,
            "clipboard_ttl": config.CLIPBOARD_TTL,
            "reveal_ttl": config.REVEAL_TTL}


@router.post("/lock")
def lock(request: Request, session=Depends(get_session)):
    """Explicitly lock: drop the DEK from RAM."""
    conn = get_db()
    actor = getattr(session, "username", "?")
    sid = getattr(session, "sid", None)
    sessions.lock(sid)
    log(conn, "auth.lock", actor=actor, source_ip=client_ip(request))
    return {"locked": True}


@router.post("/reveal")
def open_reveal(body: RevealRequest, request: Request, session=Depends(get_session)):
    """Re-authenticate master password to open a short reveal window.

    Required before password view/copy endpoints return plaintext.
    """
    conn = get_db()
    _enforce_auth_throttle(request, conn)
    user = _user_row(conn, getattr(session, "username", ""))
    if user is None:
        raise HTTPException(401, "Session invalid.")
    if not crypto.verify_master_password(user["verifier"], body.master_password):
        auth_throttle.record_failure()
        log(conn, "auth.reveal_denied", actor=user["username"],
            source_ip=client_ip(request))
        raise HTTPException(401, "Invalid credentials.")
    auth_throttle.record_success()
    sessions.open_reveal(session.sid, config.REVEAL_TTL)
    log(conn, "auth.reveal_opened", actor=user["username"],
        source_ip=client_ip(request),
        detail=f"reveal_ttl={config.REVEAL_TTL}s")
    return {"reveal_open": True, "ttl": config.REVEAL_TTL}


@router.get("/me")
def me(session=Depends(get_session)):
    return {"username": session.username,
            "reveal_open": sessions.reveal_open(session.sid),
            "reveal_ttl": config.REVEAL_TTL}


class ChangeMasterBody(BaseModel):
    current_master_password: str
    new_master_password: str = Field(min_length=10, max_length=512)


@router.post("/change-master-password")
def change_master_password(body: ChangeMasterBody, request: Request,
                           session=Depends(get_session)):
    """Change the master password.

    Security:
      * Requires an active session AND the CURRENT master password (re-auth).
      * Never stores the raw password; only a new Argon2id verifier + a DEK
        re-wrapped under a freshly derived KEK.
      * Existing encrypted rows stay valid (the DEK itself is unchanged).
      * Neither old nor new password is logged.
    """
    conn = get_db()
    _enforce_auth_throttle(request, conn)
    user = _user_row(conn, getattr(session, "username", ""))
    if user is None:
        raise HTTPException(401, "Session invalid.")

    if not crypto.verify_master_password(user["verifier"], body.current_master_password):
        auth_throttle.record_failure()
        log(conn, "auth.change_master_failed", actor=user["username"],
            detail="current pw wrong", source_ip=client_ip(request))
        raise HTTPException(401, "Current master password is incorrect.")
    auth_throttle.record_success()

    # Unwrap the DEK with the old KEK, then re-wrap with a new KEK + salt.
    old_kek = crypto.derive_kek(body.current_master_password,
                               bytes(user["kdf_salt"]))
    try:
        dek = crypto.unwrap_dek(old_kek, bytes(user["wrapped_dek"]))
    except Exception:
        _zero(old_kek)
        raise HTTPException(500, "Could not re-key the vault (key mismatch).")
    _zero(old_kek)

    new_salt = crypto.gen_salt(16)
    new_kek = crypto.derive_kek(body.new_master_password, new_salt)
    new_wrapped = crypto.wrap_dek(new_kek, dek)
    new_verifier = crypto.hash_master_password(body.new_master_password)
    _zero(new_kek); _zero(dek)

    conn.execute(
        "UPDATE users SET verifier=?, kdf_salt=?, wrapped_dek=?, updated_at=? WHERE id=?",
        (new_verifier, new_salt, new_wrapped, now_iso(), user["id"]),
    )
    conn.commit()
    log(conn, "auth.change_master", actor=user["username"],
        source_ip=client_ip(request))  # no values
    return {"ok": True, "message": "Master password changed. Your saved secrets are intact."}


def _zero(b: bytes) -> None:
    try:
        a = bytearray(b)
        for i in range(len(a)):
            a[i] = 0
    except Exception:
        pass
