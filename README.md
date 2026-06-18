# DRISHTI-Vault

**A secure localhost-only IT password vault & AMR/Proxmox server inventory application.**

DRISHTI-Vault replaces the Excel-based AMR Proxmox VM tracker and becomes a secure
local password vault for IT credentials, AMR/RDS systems, Proxmox VMs, servers,
web logins, service accounts, database accounts, network devices, and recovery
notes.

> ⚠ **Local vault only. Do not expose to network.** DRISHTI-Vault binds to
> `127.0.0.1:7788` only. It is not designed for remote or multi-user access.

---

## Quick start

### Option A — Podman container (recommended)

Runs as a container named **`DRISHTIVault`** on http://127.0.0.1:7788.

```powershell
cd C:\DRISHTI\DRISHTI-Vault
podman machine start                                  # if not already running
powershell -ExecutionPolicy Bypass -File scripts\podman-drishtivault.ps1
```

See **[docs/CONTAINER.md](docs/CONTAINER.md)** for details.

### Option B — Bare metal (local Python + Node)

```powershell
# 1. Install (checks Python/Node, installs deps, builds frontend, inits DB)
powershell -ExecutionPolicy Bypass -File scripts\install.ps1

# 2. Start (serves API + SPA on one port) and open browser
powershell -ExecutionPolicy Bypass -File scripts\start-drishtivault.ps1
```

Then open **http://127.0.0.1:7788** and create the **Super Admin (Yash)** master
password. Yash then invites other admins from **User Management**.

## Roles (RBAC)

| Role | Sees | Reset passwords | Notes |
|------|------|-----------------|-------|
| **Super Admin** (`Yash`) | Everything | Yes | Reserved identity, created first, hidden from everyone else, cannot be removed/demoted |
| **Global Admin** | All sites/credentials | No | Created by Yash |
| **Location Admin** | Only assigned sites' credentials | No | Sites assigned by an admin |

Access is enforced server-side on every endpoint; out-of-scope rows return 404
(no existence leak). Isolation is **policy-based** (one shared DEK; the server
controls who decrypts what) — see [docs/SECURITY.md](docs/SECURITY.md).

## Features

- **Dashboard** — total sites, assets, credentials, rotation-due, recent changes & audit
- **Sites / Plants** — Springfield, Hopkinsville seeded
- **VM & Server Inventory** — Proxmox hosts/VMs, RDS cores, switches, APs, etc.
- **Credentials Vault** — encrypted usernames/passwords/URLs/notes, masked by default,
  reveal only after master re-auth, copy-to-clipboard with 30s auto-clear, rotate
- **Network Reference** — VLANs / subnets / gateways / DNS
- **Change Log** — tracked changes with approval trail
- **Audit Log** — immutable record of view/copy/edit/delete/backup/restore events
  (never secret values)
- **Settings / Backup** — encrypted export/restore, Excel import
- **Excel import** — reads `import\AMR_Proxmox_VM_Tracker.xlsx`; passwords
  detected in the workbook are flagged, **never auto-imported**

## Security model (summary)

- **Two distinct passwords**: a **Master Password** (unlocks the vault) and a
  separate **Vault Backup Password** (encrypts backup files). Neither is stored
  in plaintext or logged.
- Master password stored only as an **Argon2id** verifier (never plaintext)
- Encryption key (KEK) derived from the master password via Argon2id; the actual
  data key (DEK) is AES-256-GCM wrapped and only decrypted into server RAM
- Secret fields encrypted at rest with **AES-256-GCM** (proven `cryptography` lib)
- **No custom crypto.** No cloud sync, no telemetry, no external API calls
- **Second-gate rule:** a logged-in session is never enough — the Master
  Password must be re-entered to reveal/copy a password, export, restore, or
  change the master password
- Backup files (`.drishtivaultbackup`) are AES-256-GCM encrypted with a key derived
  from the Vault Backup Password; they never contain plaintext secrets
- Restore requires re-auth + preview + confirmation; 5 failed attempts trigger a
  5-minute lockout
- Auto-lock on inactivity; secrets never written to `localStorage`, `.env`, or logs

See **[docs/SECURITY.md](docs/SECURITY.md)** for details and
**[docs/RECOVERY.md](docs/RECOVERY.md)** for the all-important master-password
recovery warning.

## Stack

| Layer    | Technology                                  |
|----------|---------------------------------------------|
| Backend  | Python · FastAPI · Uvicorn (127.0.0.1:7788) |
| Frontend | React + TypeScript + Vite                   |
| Database | local SQLite (data/drishtivault.db)             |
| Hash/KDF | Argon2id (argon2-cffi)                      |
| Cipher   | AES-256-GCM (cryptography)                  |

## Folder structure

```
DRISHTI-Vault/
  apps/
    api/      FastAPI backend (app/ ...)
    web/      React + TS frontend (src/ ...)
  data/       SQLite database (gitignored)
  backups/encrypted/   encrypted backup files (gitignored)
  docs/       INSTALL, SECURITY, RECOVERY
  import/     source workbooks (e.g. AMR_Proxmox_VM_Tracker.xlsx)
  logs/       server logs (gitignored)
  scripts/    install / start / backup PowerShell scripts
```

## Development

```powershell
# Terminal 1 — backend
cd apps\api
python -m uvicorn app.main:app --host 127.0.0.1 --port 7788 --reload

# Terminal 2 — frontend dev server (proxies /api -> 7788)
cd apps\web
npm run dev    # http://127.0.0.1:5174
```

Build the SPA for production serving: `cd apps\web && npm run build`
(then the FastAPI server serves `apps\web\dist` at `/`).
