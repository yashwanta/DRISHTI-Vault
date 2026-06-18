"""Audit logging — records sensitive ACTIONS, never secret VALUES.

Auditable actions (examples):
  auth.setup, auth.login, auth.lock, auth.reveal_opened
  credential.view, credential.copy, credential.create, credential.edit,
  credential.delete, credential.rotate
  asset.create, asset.edit, asset.delete
  site.create, site.edit, site.delete
  network.create, network.edit, network.delete
  changelog.create, changelog.delete
  import.excel, import.excel_secrets_confirm
  backup.export, backup.restore
"""
from __future__ import annotations

import sqlite3

from .db import now_iso


def log(conn: sqlite3.Connection, action: str, *,
        actor: str = "user", target_type: str | None = None,
        target_id: int | None = None, detail: str | None = None,
        source_ip: str | None = None) -> None:
    """Append an audit event. `detail` must be metadata only — NO secrets."""
    conn.execute(
        "INSERT INTO audit_log(event_ts, actor, action, target_type, target_id, "
        "detail, source_ip) VALUES (?,?,?,?,?,?,?)",
        (now_iso(), actor, action, target_type, target_id,
         _safe_detail(detail), source_ip),
    )
    conn.commit()


def _safe_detail(detail: str | None) -> str | None:
    if detail is None:
        return None
    # Hard cap length; never allow giant payloads.
    if len(detail) > 500:
        detail = detail[:500]
    return detail
