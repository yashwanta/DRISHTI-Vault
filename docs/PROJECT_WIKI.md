# DRISHTI-Vault — Project Wiki

> Single-source project reference for DRISHTI-Vault. Covers architecture, security
> model, data model, import flows, RBAC, and how to work on the codebase.
> Maintained alongside the code; update when subsystems change.

---

## 1. What it is

DRISHTI-Vault is a **secure localhost-only IT password vault + AMR/Proxmox server
inventory** application. It replaces the spreadsheet-based AMR Proxmox VM tracker
and becomes the central, encrypted store for:

- IT credentials (usernames/passwords/URLs/notes)
- AMR / RDS systems
- Proxmox hosts & VMs, servers, switches, APs
- Web logins, service & database accounts
- Network reference data (VLAN/subnet/gateway/DNS)
- A tracked change log and an immutable audit log

> ⚠ **Local vault only. Do not expose to network.** Binds to `127.0.0.1:7788`.
> Not designed for remote or anonymous access.

---

## 2. Quick reference

| Item              | Value                                              |
|-------------------|----------------------------------------------------|
| Project path      | `C:\DRISHTI\DRISHTI-Vault`                         |
| Bind address      | `127.0.0.1:7788`                                  |
| Backend           | Go · `net/http` (`apps/api-go`)                    |
| Frontend          | React + TypeScript + Vite (`apps/web`)             |
| Database          | local SQLite (`data/drishtivault.db`)              |
| Hash / KDF        | Argon2id (`golang.org/x/crypto`)                   |
| Cipher            | AES-256-GCM (Go standard library)                  |
| Excel dep         | `excelize/v2`                                      |
| Super Admin       | `Yash` (reserved identity, hidden from others)     |
| Smoke tests       | `apps/api/tests/test_smoke.py` — **102/102 pass**  |

**Run it (Podman, recommended):**
```powershell
cd C:\DRISHTI\DRISHTI-Vault
podman machine start
powershell -ExecutionPolicy Bypass -File scripts\podman-drishtivault.ps1
```
Open http://127.0.0.1:7788 and create the Super Admin (`Yash`) master password.

See [INSTALL.md](INSTALL.md), [CONTAINER.md](CONTAINER.md), [SECURITY.md](SECURITY.md),
[RECOVERY.md](RECOVERY.md), and [NOTES_WORKSPACE_KB.md](NOTES_WORKSPACE_KB.md) for the deep dives.

---

## 3. Folder structure

```
DRISHTI-Vault/
  apps/
    api-go/               production Go API
      cmd/server/         executable entry point
      internal/server/    HTTP routes, RBAC, imports, backup/restore, SPA
      internal/database/  SQLite schema, seeding, audit
      internal/sessions/  in-memory DEK sessions and reveal window
      internal/crypto/    compatible Argon2id + AES-256-GCM implementation
      go.mod / go.sum
    api/                  transitional Python fallback
    web/                  React + TS + Vite SPA
      src/
        api.ts            typed API client (fetch wrapper)
        pages/            SettingsPage, CredentialsPage, DashboardPage, ...
        components/       UI primitives + MultiPasswordPrompt
      dist/               built SPA served by Go in production
  data/                   SQLite DB (gitignored)
  backups/encrypted/      encrypted backup files (gitignored)
  import/                 source workbooks (AMR_Proxmox_VM_Tracker.xlsx)
  logs/                   server logs (gitignored)
  scripts/                install / start / podman / backup PowerShell scripts
  docs/                   this wiki + INSTALL/CONTAINER/SECURITY/RECOVERY
  Containerfile           Podman image definition
```

---

## 4. Roles & access control (RBAC)

| Role             | Sees                         | Reset passwords | Notes |
|------------------|------------------------------|-----------------|-------|
| **Super Admin** (`Yash`) | Everything            | Yes             | Reserved; created first; hidden from everyone else; cannot be removed or demoted |
| **Global Admin** | All sites & credentials      | No              | Created by Yash |
| **Location Admin**| Only assigned sites' data    | No              | Sites assigned by an admin |

- Enforcement is **server-side on every endpoint**. Out-of-scope rows return **404**
  (no existence leak).
- Isolation is **policy-based**: one shared DEK, the server controls who may decrypt
  what. There is no per-user key material to manage.
- Import endpoints are RBAC-scoped: a Location Admin importing CSV can only insert
  rows for their own sites; out-of-scope rows are **skipped + reported**, not inserted.

---

## 5. Security model (summary)

See [SECURITY.md](SECURITY.md) and [RECOVERY.md](RECOVERY.md) for the full treatment.

- **Two distinct passwords**:
  - **Master Password** — unlocks the vault (Argon2id verifier only, never plaintext).
  - **Vault Backup Password** — separately encrypts `.drishtivaultbackup` files.
  Neither is stored in plaintext or logged.
- **Key hierarchy**: master password → Argon2id → KEK → wraps the **DEK**
  (AES-256-GCM). The DEK is only decrypted into server RAM during an active session.
- **Field encryption**: secret columns (passwords, URLs, notes) encrypted at rest with
  **AES-256-GCM**.
- **No custom crypto.** No cloud sync, no telemetry, no outbound API calls.
- **Second-gate rule**: a logged-in session is *never* enough — the Master Password
  must be re-entered to reveal/copy a credential, export, restore, or change the
  master password.
- **Restore**: requires re-auth + preview + confirmation; 5 failed attempts trigger a
  5-minute lockout.
- Secrets are never written to `localStorage`, `.env`, or logs.

---

## 6. Data model (core tables)

| Table               | Purpose                                  | Has secret columns? |
|---------------------|------------------------------------------|---------------------|
| `sites`             | Plants / sites (Springfield, Hopkinsville…) | no |
| `assets`            | VMs / Proxmox hosts / RDS cores / switches / APs | yes (`web_url_enc`, `notes_enc`) |
| `credentials`       | Usernames / passwords / URL hosts / notes | yes (`username_enc`, `password_enc`, `url_host_enc`, `notes_enc`) |
| `network_reference` | VLAN / subnet / gateway / DNS             | no |
| `change_log`        | Tracked changes with approval trail       | no |
| `audit_log`         | Immutable record of sensitive actions      | no (never stores values) |

Foreign-key linkage used by imports: `site_name → sites.id`, `asset_name → assets.id`.

---

## 7. Import flows

There are **two independent import paths**, both surfaced as cards on the
**Settings page** (`apps/web/src/pages/SettingsPage.tsx`).

### 7a. Excel import (metadata; secrets never auto-imported)

Reads the legacy `AMR_Proxmox_VM_Tracker.xlsx` workbook and imports
**non-secret** metadata.

| Step | Endpoint | Handler |
|------|----------|---------|
| Preview (parse, dry) | `POST /api/import/excel/preview` | `routes/import_excel.py` → `services/excel_import.parse_workbook` |
| Commit (insert)      | `POST /api/import/excel/commit`  | `routes/import_excel.py` |

Behavior:
- Parses sheet-by-sheet: `Sites Index`, `Change Log`, `Network Reference`, and any
  other tab is treated as a per-site VM inventory (site name = tab name).
- Any cell under a password-like header (`password`, `pwd`, `secret`, `token`, `key`…)
  is **flagged as a detected secret and never imported**. The UI reports the count and
  tells the user to add those credentials manually in the Credentials Vault.
- Asset types are guessed from the name (Proxmox Host, RDS Core, Switch, Aruba AP…).
- Accepts **`.xlsx` only**.

### 7b. CSV import (with password encryption)

Downloadable templates + bulk import that **does** encrypt secret columns.

| Step | Endpoint | Handler |
|------|----------|---------|
| List supported tables | `GET  /api/csv/tables` | `routes/csv.py` |
| Download empty template | `GET  /api/csv/template/{table}` | `routes/csv.py` (dummy data only) |
| Preview (dry run)        | `POST /api/csv/preview`  | `routes/csv.py` → `services/csv_io.parse_csv` + `validate_rows` |
| Commit (insert)          | `POST /api/csv/commit`   | `routes/csv.py` |

Supported tables: `credentials`, `sites`, `assets`, `network`, `changelog`.

Security discipline (the point of the feature):
- Templates contain **dummy data only** — never real secrets.
- Preview is a **dry run**: no writes, no secrets echoed (only `••••` presence).
- **Secrets never round-trip through the browser**: the preview masks them, and the
  commit **re-parses the original uploaded file server-side**, reads the real values,
  and encrypts them with the session DEK.
- RBAC-scoped and **audit-logged** with counts/table only (no values).

### Adding a new importable table

1. Add a schema entry in `apps/api/app/services/csv_io.py` (`SCHEMAS`/`TABLES`).
2. Add an `INSERT` branch in `_insert_row` (`routes/csv.py`) for the new table.
3. Add the table name to `CSV_TABLES` in `SettingsPage.tsx`.
4. Add an assertion to `tests/test_smoke.py`.

---

## 8. API surface (key endpoints)

All under `/api`. Auth via session cookie; sensitive actions also require master
re-auth / reveal window.

```
# Auth & users
POST /api/auth/...            login, setup, logout, throttle
GET  /api/users               list / invite (admin)

# Inventory
GET/POST /api/sites           /api/assets          /api/credentials
GET/POST /api/network         /api/changelog

# Credentials (second-gate)
POST /api/credentials/{id}/reveal   (master re-auth → reveal window)
POST /api/credentials/{id}/copy

# Import
GET  /api/csv/tables
GET  /api/csv/template/{table}
POST /api/csv/preview  ·  POST /api/csv/commit
POST /api/import/excel/preview  ·  POST /api/import/excel/commit

# Backup
POST /api/backup/export       /api/backup/restore/preview  /api/backup/restore/commit
GET  /api/backup/last  ·  /api/backup/history

# Ops
GET /api/dashboard  ·  GET /api/audit  ·  GET /api/settings
```
Route registration lives in `apps/api-go/internal/server/server.go`.

---

## 9. Development workflow

```powershell
# Terminal 1 — backend
cd apps\api-go
go run ./cmd/server

# Terminal 2 — frontend dev server (proxies /api -> 7788)
cd apps\web
npm run dev    # http://127.0.0.1:5174
```

Production SPA build (served by Go at `/`):
```powershell
cd apps\web && npm run build     # output: apps/web/dist
```

Run smoke tests:
```powershell
cd apps\api-go
go test ./...
```

---

## 10. In-progress workstreams

- **Go API hardening** (`apps/api-go/`) — the Go backend is now the primary
  launcher and container runtime. Keep extending endpoint and encrypted-backup
  compatibility tests before retiring the transitional Python fallback.
- **Import UX** — both Excel and CSV upload controls exist on Settings. Potential
  follow-ups: per-row error detail in CSV commit modal, `xlsx` template generation to
  match CSV, drag-and-drop drop-zones, progress for large files.

---

## 11. Related projects (context only)

The user maintains several sibling projects under `C:\DRISHTI\`:
- **DRISHTI-SiteOps(-claude)** — site operations dashboard (separate codebase).
- **AMRDashboard** — older project, mostly superseded.

This wiki covers **DRISHTI-Vault only**.
