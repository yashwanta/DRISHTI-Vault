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

# --- Python ---
Header "Check Python"
try {
    $py = & python --version 2>&1
    Ok "Python found: $py"
} catch {
    Fail "Python not found. Install Python 3.10+ from https://python.org and re-run."
}

# --- Node ---
Header "Check Node.js"
try {
    $node = & node --version 2>&1
    $npm  = & npm --version 2>&1
    Ok "Node found: $node (npm $npm)"
} catch {
    Fail "Node.js not found. Install Node 18+ from https://nodejs.org and re-run."
}

# --- Backend deps ---
Header "Install backend dependencies (FastAPI, argon2-cffi, cryptography)"
Push-Location (Join-Path $Root "apps\api")
& python -m pip install --upgrade pip | Out-Null
& python -m pip install -r requirements.txt
Pop-Location
Ok "Backend dependencies installed"

# --- Frontend deps ---
Header "Install frontend dependencies"
Push-Location (Join-Path $Root "apps\web")
& npm install
Pop-Location
Ok "Frontend dependencies installed"

# --- Build frontend ---
Header "Build frontend (React + TypeScript -> dist)"
Push-Location (Join-Path $Root "apps\web")
& npm run build
if ($LASTEXITCODE -ne 0) { Fail "Frontend build failed." }
Pop-Location
Ok "Frontend built to apps\web\dist"

# --- Initialize DB ---
Header "Initialize local database"
Push-Location (Join-Path $Root "apps\api")
& python -c "from app.db import init_db; init_db(); print('DB ready')"
if ($LASTEXITCODE -ne 0) { Fail "DB init failed." }
Pop-Location
Ok "Database initialized at data\drishtivault.db"

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
