---
tags: [guide, setup, obsidian]
---

# 🚀 Obsidian Setup Guide

> Get Obsidian running on your DRISHTI Notes vault in 10 minutes.

---

## Step 1 — Download & Install Obsidian

1. Go to **https://obsidian.md** → Download for Windows
2. Run the installer
3. Launch Obsidian

---

## Step 2 — Open This Vault

1. On the Obsidian startup screen, click **"Open folder as vault"**
2. Navigate to: `C:\DRISHTI\DRISHTI-Vault\Notes`
3. Click **Select Folder**

Obsidian will load the vault with all settings pre-configured. ✅

---

## Step 3 — Install Community Plugins

Go to **Settings (gear icon)** → **Community plugins** → **Turn on community plugins** → **Browse**

Install these (they're free):

### Essential — Install These First

| Plugin | Author | Why |
|--------|--------|-----|
| **Dataview** | blacksmithgu | Live tables/lists that query your notes like a database |
| **Tasks** | obsidian-tasks-group | Advanced task management with due dates, recurrence |
| **Kanban** | mgmeyers | Visual project boards (like Trello, inside Obsidian) |
| **Calendar** | liamcain | Calendar sidebar that shows daily notes |

### Highly Recommended

| Plugin | Author | Why |
|--------|--------|-----|
| **Templater** | SilentVoid13 | More powerful templates (auto-fills dates, prompts you for title) |
| **Obsidian Git** | Vinzent03 | Auto-commits your notes to git — free backup |
| **Omnisearch** | scambier | Smarter full-text search across all notes |
| **Table Editor** | mgmeyers | Edit markdown tables without pain |
| **Tag Wrangler** | pjeby | Rename/merge tags across the vault |

### For Advanced Users

| Plugin | Author | Why |
|--------|--------|-----|
| **ExcalidrawT** | zsviczian | Draw diagrams/network maps embedded in notes |
| **Mind Map** | niklasp | Visualize note structure as a mind map |
| **Periodic Notes** | liamcain | Weekly/monthly/quarterly review notes |

---

## Step 4 — Upgrade Templates to Templater

After installing **Templater**:
1. Settings → Templater → Template folder: `_Templates`
2. Enable "Trigger Templater on new file creation": ON
3. Now your templates support dynamic variables like `<% tp.date.now() %>`

---

## Step 5 — Set Up Obsidian Git (Auto Backup)

Since DRISHTI-Vault is already a Git repo:
1. Install **Obsidian Git** plugin
2. Settings → Obsidian Git:
   - Auto pull interval: 0 (disabled — local vault)
   - Auto commit interval: 60 minutes
   - Commit message: `vault backup: {{date}}`
3. Your notes auto-commit to git every hour ✅

---

## Step 6 — Create Your First Daily Note

Press `Ctrl+Shift+D` → Today's daily note opens from the template.

Or press `Ctrl+P` → type **"Daily notes: Open today's daily note"**

---

## Obsidian vs OneNote — Feature Comparison

| Feature | OneNote | Obsidian (this vault) |
|---------|---------|----------------------|
| Free | Yes | Yes (personal use) |
| Offline / local | Yes | Yes ✅ |
| Markdown | No | Yes ✅ |
| Backlinks (`[[note]]`) | No | Yes ✅ |
| Graph view | No | Yes ✅ |
| Tags | Basic | Advanced + graph coloring ✅ |
| Templates | Basic | Full Templater support ✅ |
| Kanban boards | No | Yes (plugin) ✅ |
| Git backup | No | Yes (plugin) ✅ |
| Version history | Yes | Yes (git) ✅ |
| Search | Basic | Full-text + regex ✅ |
| Tables | Basic | Markdown + Table Editor ✅ |
| Sync across devices | Microsoft 365 | Obsidian Sync ($) or git |
| Works with DRISHTI-Vault | Separate app | Same folder ✅ |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+P` | Command palette — run any command |
| `Ctrl+O` | Quick-open any note |
| `Ctrl+G` | Graph view |
| `Ctrl+Shift+D` | Today's daily note |
| `Ctrl+L` | Toggle checkbox |
| `Ctrl+E` | Toggle Edit / Preview mode |
| `[[` + type | Insert wikilink |
| `#` + type | Insert tag |
| `Ctrl+F` | Search current note |
| `Ctrl+Shift+F` | Search entire vault |

---
_Back to [[🏠 Dashboard]]_
