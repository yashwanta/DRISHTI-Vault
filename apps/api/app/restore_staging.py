"""In-memory staging for a decrypted backup payload between preview and commit.

The decrypted payload is held ONLY in RAM (never written to disk, never logged).
A short-lived, unguessable token binds it to the session that created it, so a
preview can be confirmed only by the same authenticated session and only while
it is still valid. Tokens auto-expire after STAGE_TTL seconds.

Nothing here is a secret in the password/key sense, but it does contain the
DEK-encrypted ciphertext of every vault row, so we keep it ephemeral.
"""
from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass

STAGE_TTL = 300  # seconds a preview remains confirmable


@dataclass
class _Stage:
    sid: str
    payload: dict
    expires_at: float


class _RestoreStageStore:
    def __init__(self) -> None:
        self._items: dict[str, _Stage] = {}
        self._lock = threading.Lock()

    def put(self, sid: str, payload: dict) -> str:
        token = secrets.token_urlsafe(24)
        with self._lock:
            self._evict()
            self._items[token] = _Stage(sid, payload, time.time() + STAGE_TTL)
        return token

    def take(self, sid: str, token: str) -> dict | None:
        """Consume and return the staged payload if it belongs to `sid`."""
        with self._lock:
            self._evict()
            st = self._items.pop(token, None)
        if st is None or st.sid != sid or time.time() > st.expires_at:
            return None
        return st.payload

    def _evict(self) -> None:
        now = time.time()
        for tok in [k for k, v in self._items.items() if v.expires_at <= now]:
            self._items.pop(tok, None)


staged_restores = _RestoreStageStore()
