---
date: 2026-08-06
type: project
tags: [project, drishti, frontend, ux]
status: active
priority: high
owner: Yash
---

# Project: Credentials Page UX Overhaul

> **Status:** 🟢 Active | **Priority:** High
> **Files to change:** `apps/web/src/pages/CredentialsPage.tsx`, `apps/web/src/components/ui.tsx`, `apps/web/src/theme.ts`

---

## Problems with the Current Page

1. **Table has 11 columns** — Title, Site, Asset, Type, Username, Password, URL/Host, Port, Rotation Due, Status, Actions. Way too wide, requires horizontal scrolling on most screens.
2. **No quick-copy** — to copy a password you must click View → wait for reveal prompt → re-enter master password → then click Copy. Copying a username also goes through the full reveal flow unnecessarily.
3. **Rotation dates not highlighted** — overdue dates look identical to future dates. No visual urgency.
4. **No credential type icons** — all types look the same; hard to scan.
5. **4 buttons per row** (View / Edit / Rotate / Delete) — cramped, mobile-unfriendly.
6. **View modal is plain** — shows raw `<code>` blocks with no copy countdown visible.
7. **`(window as any).__pendingView` pattern** — fragile global state; breaks if user opens two tabs or triggers actions rapidly.
8. **No password generator** — users must create their own passwords when adding.
9. **No "show password" toggle** in the Add/Edit form — password field is plain text by default.
10. **No grouping by site** — all credentials in one flat list.
11. **No column sorting** — can't sort by rotation date to see what's most urgent.
12. **Edit form clears username/password** — editing anything forces re-entry of secrets because of the "keep existing" logic.

---

## Codex / AI Assistant Prompt

Copy the prompt below and paste it into Codex, GitHub Copilot Chat, or Claude.

---

### PROMPT — CREDENTIALS PAGE UX OVERHAUL

```
You are working on DRISHTI-Vault, a secure IT credential vault built with React 18 + TypeScript + Vite (frontend) and Go net/http (backend). Read AGENTS.md at the project root first — it explains the full architecture, security rules, and file map.

## Your task

Rewrite `apps/web/src/pages/CredentialsPage.tsx` to make the credentials page significantly more user-friendly while keeping all existing security rules intact. Do NOT touch the Go backend. Do NOT add new npm packages (no Material UI, no Radix, no Tailwind). Use the existing CSS variables from `theme.ts`.

## Files to read before writing any code

1. `AGENTS.md` — project overview, security rules, coding conventions
2. `apps/web/src/pages/CredentialsPage.tsx` — current implementation (REPLACE this)
3. `apps/web/src/components/ui.tsx` — shared components (Modal, Field, StatusPill, useToast, ConfirmDialog, Empty)
4. `apps/web/src/theme.ts` — CSS variables and global stylesheet
5. `apps/web/src/api.ts` — all API calls; use these exactly as-is
6. `apps/web/src/types.ts` — TypeScript types

## Changes required

### 1. LAYOUT — Switch from flat table to card rows grouped by site

Replace the single wide table with a layout that:
- Groups credentials by site (e.g. "Springfield", "Hopkinsville", "No Site")
- Each site is a collapsible section with a header showing site name + count
- Within each site, use a more compact table with FEWER columns:
  - Title | Type icon | Username (masked) | Status | Rotation | Actions
  - Remove: URL/Host, Port columns from the default view (show them in the View modal)
- Add a toggle button "Table / Cards" to switch between the grouped-table and a card grid

### 2. CREDENTIAL TYPE ICONS — Add emoji/icon prefix to the type pill

Map cred_type → icon:
- "Linux SSH"       → 🖥️
- "Windows RDP"    → 🪟
- "Web Login"      → 🌐
- "Database"       → 🗄️
- "API Key"        → 🔑
- "WiFi"           → 📶
- "Network Device" → 🔌
- "Email"          → 📧
- "Service Account"→ ⚙️
- default          → 🔐

Use a helper function `credIcon(type: string): string`.

### 3. ROTATION BADGES — Color-code rotation due dates

Add a helper `rotationStatus(date: string | null): "overdue" | "soon" | "ok" | "none"`:
- null → "none" (grey, no badge)
- past today → "overdue" (red pill: var(--danger))
- within 30 days → "soon" (orange pill: var(--warning))  
- 30+ days away → "ok" (green pill: var(--success))

The rotation badge in the table should be colored accordingly, not plain text.

### 4. INLINE QUICK-COPY — Copy username without reveal; copy password with reveal

In each table row, add two small icon buttons:
- 📋 Copy username — copies the MASKED username text (no reveal needed — it is already shown masked; for real copy, we need reveal). Actually: if reveal_open → call viewCredential then copy. If not reveal_open → trigger reveal flow then copy.
- 🔐 Copy password — always requires reveal flow → copy password → start clipboard clear timer.

These replace the "View" button for the common case. Keep "View" for seeing full details.

### 5. FIX REVEAL STATE — Replace window globals with React state

Current code uses `(window as any).__pendingView`, `__pendingCopy`, `__pendingRotate` which is fragile. Replace with a React state machine:

```typescript
type PendingAction =
  | { type: "view"; credential: Credential }
  | { type: "copy"; credential: Credential; field: "username" | "password" }
  | { type: "rotate"; credential: Credential };

const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
const [showReveal, setShowReveal] = React.useState(false);
```

When reveal is needed: set `pendingAction` + `setShowReveal(true)`.
After successful reveal: read `pendingAction`, execute it, clear both states.

### 6. PASSWORD GENERATOR — Add to Add/Edit form

In the Add/Edit modal, next to the Password field, add a "Generate" button that:
- Generates a secure random password client-side: 20 chars, upper+lower+digit+symbol
- Uses `crypto.getRandomValues()` — never `Math.random()`
- Populates the password field with the generated value
- Shows a "show/hide" 👁 toggle on the password field (type="password" by default, toggle to type="text")

Password generation logic:
```typescript
function generatePassword(length = 20): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
}
```

### 7. EDIT FORM — Preserve existing secrets cleanly

When editing an existing credential:
- Username field: pre-fill with the MASKED value as placeholder text, not in the value
- Password field: placeholder = "Leave blank to keep existing password"
- If the user leaves username blank → send `username: undefined` (backend keeps existing)
- If user leaves password blank → send `password: undefined` (backend keeps existing)
- Add a helper note below the password field: "Only fill in fields you want to change"

### 8. SORT — Add sortable column headers

Add sort state: `const [sort, setSort] = React.useState<{col: string; dir: "asc"|"desc"}>({col: "title", dir: "asc"})`.

Clicking a column header toggles asc/desc. Sort client-side on: title, site_name, cred_type, rotation_due, status.
Show a ▲/▼ indicator next to the active sort column header.

### 9. VIEW MODAL — Improve the detail modal

The view modal after reveal should:
- Show all fields in a clean 2-column layout
- Have a visible countdown timer: "Reveal window: 4m 30s" (poll `api.me()` every 30s to get `reveal_ttl`)
- Password row: show the password in a monospace box with a copy button + "clears in Xs" label (start countdown on copy, visible in the button)
- Username row: copy button that does NOT require reveal (username is not secret)
- Add a "Launch URL" button if `url_host` starts with http

### 10. RESPONSIVE — Collapse to card view on narrow screens

Add CSS:
```css
@media (max-width: 768px) {
  .cred-table { display: none; }
  .cred-cards { display: grid; }
}
```

Each credential card shows: title, type icon, site, masked username, rotation badge, and an action menu (⋮ button with View/Edit/Rotate/Delete).

## Constraints

- Keep ALL security rules from AGENTS.md:
  - Clipboard auto-clear timer (30s default from `clipboard_ttl`)
  - Reveal window required for all password access
  - Audit call (`api.copyCredential(id)`) after every password copy
  - No secrets in state beyond what's needed for the current modal
- Do not use `any` for types if avoidable — use `Credential` and `CredentialDetail` from `types.ts`
- Keep the reveal/master-password prompt using the existing `PasswordPrompt` component
- Keep all existing API calls exactly as they are in `api.ts`
- Add new CSS to `theme.ts → GLOBAL_CSS` string, not inline styles, where possible

## Output

Produce a complete replacement for `apps/web/src/pages/CredentialsPage.tsx`.
If you add new reusable components (e.g. `RotationBadge`, `CredTypeIcon`), either:
- Put them at the top of `CredentialsPage.tsx` (preferred for now), or
- Create `apps/web/src/components/CredentialComponents.tsx` and import from there.

Also append any new CSS variables or classes to `apps/web/src/theme.ts → GLOBAL_CSS`.
```

---

## Checklist

- [ ] Read AGENTS.md and all 6 source files before writing
- [ ] Replace credential table with grouped-by-site layout
- [ ] Add credential type icons
- [ ] Add rotation date color badges
- [ ] Add inline quick-copy buttons per row
- [ ] Fix reveal state management (remove window globals)
- [ ] Add password generator + show/hide toggle
- [ ] Fix edit form secret-preservation UX
- [ ] Add sortable column headers
- [ ] Improve View modal with countdown + better layout
- [ ] Add responsive card view for mobile
- [ ] Verify all security rules still hold
- [ ] Test: add → view → copy → rotate → delete

---
_Back to [[Project Register]] | Code: `apps/web/src/pages/CredentialsPage.tsx`_
