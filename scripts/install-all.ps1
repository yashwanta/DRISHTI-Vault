# DRISHTI-Vault - all-in-one installer (Podman container path).
#
# Turns a Windows machine into a running DRISHTI-Vault container on
# http://127.0.0.1:7788, installing Podman if needed. Go and Node run only
# inside the image build stages. Idempotent: safe to re-run.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\install-all.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install-all.ps1 -Force        # rebuild image
#   powershell -ExecutionPolicy Bypass -File scripts\install-all.ps1 -SkipLaunch   # don't open browser
#
# Admin is required ONLY if a prerequisite must be installed. If all prereqs are
# already present the script runs non-elevated. When elevation is needed, the
# script re-launches itself elevated.

param([switch]$Force, [switch]$SkipLaunch)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path   # stringify (PathInfo breaks COM setters)
Set-Location $Root

# --- output helpers ---------------------------------------------------------
function Header($t) { Write-Host ""; Write-Host "==== $t ====" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK] $t" -ForegroundColor Green }
function Info($t)   { Write-Host "  ..  $t" -ForegroundColor DarkGray }
function Warn($t)   { Write-Host "  [!!] $t" -ForegroundColor Yellow }
function Fail($t)   { Write-Host "  [XX] $t" -ForegroundColor Red; exit 1 }

# --- tool detection ---------------------------------------------------------
function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Refresh-Path {
    # Re-read Machine + User PATH from the registry so tools just installed in
    # THIS process are visible without restarting the shell.
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = ($machine + ";" + $user)
}

# winget package IDs (verified installed on the reference machine).
$Winget = @{
    podman  = "RedHat.Podman-Desktop"
    python  = "Python.Python.3.14"
    node    = "OpenJS.NodeJS.22"
}
# choco package names (fallback).
$Choco = @{
    podman  = "podman-cli"
    python  = "python"
    node    = "nodejs-lts"
}
# Friendly name + manual-download URL shown on total failure.
$Manual = @{
    podman = "https://podman.io/getting-started/installation"
    python = "https://www.python.org/downloads/"
    node   = "https://nodejs.org/"
}

function Install-Tool($key, $cmd) {
    Header "Installing $cmd (missing prerequisite)"
    $done = $false
    if (Test-Command winget) {
        Info "Trying winget ($($Winget[$key]))..."
        & winget install --id $Winget[$key] --exact `
            --accept-source-agreements --accept-package-agreements `
            --silent --disable-interactivity 2>&1 | ForEach-Object { Info $_ }
        Refresh-Path
        if (Test-Command $cmd) { Ok "$cmd installed via winget"; $done = $true }
        else { Warn "winget did not make '$cmd' available." }
    } else { Warn "winget not available." }

    if (-not $done -and (Test-Command choco)) {
        Info "Trying choco ($($Choco[$key]))..."
        & choco install $Choco[$key] -y 2>&1 | ForEach-Object { Info $_ }
        Refresh-Path
        if (Test-Command $cmd) { Ok "$cmd installed via choco"; $done = $true }
        else { Warn "choco did not make '$cmd' available." }
    }

    if (-not $done) {
        Fail "Could not install '$cmd' automatically. Install it manually from $($Manual[$key]), then re-run this script."
    }
}

# --- relaunch elevated if a prereq is missing and we are not admin ----------
$NeedAdmin = -not (Test-Command podman)
$isAdmin   = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
             [Security.Principal.WindowsBuiltInRole]::Administrator)
if ($NeedAdmin -and -not $isAdmin) {
    Warn "A prerequisite must be installed; re-launching as Administrator."
    $args = @()
    if ($Force)       { $args += "-Force" }
    if ($SkipLaunch)  { $args += "-SkipLaunch" }
    Start-Process -FilePath "powershell.exe" `
        -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" $($args -join ' ')" `
        -Verb RunAs -Wait
    exit 0
}

Header "DRISHTI-Vault installer (Podman container)"

# --- prerequisites ----------------------------------------------------------
Header "Check prerequisites"
if (Test-Command podman) { Ok "Podman: $(& podman --version)" }      else { Install-Tool "podman" "podman" }
Ok "All prerequisites present."

# --- Podman machine readiness ----------------------------------------------
Header "Podman machine"
$machineExists = $false
try {
    $ml = & podman machine list 2>&1 | Out-String
    if ($ml -match "podman-machine-default") { $machineExists = $true }
} catch {}

function Ensure-PodmanSocket {
    # Verify the Windows client can reach the machine's API socket (the
    # "not listening on ssh port" failure we debugged). Returns $true if OK.
    try { & podman ps *> $null; return $true } catch { return $false }
}

if (-not $machineExists) {
    Info "No Podman machine found; initializing one (first run takes a minute)..."
    & podman machine init 2>&1 | ForEach-Object { Info $_ }
    if ($LASTEXITCODE -ne 0) { Fail "podman machine init failed." }
    $machineExists = $true
}

if ($machineExists) {
    if (-not (Ensure-PodmanSocket)) {
        Info "Starting Podman machine..."
        & podman machine start 2>&1 | ForEach-Object { Info $_ }
    }
    if (-not (Ensure-PodmanSocket)) {
        Warn "Podman socket not reachable; applying WSL update + restart repair."
        & wsl --update 2>&1 | ForEach-Object { Info $_ }
        & wsl --shutdown 2>&1 | Out-Null
        Start-Sleep -Seconds 5
        & podman machine start 2>&1 | ForEach-Object { Info $_ }
        Start-Sleep -Seconds 5
    }
    if (Ensure-PodmanSocket) { Ok "Podman machine is up and reachable." }
    else { Fail "Podman machine is not reachable after repair. See docs/INSTALL.md troubleshooting." }
} else {
    Fail "Could not establish a Podman machine."
}

# --- preserve existing data on reinstall -----------------------------------
Header "Protect existing data"
$Db = Join-Path $Root "data\drishtivault.db"
if (Test-Path $Db) {
    $stamp = (Get-Date -Format "yyyyMMdd_HHmmss")
    $BackupDir = Join-Path $Root "backups\preinstall_$stamp"
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
    Copy-Item -Path (Join-Path $Root "data\drishtivault.db*") -Destination $BackupDir -Force
    Ok "Existing DB backed up to backups\preinstall_$stamp (preserved on reinstall)."
} else {
    Ok "No existing DB - fresh install."
}

# --- build + run container (reuse the hardened launcher) -------------------
Header "Build image and run container"
$launcher = Join-Path $Root "scripts\podman-drishtivault.ps1"
if ($Force -and (& podman image inspect drishti-vault:latest *> $null)) {
    Info "-Force: removing existing image so it rebuilds."
    & podman rmi -f drishti-vault:latest 2>&1 | Out-Null
}
& powershell -NoProfile -ExecutionPolicy Bypass -File $launcher 2>&1 |
    ForEach-Object { Write-Host "    $_" }
if ($LASTEXITCODE -ne 0) { Fail "Container build/run failed." }

# --- wait for health --------------------------------------------------------
Header "Wait for server"
$Url = "http://127.0.0.1:7788"
$deadline = (Get-Date).AddSeconds(40)
$healthy = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri "$Url/api/health" -TimeoutSec 3 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $healthy = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 700
}
if ($healthy) { Ok "Server is healthy at $Url" } else { Fail "Server did not become healthy in time. Run: scripts\podman-drishtivault.ps1 -Logs" }

# --- verify DB integrity ----------------------------------------------------
try {
    $b = Invoke-RestMethod -Uri "$Url/api/bootstrap" -TimeoutSec 5
    if ($b.initialized) { Ok "Vault DB intact (initialized: true)." }
    else { Ok "Vault ready for first-run master-password setup." }
} catch { Warn "Could not read bootstrap status (non-fatal)." }

# --- create DVault-CC shortcut ---------------------------------------------
Header "Create DVault-CC shortcut"
# COM (WScript.Shell) can throw transiently under $ErrorActionPreference=Stop;
# retry once and surface the real error if it still fails.
$lnkPath = Join-Path $Root "DVault-CC.lnk"
$launcherStr = "$launcher"   # ensure plain strings for COM setters
$rootStr = "$Root"
$shortcutSaved = $false
$lastErr = ""
foreach ($attempt in 1..2) {
    try {
        $ws = New-Object -ComObject WScript.Shell
        $lnk = $ws.CreateShortcut($lnkPath)
        $lnk.TargetPath = "powershell.exe"
        $lnk.Arguments = '-NoExit -ExecutionPolicy Bypass -File "' + $launcherStr + '"'
        $lnk.WorkingDirectory = $rootStr
        $lnk.IconLocation = "shell32.dll,13"
        $lnk.Description = "DVault-CC - start DRISHTI-Vault CONTAINER on http://127.0.0.1:7788"
        $lnk.Save()
        $shortcutSaved = $true
        break
    } catch {
        $lastErr = $_.Exception.Message
        Start-Sleep -Milliseconds 500
    }
}
if ($shortcutSaved) {
    Ok "Shortcut created: DVault-CC.lnk (double-click to start)."
} else {
    Warn "Could not create shortcut automatically (non-fatal): $lastErr"
    Info "You can still start the app with: powershell -ExecutionPolicy Bypass -File scripts\podman-drishtivault.ps1"
}

# --- launch browser ---------------------------------------------------------
if (-not $SkipLaunch) {
    Start-Process $Url
    Info "Opened $Url in your browser."
}

# --- summary ----------------------------------------------------------------
Header "Done"
Write-Host "  DRISHTI-Vault is running: $Url" -ForegroundColor Green
Write-Host "  Start (later):  double-click DVault-CC.lnk" -ForegroundColor DarkGray
Write-Host "  Stop:           scripts\podman-drishtivault.ps1 -Stop" -ForegroundColor DarkGray
Write-Host "  Logs:           scripts\podman-drishtivault.ps1 -Logs" -ForegroundColor DarkGray
Write-Host "  Data lives in:  data\, backups\, logs\ (persist across restarts)" -ForegroundColor DarkGray
Write-Host ""
