# DRISHTI-Vault - start backend + open browser (restart-aware).
# Serves the built SPA and the API from a single localhost port (7788).
#
# Restart-aware: if a server is already listening on :7788 (typically a STALE one
# started before a code change (e.g. a new API router was added), it is stopped
# first so you always get CURRENT code. Without this, backend changes silently
# 404 until you manually restart. The SPA is also rebuilt automatically when its
# source is newer than the last build.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\start-drishtivault.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\start-drishtivault.ps1 -NoRestart
#       (-NoRestart: if :7788 is already in use, reuse that server instead of
#        restarting it. The running server may then be serving stale code.)

param([switch]$NoRestart)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$ApiDir  = Join-Path $Root "apps\api-go"
$WebDir  = Join-Path $Root "apps\web"
$Dist    = Join-Path $WebDir "dist"
$Index   = Join-Path $Dist "index.html"
$Url     = "http://127.0.0.1:7788"
$Port    = 7788

# --- helpers ----------------------------------------------------------------

function Get-PortOwner($p) {
    # PID of the process listening on TCP port $p, or 0 if the port is free.
    try {
        $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        if ($c) { return [int]($c.OwningProcess | Select-Object -First 1) }
    } catch {}
    return 0
}

function Wait-PortFree($p, $timeoutS = 10) {
    $deadline = (Get-Date).AddSeconds($timeoutS)
    while ((Get-Date) -lt $deadline) {
        if ((Get-PortOwner $p) -eq 0) { return $true }
        Start-Sleep -Milliseconds 300
    }
    return $false
}

function Wait-Health($u, $timeoutS = 25) {
    # Poll /api/health until the new server answers (or timeout).
    $deadline = (Get-Date).AddSeconds($timeoutS)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri "$u/api/health" -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { return $true }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# --- 1. Build the SPA if missing OR if source is newer than the build --------
$needBuild = $false
if (-not (Test-Path $Index)) {
    $needBuild = $true
    Write-Host "  Frontend not built yet." -ForegroundColor Yellow
} else {
    $newestSrc = Get-ChildItem -Path (Join-Path $WebDir "src") -Recurse -File -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($newestSrc -and $newestSrc.LastWriteTime -gt (Get-Item $Index).LastWriteTime) {
        $needBuild = $true
        Write-Host "  Frontend source changed since last build." -ForegroundColor Yellow
    }
}
if ($needBuild) {
    Write-Host "  Building SPA..." -ForegroundColor Yellow
    Push-Location $WebDir
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { Write-Host "Build failed." -ForegroundColor Red; exit 1 }
    Pop-Location
    Write-Host "  Build complete." -ForegroundColor Green
}

# --- 2. Stop any existing server on :7788 so we serve current code -----------
$owner = Get-PortOwner $Port
$reuseExisting = $false
if ($owner -gt 0) {
    if ($NoRestart) {
        Write-Host "  Server already running on :$Port (PID $owner). -NoRestart set; reusing it." -ForegroundColor DarkYellow
        $reuseExisting = $true
    } else {
        $proc = Get-Process -Id $owner -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.ProcessName } else { "PID $owner" }
        Write-Host "  Found existing server on :$Port ($name, PID $owner)." -ForegroundColor Yellow
        Write-Host "  Stopping it so the latest code is loaded..." -ForegroundColor Yellow
        try {
            Stop-Process -Id $owner -Force -ErrorAction Stop
        } catch {
            Write-Host "  Could not stop PID $owner automatically. Stop it manually and re-run." -ForegroundColor Red
            exit 1
        }
        if (-not (Wait-PortFree $Port 10)) {
            Write-Host "  Port $Port did not free up after stopping the server." -ForegroundColor Red
            exit 1
        }
        Write-Host "  Stopped. Starting fresh." -ForegroundColor Green
    }
}

# --- 3. Banner --------------------------------------------------------------
Write-Host ""
Write-Host "  Starting DRISHTI-Vault on $Url  (localhost only)" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C in the SERVER window to stop." -ForegroundColor DarkGray
Write-Host ""

# --- 4. Launch the backend in a new, titled window (skip if reusing) --------
if (-not $reuseExisting) {
    Set-Location $ApiDir
    $ServerTitle = "DVault-CC  -  DRISHTI-Vault server (127.0.0.1:7788)"
    $GoCache = Join-Path $ApiDir ".gocache"
    $GoModCache = Join-Path $ApiDir ".gomodcache"
    $GoExe = Join-Path $ApiDir "drishtivault.exe"
    $RunCommand = if (Test-Path $GoExe) { "`"$GoExe`"" } else { "go run ./cmd/server" }
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k title $ServerTitle & set GOCACHE=$GoCache&& set GOMODCACHE=$GoModCache&& $RunCommand" `
        -WindowStyle Normal
}

$Host.UI.RawUI.WindowTitle = "DVault-CC  -  DRISHTI-Vault launcher"

# --- 5. Wait until the server actually answers, then open the browser -------
if (Wait-Health $Url 25) {
    Start-Process $Url
    Write-Host "  DRISHTI-Vault running at $Url" -ForegroundColor Green
} else {
    Write-Host "  Server did not respond at $Url within timeout - check the server window for errors." -ForegroundColor Red
}
