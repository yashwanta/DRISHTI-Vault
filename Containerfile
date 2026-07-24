# syntax=docker
# DRISHTI-Vault container image
#
# Three-stage build:
#   stage 1 (web-build): Node + npm -> builds the React SPA into /web/dist
#   stage 2 (go-build) : Go -> builds the static API/server executable
#   stage 3 (runtime)  : distroless -> serves SPA + API without Python
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

# ---- Stage 2: compile the Go backend ----------------------------------------
FROM golang:1.25-bookworm AS go-build
WORKDIR /src
ENV CGO_ENABLED=1
COPY apps/api-go/go.mod apps/api-go/go.sum ./
RUN go mod download
COPY apps/api-go ./
RUN test "$(go env CGO_ENABLED)" = "1" \
 && go build -trimpath -ldflags="-s -w" -o /out/drishtivault ./cmd/server

# ---- Stage 3: minimal runtime ----------------------------------------------
FROM gcr.io/distroless/base-debian12:nonroot AS runtime
WORKDIR /srv/drishtivault
COPY --from=go-build /out/drishtivault /srv/drishtivault/drishtivault

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
    DRISHTIVAULT_WEB_DIST=/srv/drishtivault/apps/web/dist

EXPOSE 7788

# Distroless nonroot runs as uid/gid 65532.
USER 65532:65532

# The image has no shell or curl; orchestration probes /api/health externally.
HEALTHCHECK NONE

# Bind 0.0.0.0 INSIDE the container's isolated namespace. Network isolation +
# the host-side publish (-p 127.0.0.1:7788:7788) is what keeps it localhost-only.
ENTRYPOINT ["/srv/drishtivault/drishtivault"]
