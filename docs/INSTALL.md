# Installing DRISHTI-Vault

DRISHTI-Vault runs on **http://127.0.0.1:7788** (localhost only — never exposed
to the network). There are two ways to run it:

- **Option A — Podman container (recommended).** Isolated, hardened, rebuilds in
  seconds, and matches the `DVault-CC` shortcut.
- **Option B — Bare metal (Go + Node).** Simpler, no container runtime.

## Option A — Podman container (recommended)

### Quick start

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File install-all.ps1
```

That's it. The all-in-one installer:

1. **Checks for prerequisites** (Podman only; Go and Node run in image build stages). If missing it
   **installs them automatically** via winget (chocolatey fallback). If admin
   rights are needed, it re-launches itself elevated — just approve the UAC
   prompt.
2. **Starts the Podman machine** (initializing one if none exists).
3. **Protects your existing data** — if a vault database already exists, it's
   backed up to `backups\preinstall_<timestamp>\` before anything is rebuilt.
   Your existing master password and data are preserved.
4. **Builds the image and runs the container** `DRISHTIVault`.
5. **Creates the `DVault-CC.lnk`** shortcut and opens the app in your browser.

When it finishes, open http://127.0.0.1:7788 and (on first run) create the
**Super Admin (Yash)** master password.

### Flags

| Flag | Effect |
|------|--------|
| `-Force` | Rebuild the container image even if it already exists (use after pulling code changes). |
| `-SkipLaunch` | Don't open the browser at the end. |

```powershell
powershell -ExecutionPolicy Bypass -File install-all.ps1 -Force -SkipLaunch
```

### Day-to-day use

| Action | How |
|--------|-----|
| Start the app | Double-click **`DVault-CC.lnk`** in the repo root |
| Stop the container | `scripts\podman-drishtivault.ps1 -Stop` |
| View live logs | `scripts\podman-drishtivault.ps1 -Logs` |

Your encrypted database, backups, and logs live in **`data\`**, **`backups\`**,
and **`logs\`** — they persist across container restarts and reinstalls.

### Container troubleshooting

**"Podman machine is not reachable after repair"**
The Podman-on-WSL socket sometimes fails to forward to Windows localhost. The
installer attempts the standard repair (`wsl --update`, then a machine restart)
automatically. To do it manually:

```powershell
wsl --update
wsl --shutdown
podman machine start
podman ps   # should list containers, not error
```

**Changes to the code aren't showing up**
The container runs a built image. After editing backend/frontend code, rebuild
and hard-refresh your browser (Ctrl+F5):

```powershell
powershell -ExecutionPolicy Bypass -File install-all.ps1 -Force
```

**Login bounces back to the login screen / "asks for password again"**
Sessions live in memory inside the container and are wiped when it restarts.
If you just restarted the container, your old session cookie is stale — simply
log in again. (This is expected, not a bug.)

---

## Option B — Bare metal (Go + Node)

### Prerequisites

- **Go 1.25+** — https://go.dev/dl/
- **Node.js 18+** (with npm) — https://nodejs.org
- Windows 10/11 (PowerShell scripts provided). The app itself is cross-platform;
  on macOS/Linux use the equivalent shell commands.

### Steps

```powershell
cd C:\MyProjects\DRISHTI-Vault

# 1. Install everything
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

`install.ps1` will:

1. Verify Go and Node.js are installed
2. Download pinned Go modules and build `apps\api-go\drishtivault.exe`
3. Install frontend deps (`npm install` in `apps\web`)
4. Build the React SPA (`npm run build` → `apps\web\dist`)
5. Initialize the SQLite database (`data\drishtivault.db`) and seed sample sites
6. Print the local URL: **http://127.0.0.1:7788**

### Start

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-drishtivault.ps1
```

This launches the Go server bound to `127.0.0.1:7788` (serving both `/api/*` and the
SPA at `/`) and opens your browser.

---

## First launch (both options)

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

## General troubleshooting

| Symptom | Fix |
|---------|-----|
| `go` not found | Install Go 1.25+ and ensure it is available on PATH |
| Frontend shows "not built" | Run `cd apps\web && npm run build` (bare metal) or `install-all.ps1 -Force` (container) |
| Port 7788 in use | Stop the other process or change `DRISHTIVAULT_PORT` |
| Login fails after restore | By design — restore locks the vault; re-enter the restored master password |
