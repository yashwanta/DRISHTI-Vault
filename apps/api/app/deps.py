"""FastAPI dependencies: get DB, get current session, require unlock/reveal,
master-password re-authentication, and restore-lockout state."""
from __future__ import annotations

import sqlite3
import threading
import time
from fastapi import Cookie, Depends, HTTPException, Request, status

from . import config, crypto
from .db import get_db
from .sessions import sessions


def db() -> sqlite3.Connection:
    return get_db()


def get_session(request: Request,
                sid: str | None = Cookie(default=None, alias=config.SESSION_COOKIE)
                ) -> object:
    s = sessions.get(sid)
    if s is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vault is locked. Master password required.",
        )
    return s


def require_reveal(session=Depends(get_session)) -> object:
    if not sessions.reveal_open(getattr(session, "sid", None)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Reveal window closed. Re-enter master password to view/copy.",
        )
    return session


def client_ip(request: Request) -> str:
    # Localhost only; recorded for completeness.
    return request.client.host if request and request.client else "127.0.0.1"


# ---------------------------------------------------------------------------
# Role helpers / dependencies
# ---------------------------------------------------------------------------

def current_user_row(session=Depends(get_session)):
    """Return the users row for the session (or None)."""
    conn = get_db()
    return conn.execute(
        "SELECT * FROM users WHERE id=?", (session.user_id,)
    ).fetchone()


def require_admin(request: Request, session=Depends(get_session)):
    """super_admin OR global_admin (can manage users, but only super resets pw)."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM users WHERE id=?", (session.user_id,)
    ).fetchone()
    if row is None or row["role"] not in ("super_admin", "global_admin"):
        log_audit(request, session, "auth.forbidden",
                  detail=f"role={row['role'] if row else 'none'}")
        raise HTTPException(status_code=403, detail="Admin role required.")
    return row


def require_super_admin(request: Request, session=Depends(get_session)):
    """super_admin only (the reserved Yash identity)."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM users WHERE id=?", (session.user_id,)
    ).fetchone()
    if row is None or row["role"] != "super_admin":
        log_audit(request, session, "auth.forbidden",
                  detail="super-admin required")
        raise HTTPException(status_code=403,
                            detail="Super-admin role required.")
    return row


def log_audit(request: Request, session, action: str, detail: str | None = None,
              target_type: str | None = None, target_id: int | None = None):
    """Convenience audit wrapper for deps-layer rejections."""
    from .audit import log as _log
    conn = get_db()
    _log(conn, action, actor=getattr(session, "username", None),
         target_type=target_type, target_id=target_id, detail=detail,
         source_ip=client_ip(request))


# ---------------------------------------------------------------------------
# Master-password re-authentication
#
# Required for: reveal/copy (via the reveal window), export, restore, and
# changing security settings (e.g. Change Master Password). A logged-in session
# alone is NEVER enough for these sensitive actions.
# ---------------------------------------------------------------------------

def verify_master_for_session(conn: sqlite3.Connection, session,
                              master_password: str) -> None:
    """Re-verify the master password for the currently-authenticated user.

    Raises 401 on mismatch. This is the "second gate" for sensitive actions.
    """
    user = conn.execute(
        "SELECT * FROM users WHERE username=? COLLATE NOCASE",
        (getattr(session, "username", ""),),
    ).fetchone()
    if user is None or not crypto.verify_master_password(
        user["verifier"], master_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Master password incorrect.",
        )


# ---------------------------------------------------------------------------
# Generic attempt throttle / lockout.
#
# Used by:
#   * restore_lockout      — 5 failed backup-password attempts -> 5 min cooldown
#   * auth_throttle        — 5 failed master-password attempts at login/setup/
#                            reveal/change-master -> 5 min cooldown
#
# State is in-memory and process-scoped: closing/restarting the app clears it.
# ---------------------------------------------------------------------------

class AttemptThrottle:
    MAX_ATTEMPTS = 5
    COOLDOWN_SECONDS = 5 * 60

    def __init__(self) -> None:
        self._fails: int = 0
        self._lockout_until: float = 0.0
        self._lock = threading.Lock()

    def is_locked(self) -> bool:
        with self._lock:
            return time.time() < self._lockout_until

    def seconds_remaining(self) -> float:
        with self._lock:
            return max(0.0, self._lockout_until - time.time())

    def record_failure(self) -> None:
        with self._lock:
            self._fails += 1
            if self._fails >= self.MAX_ATTEMPTS:
                self._lockout_until = time.time() + self.COOLDOWN_SECONDS

    def record_success(self) -> None:
        with self._lock:
            self._fails = 0
            self._lockout_until = 0.0


# Backward-compatible alias for the existing restore lockout.
class RestoreLockout(AttemptThrottle):
    pass


restore_lockout = RestoreLockout()
auth_throttle = AttemptThrottle()

