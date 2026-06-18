# syntax=docker
# DRISHTI-Vault container image
#
# Two-stage build:
#   stage 1 (web-build): Node + npm -> builds the React SPA into /web/dist
#   stage 2 (runtime)  : slim Python -> installs backend deps, serves SPA + API
#
# The container listens on 127.0.0.1:7788 ONLY. Mount ./data, ./backups,
# ./logs from the host so the encrypted DB and backups persist.

# ---- Stage 1: build the frontend -------------------------------------------
FROM node:20-bookworm-slim AS web-build
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY apps/web ./
RUN npm run build

# ---- Stage 2: runtime -------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

# Runtime deps: argon2 / cryptography need build wheels; on slim we install
# the libraries they bundle. The wheels from PyPI are self-contained, so a
# plain pip install is enough for the release wheels.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libffi8 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/drishtivault

# Install backend deps first (better layer caching)
COPY apps/api/requirements.txt /srv/drishtivault/apps/api/requirements.txt
RUN pip install --no-cache-dir -r /srv/drishtivault/apps/api/requirements.txt

# Copy backend source
COPY apps/api /srv/drishtivault/apps/api

# Copy the built SPA from stage 1
COPY --from=web-build /web/dist /srv/drishtivault/apps/web/dist

# Copy docs / import workbook (import dir mounted read-only-friendly)
COPY docs /srv/drishtivault/docs
COPY README.md /srv/drishtivault/README.md

# Volumes that the host should mount (encrypted DB, backups, logs)
VOLUME ["/srv/drishtivault/data", "/srv/drishtivault/backups/encrypted", "/srv/drishtivault/logs"]

ENV DRISHTIVAULT_HOST=0.0.0.0 \
    DRISHTIVAULT_ALLOW_CONTAINER_BIND=1 \
    DRISHTIVAULT_PORT=7788 \
    DRISHTIVAULT_DATA_DIR=/srv/drishtivault/data \
    DRISHTIVAULT_DB_PATH=/srv/drishtivault/data/drishtivault.db \
    DRISHTIVAULT_BACKUP_DIR=/srv/drishtivault/backups/encrypted \
    DRISHTIVAULT_LOG_DIR=/srv/drishtivault/logs \
    PYTHONUNBUFFERED=1

EXPOSE 7788

# ---- Run as a non-root user (least privilege) ------------------------------
RUN groupadd --system --gid 1001 drishti \
 && useradd  --system --uid 1001 --gid drishti --no-create-home --home-dir /srv/drishtivault drishti \
 && chown -R drishti:drishti /srv/drishtivault
USER 1001:1001

# Health check hits the in-container port. (OCI format ignores HEALTHCHECK at
# runtime under Podman, but it documents intent and works under Docker/Moby.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; \
  sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:7788/api/health',timeout=3).status==200 else 1)"

# Bind 0.0.0.0 INSIDE the container's isolated namespace. Network isolation +
# the host-side publish (-p 127.0.0.1:7788:7788) is what keeps it localhost-only.
WORKDIR /srv/drishtivault/apps/api
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7788"]
