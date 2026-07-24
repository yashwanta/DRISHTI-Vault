# DRISHTI-Vault — install / setup script
# Checks prerequisites, installs deps, initializes DB, builds the frontend.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\install.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Header($t) { Write-Host ""; Write-Host "==== $t ====" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK] $t" -ForegroundColor Green }
function Warn($t)   { Write-Host "  [!!] $t" -ForegroundColor Yellow }
function Fail($t)   { Write-Host "  [XX] $t" -ForegroundColor Red; exit 1 }

Header "DRISHTI-Vault installer"

# --- Node ---
Header "Check Node.js"
try {
    $node = & node --version 2>&1
    $npm  = & npm.cmd --version 2>&1
    Ok "Node found: $node (npm $npm)"
} catch {
    Fail "Node.js not found. Install Node 18+ from https://nodejs.org and re-run."
}

# --- Go ---
Header "Check Go"
try {
    $go = & go version 2>&1
    Ok "Go found: $go"
} catch {
    Fail "Go 1.25+ not found. Install Go from https://go.dev/dl/ and re-run."
}

# --- Frontend deps ---
Header "Install frontend dependencies"
Push-Location (Join-Path $Root "apps\web")
& npm.cmd install
Pop-Location
Ok "Frontend dependencies installed"

# --- Build frontend ---
Header "Build frontend (React + TypeScript -> dist)"
Push-Location (Join-Path $Root "apps\web")
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { Fail "Frontend build failed." }
Pop-Location
Ok "Frontend built to apps\web\dist"

# --- Build Go backend ---
Header "Build Go backend"
Push-Location (Join-Path $Root "apps\api-go")
$env:GOCACHE = Join-Path (Get-Location) ".gocache"
$env:GOMODCACHE = Join-Path (Get-Location) ".gomodcache"
& go build -trimpath -o drishtivault.exe .\cmd\server
if ($LASTEXITCODE -ne 0) { Fail "Go backend build failed." }
Pop-Location
Ok "Go backend built to apps\api-go\drishtivault.exe"

# The Go server initializes or migrates SQLite atomically on first start.
Ok "Database will be initialized by the Go server on first start"

# --- Directories ---
foreach ($d in @("data","backups\encrypted","logs")) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null
}

Header "Done"
Write-Host ""
Write-Host "  DRISHTI-Vault is installed." -ForegroundColor Green
Write-Host "  Start it with:  powershell -ExecutionPolicy Bypass -File scripts\start-drishtivault.ps1"
Write-Host "  Local URL:      http://127.0.0.1:7788"
Write-Host ""
