# DRISHTI-Vault — AI Agent / Codex Context

> **Read this file first.** It is the single source of truth for any AI coding
> assistant (Codex, Copilot, Claude, Cursor, etc.) working on this codebase.
> It tells you what the project is, how it is built, what the rules are, and
> where everything lives.

---

## What This Project Is

**DRISHTI-Vault** is a **secure localhost-only IT credential vault and server
inventory** for an IT Manager at an industrial/manufacturing company.

- Runs at `http://127.0.0.1:7788` only — never exposed to the network.
- Replaces an Excel-based VM tracker and a scattered OneNote credential store.
- Users: Yash (Super Admin / IT Manager) + invited team admins.
- Companion notes vault lives at `Notes/` — an Obsidian markdown vault.

---

## Stack

| Layer | Technology | Entry point |
|-------|-----------|-------------|
| Backend | **Go** `net/http` | `apps/api-go/cmd/server/main.go` |
| Frontend | **React 18 + TypeScript + Vite** | `apps/web/src/main.tsx` |
| Database | **SQLite** | `data/drishtivault.db` |
| Cipher | **AES-256-GCM** (Go `crypto/aes`) | `apps/api-go/internal/crypto/` |
| KDF | **Argon2id** | same package |
| Container | **Podman** | `Containerfile` |

The Go backend serves the compiled React SPA from `apps/web/dist/` at `/`.
In dev, Vite runs on `:5174` and proxies `/api` to `:7788`.

---

## Folder Map

```
DRISHTI-Vault/
  apps/
    api-go/
      cmd/server/main.go          ← Go entry point; registers all routes
      internal/
        auth/       ← session, master-password verify, reveal window
        crypto/     ← AES-256-GCM encrypt/decrypt, Argon2id KDF
        db/         ← SQLite schema, migrations, query helpers
        routes/     ← one file per feature area (credentials, assets, sites…)
        models/     ← shared Go structs
    web/
      src/
        main.tsx                  ← React root, injects theme CSS
        App.tsx                   ← Router, auth gate, layout
        api.ts                    ← All fetch() calls — single source of truth
        types.ts                  ← TypeScript interfaces matching Go responses
        theme.ts                  ← CSS variables + global stylesheet (string)
        pages/
          CredentialsPage.tsx     ← PRIMARY TARGET for UX improvements
          AssetsPage.tsx
          DashboardPage.tsx
          SitesPage.tsx
          NetworkPage.tsx
          NotesPage.tsx
          AuditPage.tsx
          ChangeLogPage.tsx
          SettingsPage.tsx
          Auth.tsx
        components/
          ui.tsx                  ← Shared: Modal, Field, StatusPill, useToast, ConfirmDialog
          Layout.tsx              ← Sidebar nav + top bar
          PasswordPrompt.tsx      ← Re-auth modal (re-enter master password)
          MultiPasswordPrompt.tsx
          WarningBanner.tsx
          DropZone.tsx
  data/
    drishtivault.db               ← SQLite DB (gitignored)
  backups/encrypted/              ← Encrypted backup files (gitignored)
  docs/
    INSTALL.md
    SECURITY.md
    RECOVERY.md
    PROJECT_WIKI.md               ← Full architecture reference
    CONTAINER.md
  import/
    AMR_Proxmox_VM_Tracker.xlsx  ← Source Excel for import
  scripts/
    install.ps1
    start-drishtivault.ps1
    backup-drishtivault.ps1
    onenote-to-md.ps1            ← OneNote → Markdown converter
  Notes/                         ← Obsidian markdown vault (companion)
    000-Home/
    100-Daily-Notes/
    200-Projects/
    300-Meetings/
    400-Incidents/
    500-Reference/
    _Templates/
```

---

## Security Rules — NEVER Violate These

1. **Never store secrets in plaintext.** All credential fields (username, password,
   url_host) are AES-256-GCM encrypted in SQLite. Decryption only happens
   server-side during an active reveal window.

2. **Reveal window required.** Reading a credential's secret fields requires:
   - A valid session (logged in) AND
   - An open reveal window (`/api/reveal` POST with master password re-entry).
   The reveal window expires after `reveal_ttl` seconds (default: 300s).

3. **No secrets in localStorage, sessionStorage, logs, or URL params.** Ever.

4. **Clipboard auto-clear.** After copying a password, start a
   `clipboard_ttl`-second (default 30s) timer that writes `""` to clipboard.
   Always clear the timer before starting a new one.

5. **127.0.0.1 only.** Do not change the bind address. Do not add CORS headers
   that would allow cross-origin requests.

6. **Second-gate rule.** A logged-in session is never enough to reveal/copy/rotate
   a password or export/restore a backup. Master password re-entry always required.

7. **Audit everything.** Any view, copy, edit, delete, or rotate of a credential
   must produce an audit log entry via the existing `logAudit()` helper.

---

## Coding Conventions

### Go (backend)
- Standard library only (`net/http`). No frameworks.
- Route handlers live in `internal/routes/`. Name: `Handle<Resource><Action>`.
- DB queries use raw `database/sql` with prepared statements.
- Return JSON; use `writeJSON(w, data)` helper.
- Errors: `writeError(w, status, "message")`.
- All secret encrypt/decrypt goes through `internal/crypto` — never inline.

### React / TypeScript (frontend)
- No CSS framework. Styles are CSS variables in `theme.ts` → injected as
  `<style>` in `main.tsx`. Add new variables there; use `var(--name)` everywhere.
- No additional npm packages without a strong reason.
- State management: plain `React.useState` / `React.useEffect`. No Redux/Zustand.
- All API calls go through `api.ts`. Never use `fetch()` directly in a component.
- Types: define in `types.ts` and import; avoid `any` for data returned by the API.
- Components: functional components only. Named exports (not default).
- `ui.tsx` contains shared primitives: `Modal`, `Field`, `StatusPill`,
  `ConfirmDialog`, `useToast`, `Empty`. Add new shared components there.

---

## API Endpoints Reference

### Auth
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/login` | Login with username + master_password |
| POST | `/api/lock` | Lock session |
| GET | `/api/me` | Current session: `{username, reveal_open, reveal_ttl}` |
| POST | `/api/reveal` | Open reveal window (re-enter master_password) |
| POST | `/api/change-master-password` | Change master password |

### Credentials (PRIMARY)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/credentials` | List all: `{items, cred_types, clipboard_ttl}` |
| POST | `/api/credentials` | Create credential |
| PUT | `/api/credentials/:id` | Update credential |
| DELETE | `/api/credentials/:id` | Delete credential |
| GET | `/api/credentials/:id/view` | Decrypt & return full credential (requires reveal) |
| POST | `/api/credentials/:id/copy` | Log a copy event to audit |
| POST | `/api/credentials/:id/rotate` | Generate new password, encrypt, return it |

### Other
- `/api/sites` — CRUD for sites/plants
- `/api/assets` — CRUD for VMs/servers/devices
- `/api/network` — CRUD for VLAN/subnet rows
- `/api/changelog` — CRUD for change log entries
- `/api/audit` — Read-only audit log
- `/api/notes` — Encrypted notes (CRUD + pin)
- `/api/backup/*` — Export/restore encrypted backup

---

## Credential Data Shape

### List item (masked, from `GET /api/credentials`)
```typescript
{
  id: number;
  title: string;
  site_id: number | null;
  site_name?: string | null;
  asset_id: number | null;
  asset_name?: string | null;
  cred_type: string;           // "Linux SSH" | "Windows RDP" | "Web Login" | etc.
  username_masked: string;     // e.g. "adm***" or "—"
  has_password: boolean;
  password_masked: string;     // always "••••••••"
  url_masked: string;
  port: number | null;
  rotation_due: string | null; // ISO date "YYYY-MM-DD"
  status: string;              // "Active" | "Retired"
}
```

### Detail (decrypted, from `GET /api/credentials/:id/view` — requires reveal)
```typescript
{
  id: number;
  title: string;
  cred_type: string;
  username: string;
  password: string;
  url_host: string;
  port: number | null;
  notes: string;
}
```

---

## Dev Workflow

```powershell
# Backend (Terminal 1)
cd apps\api-go
go run ./cmd/server        # API on :7788

# Frontend (Terminal 2)
cd apps\web
npm run dev                # Vite on :5174, proxies /api → :7788

# Build for production
cd apps\web && npm run build   # output → apps/web/dist/
# Go server then serves dist/ statically
```

---

## Known Issues / Planned Improvements

See `Notes/200-Projects/Credentials Page UX Overhaul.md` for the full spec.

Short list:
- [ ] CredentialsPage.tsx — table is too dense (11 columns), needs card/grouped view
- [ ] No inline quick-copy from the table row (must open View modal first)
- [ ] Rotation due dates not color-coded (overdue = red, due soon = orange)
- [ ] No credential type icons
- [ ] No password generator in Add/Edit form
- [ ] No sortable columns
- [ ] reveal window uses `(window as any).__pendingView` — fragile; needs proper state
- [ ] Edit form shows "leave blank to keep existing" for password but doesn't warn user

---

## Notes Vault

`Notes/` is a companion Obsidian vault. Open it with Obsidian desktop app:
- **Vault path:** `C:\DRISHTI\DRISHTI-Vault\Notes`
- Start at: `Notes/000-Home/🏠 Dashboard.md`
- Project tracking: `Notes/200-Projects/`
- Incident tracking: `Notes/400-Incidents/`
- All templates: `Notes/_Templates/`

---

*Last updated: 2026-08-06 by Yash*
