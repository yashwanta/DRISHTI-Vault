# Running DRISHTI-Vault in Podman

DRISHTI-Vault ships as a container image and runs as a container named
**`DRISHTIVault`**, reachable at **http://127.0.0.1:7788** only.

> ⚠ **Local vault only. Do not expose to network.** The container's port is
> published to the host's `127.0.0.1` only — it is not reachable from the LAN.

## Prerequisites

- Podman 5.x with a running machine:
  ```powershell
  podman machine list          # should show "Currently running"
  podman machine start         # if not running
  ```

## Quick start

```powershell
cd C:\DRISHTI\DRISHTI-Vault
powershell -ExecutionPolicy Bypass -File scripts\podman-drishtivault.ps1
```

The helper builds the image `drishti-vault:latest`, starts the container
`DRISHTIVault`, and opens http://127.0.0.1:7788.

## What the container does

| Aspect | Value |
|--------|-------|
| Container name | `DRISHTIVault` |
| Image | `drishti-vault:latest` (Node + Go build stages → distroless runtime, ~33 MB) |
| Port | `127.0.0.1:7788:7788` (host loopback only — never `0.0.0.0`) |
| Data volume | host `data\` → `/srv/drishtivault/data` (the encrypted SQLite DB) |
| Backup volume | host `backups\encrypted\` → `/srv/drishtivault/backups/encrypted` |
| Log volume | host `logs\` → `/srv/drishtivault/logs` |
| Restart policy | `unless-stopped` |

The encrypted database, encrypted backups, and logs are **bind-mounted from the
host**, so they persist across container rebuilds and restarts. The container
itself is stateless aside from app code.

## Container hardening

The container runs under least-privilege by default (set both in the image and
in the run flags):

- **Non-root user** `uid=65532(nonroot)` — the app never runs as root.
- **Read-only root filesystem** (`--read-only`) — app code is immutable; only
  the mounted `data`, `backups/encrypted`, `logs`, and a small `/tmp` tmpfs are
  writable.
- **All Linux capabilities dropped** (`--cap-drop=ALL`) — no privileged syscalls.
- **No privilege escalation** (`--security-opt no-new-privileges`).
- **Resource limits** — `--memory=512m`, `--cpus=1.0`, `--pids-limit=200` to
  contain runaway resource use / DoS.
- **Loopback-only publish** — `-p 127.0.0.1:7788:7788` (never the LAN).

These flags live in `scripts/podman-drishtivault.ps1`. Verify at runtime:

```powershell
podman inspect DRISHTIVault --format 'user={{.Config.User}} cap_add={{.HostConfig.CapAdd}} security_opt={{.HostConfig.SecurityOpt}} readonly={{.HostConfig.ReadonlyRootfs}}'
# expect: user=1001:1001 cap_add=[] security_opt=[no-new-privileges] readonly=true
```

## Binding model (why 0.0.0.0 inside is safe)

The app binds `0.0.0.0` **inside the container's isolated network namespace**
(`DRISHTIVAULT_ALLOW_CONTAINER_BIND=1`), which is required for Podman's
published-port proxy to reach it. Network isolation + the **host-side publish
`-p 127.0.0.1:7788:7788`** is what enforces localhost-only access. Outside the
host loopback the service is unreachable — verified by checking that the host's
LAN IP returns no connection.

For **bare-metal / direct uvicorn** runs (not in a container), the app still
refuses to bind anything other than `127.0.0.1`.

## Manual commands

```powershell
# Build
podman build -t drishti-vault:latest -f Containerfile .

# Run (note MSYS_NO_PATHCONV=1 avoids Git-Bash mangling Windows paths)
$env:MSYS_NO_PATHCONV=1
podman run -d --name DRISHTIVault `
  -p 127.0.0.1:7788:7788 `
  -v "${PWD}\data:/srv/drishtivault/data:Z" `
  -v "${PWD}\backups\encrypted:/srv/drishtivault/backups/encrypted:Z" `
  -v "${PWD}\logs:/srv/drishtivault/logs:Z" `
  --restart unless-stopped `
  drishti-vault:latest

# Status / logs / stop
podman ps --filter name=DRISHTIVault
podman logs -f DRISHTIVault
podman stop DRISHTIVault ; podman rm DRISHTIVault
```

## Backups inside the container

Encrypted backups (`.drishtivaultbackup`) are written to the mounted
`backups/encrypted` volume, so they land on the host at
`C:\DRISHTI\DRISHTI-Vault\backups\encrypted`. Use **Settings → Export Encrypted
Backup** in the UI (two-gate: Master Password + Vault Backup Password).

## Updating

```powershell
git pull        # if versioned
podman rm -f DRISHTIVault
scripts\podman-drishtivault.ps1    # rebuilds + reruns; data/backups persist
```
