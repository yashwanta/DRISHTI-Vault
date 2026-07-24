# Transitional fallback for diagnosing a Go-migration issue.
# The primary launcher is start-drishtivault.ps1 and runs the Go backend.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ApiDir = Join-Path $Root "apps\api"
Set-Location $ApiDir
Write-Host "Starting the legacy Python fallback on http://127.0.0.1:7788" -ForegroundColor Yellow
& python -m uvicorn app.main:app --host 127.0.0.1 --port 7788
