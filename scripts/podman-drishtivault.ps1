# DRISHTI-Vault — Podman build + run helper
#
# Builds the image and runs the container named "DRISHTIVault", bound to
# 127.0.0.1:7788 ONLY (never exposed to the network). The encrypted database,
# backups, and logs are bind-mounted from the host so they persist across
# container restarts.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\podman-drishtivault.ps1            # build + run
#   powershell -ExecutionPolicy Bypass -File scripts\podman-drishtivault.ps1 -Stop      # stop + remove
#   powershell -ExecutionPolicy Bypass -File scripts\podman-drishtivault.ps1 -Logs      # tail logs
#
# Then open http://127.0.0.1:7788

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Image = "drishti-vault:latest"
$Container = "DRISHTIVault"
$DataDir   = Join-Path $Root "data"
$BackupDir = Join-Path $Root "backups\encrypted"
$LogDir    = Join-Path $Root "logs"

foreach ($d in @($DataDir, $BackupDir, $LogDir)) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}

# ---- Stop / remove ----
if ($args -contains "-Stop") {
    Write-Host "Stopping $Container ..." -ForegroundColor Cyan
    podman rm -f $Container 2>$null | Out-Null
    Write-Host "Stopped and removed $Container." -ForegroundColor Green
    exit 0
}

# ---- Logs ----
if ($args -contains "-Logs") {
    podman logs -f $Container
    exit 0
}

# ---- Build ----
Write-Host "Building image $Image ..." -ForegroundColor Cyan
# Use the Windows path form Podman expects; -f points at the Containerfile.
Push-Location $Root
podman build -t $Image -f Containerfile .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Image build failed." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# ---- Remove any stale container, then run ----
podman rm -f $Container 2>$null | Out-Null

# Convert host dirs to the Windows path style Podman bind-mount wants.
$MountData   = "$($DataDir.Replace('\','/')):/srv/drishtivault/data:Z"
$MountBackup = "$($BackupDir.Replace('\','/')):/srv/drishtivault/backups/encrypted:Z"
$MountLogs   = "$($LogDir.Replace('\','/')):/srv/drishtivault/logs:Z"

Write-Host "Starting container $Container on http://127.0.0.1:7788 ..." -ForegroundColor Cyan
# Hardened run:
#   --user 1001:1001             non-root (also set in image; belt & suspenders)
#   --read-only                  immutable root filesystem
#   --tmpfs /tmp                 scratch the app may need
#   --cap-drop=ALL               drop every Linux capability (no privileged syscalls)
#   --security-opt no-new-privileges   forbid privilege escalation
#   --memory / --cpus            resource limits (DoS containment)
#   -p 127.0.0.1:7788            host loopback only (never the LAN)
podman run -d `
    --name $Container `
    --user 65532:65532 `
    -p 127.0.0.1:7788:7788 `
    -v $MountData `
    -v $MountBackup `
    -v $MountLogs `
    --read-only `
    --tmpfs /tmp:rw,size=8m,mode=1777 `
    --cap-drop=ALL `
    --security-opt no-new-privileges `
    --memory=512m `
    --cpus=1.0 `
    --pids-limit=200 `
    --restart unless-stopped `
    $Image

if ($LASTEXITCODE -ne 0) {
    Write-Host "Container failed to start." -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 4
Write-Host ""
Write-Host "  DRISHTIVault is running: http://127.0.0.1:7788" -ForegroundColor Green
Write-Host "  Stop:  scripts\podman-drishtivault.ps1 -Stop" -ForegroundColor DarkGray
Write-Host "  Logs:  scripts\podman-drishtivault.ps1 -Logs" -ForegroundColor DarkGray
Start-Process "http://127.0.0.1:7788"
