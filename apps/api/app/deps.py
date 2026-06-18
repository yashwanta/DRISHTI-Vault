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

