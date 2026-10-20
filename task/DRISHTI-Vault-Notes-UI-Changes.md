# DRISHTI-Vault — Notes UI Update Changelog

**Session:** 2026-08-20  
**Project:** `C:\DRISHTI\DRISHTI-Vault` (React/TS + Go, Podman port 7788)  
**Files Modified:**
- `apps\web\src\pages\NotesPage.tsx`
- `apps\web\src\theme.ts`

---

## Changes Requested

### 1. Document Browser
- Vertical left sidebar panel (260px wide) listing all imported notes
- Click any note to open it in the reading pane on the right
- Search bar at the top filters by title, tag, or content
- Note count displayed at the bottom of the panel
- Empty state message when no notes are loaded

### 2. Color-Coded Reader (Syntax Highlighting)
- Full markdown rendering in the right reading pane
- Fenced code blocks highlighted per language:
  - `bash` / `sh` / `shell` / `zsh`
  - `python` / `py`
  - `go`
  - `typescript` / `tsx` / `ts`
  - `javascript` / `jsx` / `js`
  - `yaml` / `yml`
  - `json`
  - `sql`
  - `dockerfile`
- Token categories colored: keywords, strings, comments, numbers, functions
- Language label chip shown in top-right corner of each code block
- Monospace font: JetBrains Mono / Fira Code / Cascadia Code
- Inline markdown support: **bold**, *italic*, `code`, [links](url), #tags as chips

### 3. Obsidian Visual Map (Graph View)
- Toggle via the bubble-chart icon in the sidebar toolbar
- SVG-based force-layout graph (800×600)
- **Tag hub nodes** — rendered as colored squares, arranged in a ring
- **Note nodes** — rendered as colored circles, clustered near their primary tag
- Node color = tag color (up to 10 distinct colors cycling)
- Edges drawn from each note to its tags with arrowheads
- Hover highlight on nodes
- Click a note node to open it in the reader
- Legend strip at the top showing each tag color + note/hub shape key

### 4. Duplicate Import Warning
- On file upload, all incoming filenames are scanned against existing vault notes
- If duplicates are found, a modal dialog appears before any import occurs
- Modal lists each duplicate with its filename and last-modified date
- Three action buttons:
  - **Cancel** — abort the entire import
  - **Skip Duplicates** — import only the new (non-duplicate) files
  - **Import All (Replace)** — replace existing notes with the incoming versions
- Non-duplicate files in the same upload batch are always imported normally

### 5. Export to .md / Export Vault as ZIP
- Accessed via the ⋮ (More) menu in the sidebar toolbar
- **Export current note as .md** — downloads the open note with Obsidian-compatible YAML frontmatter:
  ```yaml
  ---
  title: "Note Title"
  tags: ["tag1", "tag2"]
  created: <ISO timestamp>
  modified: <ISO timestamp>
  ---
  ```
- **Export Vault as ZIP** — packages all notes into `DRISHTI-Vault.zip` with:
  - Each note as an `.md` file with frontmatter
  - An `.obsidian/app.json` config stub for direct Obsidian import
- Uses `jszip` library (added as npm dependency)

---

## Files Delivered

| File | Destination |
|------|------------|
| `NotesPage.tsx` | `apps\web\src\pages\NotesPage.tsx` |
| `theme.ts` | `apps\web\src\theme.ts` |

---

## Build & Deploy Commands

```bash
# Install new dependency (run once)
cd C:\DRISHTI\DRISHTI-Vault\apps\web
npm install jszip

# Build frontend
npm run build

# Rebuild container image
podman build -t localhost/drishti-vault:latest C:\DRISHTI\DRISHTI-Vault

# Restart running container
podman restart DRISHTIVault
```

---

## Theme Changes (theme.ts)

- Added `syntaxColors` export — light and dark token palettes for the code renderer
- Added `graphColors` export — 10-color array for graph view nodes
- Added `notesPanelTokens` export — sidebar/reader/code background colors per mode
- Extended MUI component overrides:
  - `MuiListItemButton` — selected state uses brand purple tint
  - `MuiMenu` / `MuiMenuItem` — rounded, shadowed, compact
  - `MuiDialog` — rounded corners (14px)
  - Custom scrollbar styles (6px, rounded, theme-aware)
  - Monospace font stack injected via `MuiCssBaseline`
- Both `darkTheme` and `lightTheme` exported; default export is `darkTheme`

---

*Last updated: 2026-08-20*
