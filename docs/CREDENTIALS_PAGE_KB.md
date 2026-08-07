# Credentials Page Knowledge Base

This article documents the DRISHTI-Vault credentials page, its security-sensitive workflows, and the implementation conventions maintainers must preserve.

## Purpose

The credentials page is the primary interface for managing encrypted IT credentials associated with plants, servers, network devices, applications, databases, and service accounts.

The page is designed around two principles:

1. Operators should be able to locate and act on a credential quickly.
2. Convenience must never bypass the vault's reveal window, audit trail, or clipboard protections.

The frontend implementation lives in:

- `apps/web/src/pages/CredentialsPage.tsx`
- `apps/web/src/theme.ts`
- `apps/web/src/api.ts`
- `apps/web/src/types.ts`
- `apps/web/src/components/PasswordPrompt.tsx`
- `apps/web/src/components/ui.tsx`

The page uses the existing React, TypeScript, and Vite stack. It does not introduce a CSS framework, state-management library, or additional npm dependency.

## User experience overview

### Site-grouped navigation

Credentials are grouped into collapsible site sections. Credentials without a linked site appear in the **No Site** section.

Each section header displays:

- site name;
- credential count;
- expanded or collapsed state.

Site groups are ordered alphabetically, with **No Site** placed last. Group identity uses `site_id`, not only the display name, so sites with identical names do not merge accidentally.

### Table view

The desktop table contains exactly five columns:

| Column | Content |
|---|---|
| Title | Credential title, linked asset, and row actions |
| Type | Credential type with an icon |
| Username | Masked username from the list endpoint |
| Status | Existing shared status pill |
| Rotation Due | Color-coded rotation badge |

Actions are placed inside the Title cell to keep the table at five columns while retaining quick access to:

- **📋 User** — reveal-gated username copy;
- **🔐 Pass** — reveal-gated password copy;
- **View** — reveal-gated detail view;
- **Edit** — opens the edit form without exposing existing secrets;
- **Rotate** — reveal-gated password rotation and copy;
- **Delete** — opens the existing confirmation dialog.

### Card view

The **Table / Cards** control changes the desktop presentation without changing the filtered or sorted dataset. Card view remains grouped by site and shows:

- title and linked asset;
- type icon and pill;
- site;
- masked username;
- status;
- rotation badge;
- the same credential actions as the table.

### Responsive behavior

At widths of 768 pixels or less:

- the desktop table is hidden;
- a one-column card grid is shown automatically;
- the desktop Table/Cards toggle is hidden;
- filters expand to the available width;
- the detail modal changes from a two-column layout to a stacked layout.

The responsive behavior is implemented in `theme.ts` under `@media (max-width: 768px)`.

## Search, filters, and sorting

The page loads credentials, sites, and assets through `api.ts`. Filtering and sorting occur client-side; no secret is fetched for these operations.

### Search fields

Search matches the following masked or non-secret list fields:

- title;
- site name;
- asset name;
- credential type;
- masked username.

### Filters

Operators can filter by:

- site;
- credential type.

Search and filters are combined. A credential must satisfy all active filters.

### Sortable columns

All five table headers are sortable. Clicking a header toggles ascending and descending order. The active column displays `▲` or `▼`, and `aria-sort` exposes the state to assistive technology.

The typed sort keys are:

```typescript
type SortColumn =
  | "title"
  | "cred_type"
  | "username_masked"
  | "status"
  | "rotation_due";
```

## Credential type icons

The `credIcon(type)` helper maps known credential types to icons:

| Credential type | Icon |
|---|---|
| Linux SSH | 🖥️ |
| Windows RDP | 🪟 |
| Web Login | 🌐 |
| Database | 🗄️ |
| API Key | 🔑 |
| WiFi | 📶 |
| Network Device | 🔌 |
| Email | 📧 |
| Service Account | ⚙️ |
| Unknown/default | 🔐 |

Types not included in the mapping remain functional and receive the default lock icon.

## Rotation status

The `rotationStatus(date)` helper returns one of four states:

| State | Rule | Display |
|---|---|---|
| `none` | No date or invalid date | Muted em dash |
| `overdue` | Date is before today | Red danger pill |
| `soon` | Date is today through 30 days away | Orange warning pill |
| `ok` | Date is more than 30 days away | Green success pill |

ISO dates are parsed into a local calendar date rather than relying on UTC parsing. This avoids an off-by-one-day result in time zones west of UTC.

## Reveal-window state machine

Credential actions that access decrypted values use a typed React state machine. No pending action is stored on `window`.

```typescript
type PendingAction =
  | { type: "view"; credential: Credential }
  | { type: "copy"; credential: Credential; field: "username" | "password" }
  | { type: "rotate"; credential: Credential };
```

The workflow is:

1. The operator selects View, User, Pass, or Rotate.
2. The page calls `api.me()` to check `reveal_open` and `reveal_ttl`.
3. If the reveal window is active, the action executes.
4. If it is closed, the page stores a typed `pendingAction` and opens `PasswordPrompt`.
5. `PasswordPrompt` submits the master password through `api.openReveal()`.
6. After successful re-authentication, the page clears the pending state and executes the action.
7. Canceling the prompt clears both `showReveal` and `pendingAction`.

The pending state contains only the masked `Credential` list object. It never contains a decrypted password.

## Detail modal

`api.viewCredential(id)` returns `CredentialDetail` only during an active reveal window. The page stores that detail only while the modal is open.

The modal displays:

- credential type;
- username;
- password;
- URL or host;
- port;
- notes.

Username, password, and URL/host values use a monospace secret box. If the URL begins with `http://` or `https://`, a **Launch ↗** link is displayed with `noopener noreferrer` protection.

### Reveal countdown

The banner displays:

```text
🔓 Reveal window: 4m 30s
```

The page:

- initializes the value from `api.me()`;
- decrements the visible counter every second;
- synchronizes with `api.me()` every 30 seconds;
- closes the modal and clears `CredentialDetail` state when the window expires;
- clears detail state immediately when the operator closes the modal.

## Clipboard and audit behavior

### Username copy

Username copy requires the reveal window because the real username is encrypted and the list only contains a masked value.

The copy workflow is:

1. call `api.viewCredential(id)`;
2. copy the decrypted username;
3. call `api.copyCredential(id)` to record the copy event.

The same audit behavior applies to the username copy button in the detail modal.

### Password copy

Password copy follows this sequence:

1. obtain the decrypted password through the reveal-gated endpoint;
2. write it to the clipboard;
3. clear any existing clipboard timeout and countdown interval;
4. start a new timeout using `clipboard_ttl` from the credentials API;
5. start the visible second-by-second countdown;
6. call `api.copyCredential(id)` for the audit event;
7. overwrite the clipboard with an empty string when the timeout expires.

The clear timer starts before waiting for the audit request, so an audit-network failure cannot leave a copied password without an active cleanup timer.

Only password copies start the clipboard auto-clear timer. Starting a new password copy always replaces the previous timer.

### Rotated passwords

Password rotation uses `api.rotateCredential(id)`. The returned password is copied immediately, protected by the same clipboard timer, and followed by `api.copyCredential(id)` so the copy is audited separately from the rotation event.

## Add and edit form

### Password generator

The Add/Edit form includes a 20-character password generator and a show/hide toggle.

Generation uses `crypto.getRandomValues()` and never `Math.random()`:

```typescript
function generatePassword(length = 20): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => chars[b % chars.length]).join("");
}
```

Generated passwords exist only in the form state while the modal is open. Closing or successfully saving the form resets the form object and the visibility toggle.

### Editing without exposing secrets

The edit form does not pre-fill decrypted secrets.

- Username remains blank and uses the masked username as its placeholder.
- Password remains blank and displays **Leave blank to keep existing password**.
- URL/host and notes remain blank and explain that blank preserves the existing value.
- Secret properties are included in the API body only when the operator enters a new value.

This prevents masked values from being submitted as real data and avoids placing existing decrypted secrets in form state.

## Security invariants

Any future change to this page must preserve all of the following:

1. Never persist decrypted values in `localStorage`, `sessionStorage`, URL parameters, logs, or browser globals.
2. Never call `fetch()` directly from the page; use `apps/web/src/api.ts`.
3. Require an active reveal window before retrieving a real username or password.
4. Keep `PasswordPrompt` as the master-password re-authentication component.
5. Store `CredentialDetail` only for the currently open detail modal.
6. Reset form state when the Add/Edit modal closes.
7. Call `window.clearTimeout()` before starting a new password clipboard timer.
8. Auto-clear copied passwords using the API-provided `clipboard_ttl`.
9. Call `api.copyCredential(id)` after every username or password copy, including rotated passwords.
10. Continue using masked `Credential` list data for search, grouping, sorting, and the default page display.
11. Do not add secrets to toast messages, error messages, analytics, or audit details.
12. Do not weaken the localhost-only bind, same-origin model, or backend reveal checks.

## API usage

| API client method | Page use |
|---|---|
| `api.listCredentials()` | Masked list, credential types, clipboard TTL |
| `api.listSites()` | Site filter and form choices |
| `api.listAssets()` | Linked asset choices |
| `api.me()` | Reveal-window status and TTL synchronization |
| `api.openReveal()` | Master-password re-authentication |
| `api.viewCredential()` | Reveal-gated decrypted detail |
| `api.copyCredential()` | Copy audit event |
| `api.saveCredential()` | Create or update |
| `api.rotateCredential()` | Rotate password and return the new value |
| `api.deleteCredential()` | Delete after confirmation |

## Styling guide

Credential-specific styles are appended to `GLOBAL_CSS` in `apps/web/src/theme.ts`.

Important classes include:

- `.site-group`, `.site-group-header`, `.site-group-body`;
- `.cred-table`, `.cred-table-wrap`, `.sort-button`;
- `.cred-card-grid`, `.cred-card`, `.cred-mobile-cards`;
- `.cred-actions`, `.cred-view-toggle`;
- `.rotation-overdue`, `.rotation-soon`, `.rotation-ok`;
- `.reveal-banner`, `.view-grid`, `.secret-box`;
- `.password-input-row`, `.form-helper`, `.modal-actions`.

New styling should use existing variables such as `var(--panel)`, `var(--border)`, `var(--accent)`, `var(--danger)`, `var(--warning)`, and `var(--success)`.

## Validation checklist

Run the production frontend build after modifying this page:

```powershell
cd apps\web
npm.cmd run build
```

Then verify manually:

### Layout and navigation

- Credentials are grouped under the correct site.
- No-site credentials appear under **No Site**.
- Sections expand and collapse using mouse and keyboard.
- Table view contains five headers.
- Card view remains grouped by site.
- Mobile width automatically shows cards.

### Search and sorting

- Search works across title, site, asset, type, and masked username.
- Site and type filters combine correctly.
- Each header toggles ascending and descending order.
- Sort indicators and `aria-sort` match the active state.

### Reveal and copying

- View, User, Pass, and Rotate prompt for the master password when reveal is closed.
- A valid existing reveal window avoids unnecessary re-entry.
- Canceling re-authentication performs no pending action.
- Username and password copies create audit entries.
- Password copy shows a live countdown.
- Copying another password restarts the clipboard timer.
- Clipboard content is overwritten when the timer expires.
- The detail modal closes when the reveal window expires.

### Forms and secrets

- Generated passwords are 20 characters and use secure randomness.
- Show/hide works without persisting the password.
- Editing displays masked username only as a placeholder.
- Leaving secret inputs blank preserves current encrypted values.
- Closing Add/Edit clears generated or typed secret state.
- No decrypted value appears in browser storage, URLs, or logs.

### CRUD workflow

- Add a credential.
- View it through re-authentication.
- Copy username and password.
- Edit non-secret metadata without replacing secrets.
- Rotate the password.
- Delete the credential through confirmation.
- Confirm view, copy, edit, rotate, and delete events in the audit log.

## Troubleshooting

### Reveal prompt repeats immediately

Check `api.me()` and confirm the server returns a positive `reveal_ttl` after `api.openReveal()` succeeds. Also confirm browser requests use the authenticated same-origin session.

### Copy works but the audit entry is missing

Confirm the action calls `api.copyCredential(id)` after writing to the clipboard. Check both inline actions and detail-modal actions.

### Clipboard countdown does not restart

Confirm both the prior timeout and countdown interval are cleared before new timers are assigned.

### Mobile table disappears without cards

The grouped table layout must render `.cred-mobile-cards` alongside `.cred-table-wrap`. The media query hides the latter and displays the former.

### Existing secrets are overwritten during edit

Do not submit placeholders or masked values. Secret keys should be omitted from the update body unless the operator typed a replacement.

## Change record

The grouped credentials UX was introduced in commit `8691792` on branch `agent/go-vault-migration`.
