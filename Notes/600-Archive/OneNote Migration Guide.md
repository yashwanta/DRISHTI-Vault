---
date: 2026-08-06
tags: [migration, onenote, guide]
---

# 📦 OneNote → DRISHTI Notes Migration Guide

> **Goal:** Move all OneNote notebooks into this Obsidian vault as Markdown files.

---

## Option A — Export via OneNote App (Recommended for most notes)

### Step 1: Export OneNote to Word / PDF
1. Open **OneNote** (desktop app, not web)
2. Right-click on a **Section** → **Export**
3. Format: **`.docx` (Word)** — gives best formatting preservation
4. Export to a temp folder: `C:\Temp\OneNote-Export\`

### Step 2: Convert .docx to Markdown
Use the included PowerShell script: `scripts\onenote-to-md.ps1`

```powershell
# Run this from C:\DRISHTI\DRISHTI-Vault\
powershell -ExecutionPolicy Bypass -File scripts\onenote-to-md.ps1 -InputDir "C:\Temp\OneNote-Export" -OutputDir "C:\DRISHTI\DRISHTI-Vault\Notes\600-Archive\OneNote"
```

### Step 3: Review & File
1. Open the converted `.md` files in Obsidian
2. Move relevant notes to the right folder:
   - Incidents → `400-Incidents/`
   - Projects → `200-Projects/`
   - Meeting notes → `300-Meetings/`
   - Reference info → `500-Reference/`
   - Everything else → stays in `600-Archive/OneNote/`

---

## Option B — Markdown Export Tool (Best quality)

Use **Pandoc** (free, open source) for cleaner conversion:

```powershell
# Install Pandoc (run once)
winget install JohnMacFarlane.Pandoc

# Convert one file
pandoc "C:\Temp\MyNote.docx" -o "C:\DRISHTI\DRISHTI-Vault\Notes\600-Archive\MyNote.md"

# Batch convert all .docx in a folder
Get-ChildItem "C:\Temp\OneNote-Export\*.docx" | ForEach-Object {
    $out = "C:\DRISHTI\DRISHTI-Vault\Notes\600-Archive\OneNote\" + $_.BaseName + ".md"
    pandoc $_.FullName -o $out
    Write-Host "Converted: $($_.Name)"
}
```

---

## Option C — Obsidian Importer Plugin (Easiest, experimental)

1. In Obsidian, open **Settings → Community Plugins → Browse**
2. Search: **Importer** (by Obsidian team)
3. Install & enable
4. Command palette → **Import from OneNote** (uses Microsoft Graph API)
5. Sign in with your Microsoft account
6. Select notebooks to import

> ⚠ This method requires internet access and Microsoft sign-in.

---

## Naming Convention for Migrated Notes

Use this format when filing migrated notes:

```
YYYY-MM-DD — Note Title.md          ← For dated notes
Note Title.md                        ← For reference/evergreen notes
INC-YYYY-MM-DD — Incident Title.md  ← For incidents
CR-YYYY-MM-DD — Change Title.md     ← For change requests
```

---

## Frontmatter to Add to Migrated Notes

Paste this at the top of each migrated note and fill in the fields:

```yaml
---
date: YYYY-MM-DD
tags: [migrated, onenote]
original-notebook: MyNotebook
type: reference
---
```

---

## Checklist

- [ ] Export all OneNote notebooks to `C:\Temp\OneNote-Export\`
- [ ] Run conversion script (Option A or B)
- [ ] Review converted files — fix any formatting issues
- [ ] File notes into correct vault folders
- [ ] Add frontmatter tags
- [ ] Verify key notes are accessible
- [ ] Archive old OneNote notebooks (don't delete yet — keep for 90 days)
- [ ] After 90 days: confirm migration complete → delete old notebooks

---

## Tips

- **Images**: OneNote embeds images. Pandoc extracts them as files. Move images to `Notes/_Attachments/` and update links.
- **Tables**: Usually convert well. Check for formatting issues.
- **Handwritten/drawn notes**: Cannot be converted — screenshot and embed as image.
- **Links between pages**: Manual work — replace with `[[wikilinks]]` once imported.

---
_Back to [[🏠 Dashboard]] | [[200-Projects/Project Register]]_
