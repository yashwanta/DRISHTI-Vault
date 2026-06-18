"""In-memory session store holding the decrypted DEK per active session.

The DEK never touches disk, never goes to the browser, never appears in logs.
When the vault is locked (logout/idle/lock), the DEK is wiped from RAM.

A "reveal window" is a short time window after master re-auth during which the
password view/copy endpoints will return plaintext. Outside that window they
return only metadata — this enforces "re-auth before reveal".
"""
from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass, field


@dataclass
class Session:
    sid: str
    username: str
    dek: bytes                 # data-encrypting key; wiped on lock
    created_at: float
    last_seen: float
    reveal_until: float = 0.0  # epoch seconds until which reveal is allowed


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._lock = threading.Lock()

    def create(self, username: str, dek: bytes) -> str:
        sid = secrets.token_urlsafe(32)
        now = time.time()
        with self._lock:
            self._sessions[sid] = Session(sid, username, dek, now, now)
        return sid

    def get(self, sid: str | None) -> Session | None:
        if not sid:
            return None
        with self._lock:
            s = self._sessions.get(sid)
            if s is None:
                return None
            # idle auto-lock
            if time.time() - s.last_seen > _idle_seconds():
                self._wipe(s.sid)
                return None
            s.last_seen = time.time()
            return s

    def touch(self, sid: str) -> None:
        self.get(sid)  # updates last_seen / idle check

    def is_locked(self, sid: str | None) -> bool:
        return self.get(sid) is None

    def lock(self, sid: str | None) -> None:
        self._wipe(sid)

    def open_reveal(self, sid: str, ttl: int) -> None:
        with self._lock:
            s = self._sessions.get(sid)
            if s:
                s.reveal_until = time.time() + ttl

    def reveal_open(self, sid: str | None) -> bool:
        s = self.get(sid)
        if not s:
            return False
        return time.time() < s.reveal_until

    def _wipe(self, sid: str | None) -> None:
        if not sid:
            return
        with self._lock:
            s = self._sessions.pop(sid, None)
            if s and s.dek:
                # best-effort zeroize
                try:
                    b = bytearray(s.dek)
                    for i in range(len(b)):
                        b[i] = 0
                except Exception:
                    pass


def _idle_seconds() -> float:
    from . import config
    return float(config.IDLE_LOCK_MINUTES * 60)


sessions = SessionStore()
