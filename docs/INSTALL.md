# Installation

## Prerequisites

- **Python 3.10+** (developed/tested on 3.14) — https://python.org
- **Node.js 18+** (with npm) — https://nodejs.org
- Windows 10/11 (PowerShell scripts provided). The app itself is cross-platform;
  on macOS/Linux use the equivalent shell commands.

## Steps

```powershell
cd C:\MyProjects\DRISHTI-Vault

# 1. Install everything
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

`install.ps1` will:

1. Verify Python and Node.js are installed
2. Install backend deps (`pip install -r apps\api\requirements.txt`)
3. Install frontend deps (`npm install` in `apps\web`)
4. Build the React SPA (`npm run build` → `apps\web\dist`)
5. Initialize the SQLite database (`data\drishtivault.db`) and seed sample sites
6. Print the local URL: **http://127.0.0.1:7788**

## Start

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-drishtivault.ps1
```

This launches Uvicorn bound to `127.0.0.1:7788` (serving both `/api/*` and the
SPA at `/`) and opens your browser.

## First launch

1. Open **http://127.0.0.1:7788**
2. Choose a username and a **master password** (min 10 chars). See
   [RECOVERY.md](RECOVERY.md) — this password is **not recoverable**.
3. The vault unlocks. Sample sites (Springfield, Hopkinsville) and VMs are
   pre-seeded for exploration.

## Verify localhost-only binding

```powershell
netstat -ano | findstr 7788
# Expect: TCP  127.0.0.1:7788  ...  LISTENING
# (NOT 0.0.0.0:7788)
```

## Backup

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-drishtivault.ps1
```

(Vault must be unlocked in your browser; the script calls `/api/backup/export`.)

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `python` not found | Install Python, or run via `py` ; ensure added to PATH |
| Frontend shows "not built" | Run `cd apps\web && npm run build` |
| Port 7788 in use | Stop the other process or change `DRISHTIVAULT_PORT` |
| Login fails after restore | By design — restore locks the vault; re-enter the restored master password |
