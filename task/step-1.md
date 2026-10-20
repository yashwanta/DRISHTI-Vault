# DRISHTI-Vault — Notes Section UI Rebuild
## Codex Prompt Guide | Step 1

> Use these prompts **in order**, one at a time, in Codex / ChatGPT Code Mode / GitHub Copilot Chat.
> File to work on: `apps/web/src/pages/NotesPage.tsx`
> After each prompt, paste the updated file back before sending the next prompt.

---

## PROMPT 1 — Base Layout (Sidebar + Full Canvas Reader)

```
I am working on a React + TypeScript + MUI v5 project called DRISHTI-Vault.
File: apps/web/src/pages/NotesPage.tsx

Rebuild the top-level layout as follows:

OVERALL LAYOUT:
- The page is a horizontal flex row, height: 100%, overflow: hidden.
- Left side: a fixed-width sidebar (width: 260px, flex-shrink: 0).
- Right side: a main content area (flex: 1, overflow: hidden) that fills all remaining space.

LEFT SIDEBAR RULES:
- Background color: theme dark navy (#0f0f1a in dark mode, #fafafa in light mode).
- Has a right border using theme.palette.divider.
- At the top: a search TextField (size small, full width) to filter notes by title or tag.
- Below the search bar: a collapsible parent item labeled "Notes" with an expand/collapse arrow icon (ExpandMore / ExpandLess from MUI icons).
- When expanded, each note appears as a ListItemButton row inside a MUI Collapse:
    - NoteIcon (small) on the left.
    - Note title as body2 text, noWrap.
    - Tag names shown as caption below the title (first 2 tags only, prefixed with #).
    - No card, no tile, no elevation, no border around individual note rows.
    - Row height is compact (~48px).
- "Notes" parent is expanded by default.
- Note count shown at the very bottom of the sidebar as caption text.

RIGHT MAIN AREA RULES:
- When NO note is selected: show a centered placeholder with a NoteIcon (large, muted) and text "Select a note to read".
- When a note IS selected: render the full-canvas reader (see Prompt 2).
- There is NO card, NO Paper, NO MUI Card component wrapping the right area.
- The right area is a plain Box (flex: 1, display: flex, flexDirection: column, overflow: hidden).

Do not change any upload, export, graph-view, or duplicate-warning logic yet. Only change the layout and sidebar list rendering.
```

---

## PROMPT 2 — Full Canvas Note Reader (No Card, No Frame)

```
Still in apps/web/src/pages/NotesPage.tsx.

When a note is selected and the view mode is "reader", the right-hand area must render as follows:

READER HEADER (top bar, fixed height ~48px):
- A back arrow IconButton (ArrowBack icon) on the left — clicking it deselects the note and returns to the placeholder.
- The note title as Typography variant="subtitle1" fontWeight={700} noWrap, flex: 1.
- A download IconButton (Download icon) on the far right — clicking it exports the note as .md with Obsidian YAML frontmatter.
- This header has a bottom border using theme.palette.divider.
- Background matches the page background (no card elevation).

TAGS ROW (below header, only if the note has tags):
- A horizontal flex row of MUI Chip components, one per tag.
- Each chip: size="small", icon=TagIcon, color="primary", variant="outlined".
- Has a bottom border using theme.palette.divider.
- Padding: 6px 16px.

CONTENT AREA (below tags, fills remaining height):
- A Box with overflow-y: auto, padding: 3 (24px), flex: 1.
- Renders the note's markdown content using the renderMarkdown() function already in the file.
- NO card wrapper, NO Paper, NO elevation, NO border around this area.
- Background is transparent (inherits from page background).
- The content starts at the top of this area — no extra top margin.

The transition from sidebar row click → full canvas reader must be instant (no animation needed).
```

---

## PROMPT 3 — Color-Coded Syntax Highlighting in Reader

```
Still in apps/web/src/pages/NotesPage.tsx.

Implement full syntax highlighting for fenced code blocks inside the note reader.

DETECTION:
- Any line starting with ``` followed by a language name opens a code block.
- The block ends at the next line that is exactly ```.
- Supported languages: bash, sh, shell, zsh, python, py, go, typescript, tsx, ts, javascript, jsx, js, yaml, yml, json, sql, dockerfile.
- If no language is specified, render as plain monospace text without coloring.

CODE BLOCK WRAPPER STYLES:
- Background: #1a1a2e (dark mode) / #f3f4f6 (light mode).
- Border: 1px solid theme.palette.divider.
- Border radius: 8px.
- Padding: 16px.
- Overflow-x: auto (horizontal scroll for long lines).
- Font family: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace.
- Font size: 0.82rem.
- Line height: 1.6.
- A small language label Chip in the top-right corner of the block (size="small", opacity 0.7).

TOKEN COLORS (apply to both dark and light mode using theme palette):
- keywords   → theme.palette.primary.light   (purple/indigo)
- strings    → theme.palette.success.light   (green)
- comments   → theme.palette.text.disabled   (gray)
- numbers    → theme.palette.warning.light   (amber)
- functions  → theme.palette.info.light      (blue)
- plain text → theme.palette.text.primary

LANGUAGE-SPECIFIC KEYWORD LISTS:

bash/sh/shell/zsh:
  keywords: if, then, else, fi, for, do, done, while, case, esac, function, export, local, return, echo, source, sudo, cd, ls, mkdir, rm, cp, mv, chmod, chown, grep, awk, sed, curl, wget, podman, docker, git

python/py:
  keywords: def, class, import, from, as, return, if, elif, else, for, while, with, try, except, finally, pass, break, continue, lambda, yield, async, await, True, False, None, self, super
  also highlight: function names immediately followed by (

go:
  keywords: func, package, import, var, const, type, struct, interface, map, chan, go, defer, select, case, default, if, else, for, range, return, break, continue, switch, fallthrough, nil, true, false, make, new, len, cap, append, copy, delete, error

typescript/tsx/ts and javascript/jsx/js:
  keywords: const, let, var, function, class, interface, type, enum, import, export, from, return, if, else, for, while, do, switch, case, break, continue, new, typeof, instanceof, async, await, try, catch, finally, throw, extends, implements, super, this, null, undefined, true, false

yaml/yml:
  keys: any word immediately followed by a colon (highlight as keyword color)
  strings, numbers

json:
  strings (keys and values), numbers, true, false, null

sql:
  keywords: SELECT, FROM, WHERE, JOIN, LEFT, RIGHT, INNER, OUTER, ON, AS, AND, OR, NOT, IN, IS, NULL, ORDER, BY, GROUP, HAVING, LIMIT, OFFSET, INSERT, INTO, VALUES, UPDATE, SET, DELETE, CREATE, TABLE, INDEX, DROP, ALTER (case-insensitive)

dockerfile:
  keywords: FROM, RUN, CMD, ENTRYPOINT, COPY, ADD, ENV, EXPOSE, WORKDIR, USER, VOLUME, ARG, LABEL, ONBUILD, HEALTHCHECK

INLINE CODE (single backtick):
- Render as <code> with background rgba(128,128,128,0.15), border-radius 3px, padding 1px 4px, same monospace font, font-size 0.85em.
- No syntax coloring needed for inline code.

OTHER MARKDOWN TO RENDER:
- # ## ### headings → MUI Typography h4/h5/h6 with fontWeight 700
- **bold** → <strong>
- *italic* → <em>
- [text](url) → <a> styled with theme primary color
- > blockquote → left border 3px primary color, italic, muted text
- - / * unordered list → <ul> with body2 Typography per item
- 1. ordered list → <ol> with body2 Typography per item
- --- → MUI Divider
- #tag (hash followed immediately by word) → MUI Chip with TagIcon, primary outlined
```

---

## PROMPT 4 — Obsidian Graph View

```
Still in apps/web/src/pages/NotesPage.tsx.

Add a Graph View accessible via a BubbleChart icon button in the sidebar toolbar (between the upload button and the export menu button).

When graph view is active, it replaces the right-hand content area entirely (full canvas, no card wrapper).

GRAPH LAYOUT:
- SVG canvas, width 800, height 600, inside a scrollable Box.
- Tag hub nodes: rendered as colored rectangles (squares, ~18px radius), arranged in a circle of radius 180px centered at (400, 300).
- Note nodes: rendered as colored circles (~10px radius), clustered near their primary tag hub.
- Each note is connected to each of its tags by a line with an arrowhead.

NODE COLORS:
- Assign one distinct color per tag from this palette (cycle if more than 10 tags):
  #6366f1, #8b5cf6, #ec4899, #f59e0b, #10b981, #3b82f6, #ef4444, #14b8a6, #f97316, #84cc16
- Note node color = color of its primary tag (first tag in its tags array).
- Tag hub node color = its assigned color.

INTERACTIONS:
- Hover on any node: increase radius by 3px and opacity to 1.
- Click on a note node: deselect graph view, open that note in full-canvas reader mode.
- Tag hub nodes are not clickable.

LEGEND:
- A horizontal strip above the SVG showing: one colored dot + tag name per tag, plus a "note (circle)" and "tag hub (square)" shape key.

HEADER BAR (above legend):
- "Obsidian Graph View" label with a BubbleChart icon.
- A Close (X) IconButton on the right that returns to the note browser / placeholder.
```

---

## PROMPT 5 — Duplicate Import Warning Modal

```
Still in apps/web/src/pages/NotesPage.tsx.

When the user uploads one or more .md files using the hidden file input:

STEP 1 — SCAN BEFORE IMPORTING:
- Compare each incoming file's filename against all existing notes in state.
- Split results into two arrays: duplicates (filename already exists) and clean (new files).

STEP 2 — IF DUPLICATES FOUND:
- Do NOT import anything yet.
- Open a MUI Dialog modal immediately.
- Dialog title: "Duplicate Files Detected" with a Warning icon (color="warning") beside it.
- Dialog content:
    - A MUI Alert severity="warning" at the top: "{n} file(s) already exist in your vault."
    - A list of each duplicate showing: filename (bold), last modified date (caption).
    - If there are clean files too, show a caption: "{n} other file(s) will be imported normally."
- Dialog actions (three buttons):
    - Cancel: closes the dialog, imports nothing.
    - Skip Duplicates: imports only the clean files, skips duplicates.
    - Import All (Replace): replaces existing notes with the incoming versions AND imports clean files.

STEP 3 — IF NO DUPLICATES:
- Import all files immediately with no dialog.

After any import, show a MUI Snackbar (bottom-right, auto-hide 3 seconds) confirming how many notes were imported.
```

---

## PROMPT 6 — Export: Single Note .md and Full Vault ZIP

```
Still in apps/web/src/pages/NotesPage.tsx.

Add export functionality via a MoreVert (⋮) IconButton in the sidebar toolbar, opening a MUI Menu with two options:

OPTION 1 — "Export current note as .md"
- Only works if a note is currently open in the reader. If not, show a Snackbar: "Open a note first."
- Generates a .md file with Obsidian-compatible YAML frontmatter at the top:

  ---
  title: "The Note Title"
  tags: ["tag1", "tag2"]
  created: 2024-01-15T10:30:00.000Z
  modified: 2024-01-20T14:22:00.000Z
  ---

  [rest of note content here]

- Triggers a browser download of the file using a temporary <a> element with a blob URL.
- Filename: the note's original filename, or "{title}.md" if no filename is stored.

OPTION 2 — "Export Vault as ZIP (Obsidian-compatible)"
- Packages all notes in state into a ZIP file named "DRISHTI-Vault.zip".
- Uses the jszip library (already installed as a dependency).
- ZIP structure:
    DRISHTI-Vault/
      Note1.md          ← each note with YAML frontmatter
      Note2.md
      .obsidian/
        app.json        ← {"legacyEditor": false, "livePreview": true}
- Triggers a browser download of the ZIP using a temporary <a> element with a blob URL.
- If no notes exist, show a Snackbar: "No notes to export."

Both options close the menu after triggering.
```

---

## FINAL VERIFICATION CHECKLIST

After all 6 prompts are applied, verify:

- [ ] Left sidebar shows notes as compact vertical rows (no card tiles)
- [ ] Clicking a note opens it full-width on the right — no Card, no Paper wrapper
- [ ] Code blocks inside notes are syntax-highlighted with colored tokens
- [ ] Language chip appears in the top-right of each code block
- [ ] BubbleChart icon toggles Graph View (full canvas, no card)
- [ ] Graph shows tag squares + note circles connected by lines with a legend
- [ ] Clicking a note in the graph opens it in the reader
- [ ] Uploading a .md that already exists triggers the duplicate warning modal
- [ ] Skip / Import All / Cancel all work correctly
- [ ] ⋮ menu → Export note as .md downloads a file with YAML frontmatter
- [ ] ⋮ menu → Export Vault as ZIP downloads a .zip with .obsidian/ stub

---

## Build & Deploy (run after all changes are confirmed)

```bash
cd C:\DRISHTI\DRISHTI-Vault\apps\web
npm install jszip
npm run build

podman build -t localhost/drishti-vault:latest C:\DRISHTI\DRISHTI-Vault
podman restart DRISHTIVault
```

Open: http://localhost:7788

---

*DRISHTI-Vault | Notes UI Rebuild | Step 1 Prompts | 2026-08-20*
