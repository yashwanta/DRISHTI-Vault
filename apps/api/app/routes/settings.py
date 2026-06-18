"""Settings: read/adjust local operational knobs. No secrets handled here."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import config
from ..deps import get_session

router = APIRouter(tags=["settings"])


class IdleLockIn(BaseModel):
    idle_lock_minutes: int


@router.get("/settings")
def get_settings(session=Depends(get_session)):
    return {
        "host": config.HOST,
        "port": config.PORT,
        "idle_lock_minutes": config.IDLE_LOCK_MINUTES,
        "clipboard_ttl": config.CLIPBOARD_TTL,
        "reveal_ttl": config.REVEAL_TTL,
        "db_path": str(config.DB_PATH),
        "backup_dir": str(config.BACKUP_DIR),
    }
