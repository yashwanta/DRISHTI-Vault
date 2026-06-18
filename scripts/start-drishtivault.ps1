# DRISHTI-Vault — start backend + open browser
# Serves the built SPA and the API from a single localhost port (7788).
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\start-drishtivault.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$ApiDir  = Join-Path $Root "apps\api"
$WebDir  = Join-Path $Root "apps\web"
$Dist    = Join-Path $WebDir "dist"
$Url     = "http://127.0.0.1:7788"

# Build the SPA first if it is missing
if (-not (Test-Path (Join-Path $Dist "index.html"))) {
    Write-Host "Frontend not built yet — building..." -ForegroundColor Yellow
    Push-Location $WebDir
    & npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "Build failed." -ForegroundColor Red; exit 1 }
    Pop-Location
}

Write-Host ""
Write-Host "  Starting DRISHTI-Vault on $Url  (localhost only)" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

# Launch backend in a new window so logs are visible, and open the browser.
Set-Location $ApiDir
Start-Process -FilePath "python" -ArgumentList "-m","uvicorn","app.main:app","--host","127.0.0.1","--port","7788"

Start-Sleep -Seconds 3
Start-Process $Url

Write-Host "  DRISHTI-Vault running at $Url" -ForegroundColor Green
