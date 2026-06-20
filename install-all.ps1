# DRISHTI-Vault - convenience installer entry point.
# Delegates to the real installer in scripts\install-all.ps1.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File install-all.ps1
#   powershell -ExecutionPolicy Bypass -File install-all.ps1 -Force         # rebuild image
#   powershell -ExecutionPolicy Bypass -File install-all.ps1 -SkipLaunch    # don't open browser

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "scripts\install-all.ps1"
if (-not (Test-Path $script)) {
    Write-Host "Installer script not found: $script" -ForegroundColor Red
    exit 1
}
& $script @args
exit $LASTEXITCODE
