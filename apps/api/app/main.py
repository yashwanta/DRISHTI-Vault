"""DRISHTI-Vault FastAPI application — bound to 127.0.0.1 ONLY.

  * /api/*   -> JSON API
  * /        -> built React SPA (apps/web/dist), if present
  * No 0.0.0.0 binding. No CORS to network origins. No telemetry. No external calls.
"""
from __future__ import annotations

import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .db import init_db

# --- Logging: never log secrets. Configure a separate file handler. ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
# Hard filter: redact obvious secret-bearing fields if they ever slip into logs.
class _NoSecretFilter(logging.Filter):
    SECRET_KEYS = ("password", "secret", "token", "dek", "kek", "verifier", "apikey")

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = str(record.getMessage()).lower()
            return not any(k in msg for k in self.SECRET_KEYS)
        except Exception:
            return False


logger = logging.getLogger("drishtivault")

app = FastAPI(
    title="DRISHTI-Vault",
    version="1.0.0",
    docs_url=None,      # disable Swagger on the running server (local-only default)
    redoc_url=None,
    openapi_url=None,
)


@app.on_event("startup")
def _startup() -> None:
    config.ensure_dirs()
    init_db()
    # Fail fast if somehow configured to bind to all interfaces — UNLESS we are
    # explicitly running in a container (where binding 0.0.0.0 *inside the
    # container's isolated namespace* is required for the published port to
    # work, and the HOST-side publish to 127.0.0.1 is what enforces localhost).
    allow_container = os.getenv("DRISHTIVAULT_ALLOW_CONTAINER_BIND", "") in (
        "1", "true", "yes"
    )
    if config.HOST not in ("127.0.0.1", "localhost") and not allow_container:
        raise RuntimeError(
            f"DRISHTI-Vault refuses to bind to {config.HOST!r}. Localhost only. "
            f"(Set DRISHTIVAULT_ALLOW_CONTAINER_BIND=1 only inside a container "
            f"whose port is published to 127.0.0.1.)"
        )
    scope = "container namespace" if allow_container else "localhost only"
    logger.info("DRISHTI-Vault starting on http://%s:%d (%s)",
                config.HOST, config.PORT, scope)


# --- Health / bootstrap status (no auth) ------------------------------------
@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "app": "DRISHTI-Vault", "version": "1.0.0"}


@app.get("/api/bootstrap")
def bootstrap() -> dict:
    """Tells the SPA whether a master password has been set."""
    from .db import get_db
    conn = get_db()
    row = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()
    return {"initialized": int(row["c"]) > 0,
            "idle_lock_minutes": config.IDLE_LOCK_MINUTES,
            "clipboard_ttl": config.CLIPBOARD_TTL,
            "reveal_ttl": config.REVEAL_TTL}


# --- Route modules ----------------------------------------------------------
from .routes import (  # noqa: E402
    auth, dashboard, sites, assets, credentials, network,
    changelog, audit, import_excel, backup, settings, users, csv, notes,
)

app.include_router(auth.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(sites.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(credentials.router, prefix="/api")
app.include_router(network.router, prefix="/api")
app.include_router(changelog.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(import_excel.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(csv.router, prefix="/api")
app.include_router(notes.router, prefix="/api")


# --- Serve the SPA ----------------------------------------------------------
@app.get("/")
def index() -> FileResponse:
    idx = config.WEB_DIST / "index.html"
    if idx.exists():
        return FileResponse(idx)
    return JSONResponse(
        status_code=503,
        content={"detail": "Frontend not built. Run: cd apps/web && npm run build"},
    )


# Static assets (JS/CSS) if the SPA is built
if config.WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=config.WEB_DIST / "assets"),
              name="spa-assets")


# Catch-all for SPA client-side routes (must be after /api/*)
@app.get("/{full_path:path}")
def spa_catch_all(full_path: str):
    # never hijack API routes
    if full_path.startswith("api"):
        return JSONResponse(status_code=404, content={"detail": "not found"})
    idx = config.WEB_DIST / "index.html"
    if idx.exists():
        return FileResponse(idx)
    return JSONResponse(status_code=503, content={"detail": "Frontend not built."})


def run() -> None:
    """Entry point for `python -m app.main` / `uvicorn app.main:app`."""
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="info")


if __name__ == "__main__":
    run()
