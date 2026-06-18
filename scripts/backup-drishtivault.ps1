# DRISHTI-Vault — create an encrypted backup via the running server's API.
#
# Two-gate export: requires the vault to be unlocked in your browser (active
# session), then prompts for the Master Password (re-auth) AND a Vault Backup
# Password (with confirmation). Calls /api/backup/export and saves the
# .drishtivaultbackup file to backups\encrypted.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\backup-drishtivault.ps1
#         (you must have the vault open in a browser at http://127.0.0.1:7788)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackupDir = Join-Path $Root "backups\encrypted"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

function Read-Plain($prompt) {
    $ss = Read-Host -AsSecureString $prompt
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    return $plain
}

Write-Host ""
Write-Host "  DRISHTI-Vault — Encrypted Backup" -ForegroundColor Cyan
Write-Host "  (Vault must be unlocked in your browser at http://127.0.0.1:7788)" -ForegroundColor DarkGray
Write-Host ""

# Health check
try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:7788/api/health" -Method Get
} catch {
    Write-Host "  Server not running at http://127.0.0.1:7788." -ForegroundColor Red
    Write-Host "  Start it first:  scripts\start-drishtivault.ps1" -ForegroundColor Yellow
    exit 1
}

$master = Read-Plain "Master password (re-auth)"
$bpw    = Read-Plain "Vault Backup Password (min 10 chars)"
$bconf  = Read-Plain "Confirm Vault Backup Password"

if ($bpw.Length -lt 10) {
    Write-Host "  Vault Backup Password too short (min 10 chars). Aborted." -ForegroundColor Red
    exit 1
}
if ($bpw -ne $bconf) {
    Write-Host "  Vault Backup Password fields do not match. Aborted." -ForegroundColor Red
    exit 1
}

$body = @{
    master_password         = $master
    backup_password         = $bpw
    backup_password_confirm = $bconf
} | ConvertTo-Json

$ts  = Get-Date -Format "yyyy-MM-dd_HHmm"
$out = Join-Path $BackupDir "DRISHTI_Vault_Backup_$ts.drishtivaultbackup"

try {
    Invoke-WebRequest -Uri "http://127.0.0.1:7788/api/backup/export" `
        -Method Post -Body $body `
        -ContentType "application/json" `
        -UseDefaultCredentials `
        -OutFile $out
    Write-Host ""
    Write-Host "  Backup written: $out" -ForegroundColor Green
    Write-Host "  Keep the Vault Backup Password safe — the file cannot be decrypted without it." -ForegroundColor Yellow
} catch {
    Write-Host "  Backup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Is the vault unlocked, and are both passwords correct?" -ForegroundColor Yellow
    exit 1
}
