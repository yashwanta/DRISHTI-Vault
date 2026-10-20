---
date: 2026-06-17
type: project
tags: [project, security, drishti, platform]
status: active
priority: high
owner: Yash
---

# Project: DRISHTI-Vault — Full Platform

> **Status:** 🟢 Active | **Priority:** High | **Owner:** Yash  
> **One project. Two parts: the App + the Notes vault.**

---

## What This Is

DRISHTI-Vault is a unified IT management platform made of two parts:

| Part | Location | Purpose |
|------|----------|---------|
| **App** (Go + React) | `C:\DRISHTI\DRISHTI-Vault\` | Secure credential vault, server inventory, audit log |
| **Notes vault** (Obsidian) | `C:\DRISHTI\DRISHTI-Vault\Notes\` | IT notes, daily logs, incidents, projects, reference |

Together they replace: OneNote + Excel VM tracker + scattered password sheets.

---

## App — Current Features

- [x] Encrypted credential vault (AES-256-GCM, Argon2id)
- [x] RBAC: Super Admin (Yash) + Global/Location Admins
- [x] Proxmox VM & Server Inventory (Assets)
- [x] Sites/Plants (Springfield, Hopkinsville)
- [x] Network Reference (VLANs, subnets, DNS)
- [x] Change Log with approval trail
- [x] Immutable Audit Log
- [x] Encrypted Backup/Restore
- [x] Excel import (AMR Proxmox tracker)
- [x] CSV bulk import
- [x] Encrypted Notes (in-app)
- [x] Container deployment (Podman)

## App — In Progress / Planned

- [ ] [[Credentials Page UX Overhaul]] — better UX: card view, icons, quick-copy, password gen
- [ ] Credential expiry email/desktop notifications
- [ ] Bulk credential import from CSV
- [ ] Mobile-responsive layout pass

---

## Notes Vault — Current Features

- [x] Obsidian vault at `Notes/`
- [x] Full Obsidian config pre-wired (.obsidian/)
- [x] 7 IT-Manager templates (Daily, Meeting, Incident, Project, Security Review, Change Request, Vendor Review)
- [x] Dashboard + Quick Capture
- [x] Reference notes (Network, Contacts, Policies, Glossary)
- [x] Project and incident registers

## Notes Vault — In Progress / Planned

- [ ] [[600-Archive/OneNote Migration Guide|OneNote migration]] — export → convert → file
- [ ] Install Obsidian community plugins (Dataview, Tasks, Kanban, Calendar)
- [ ] Weekly review template
- [ ] Link credential entries in app ↔ notes (cross-reference by asset name)

---

## Key Files for AI Coding Assistants

Start with **`AGENTS.md`** in the project root. It contains:
- Full file map
- Stack details
- Security rules (non-negotiable)
- API endpoints
- Coding conventions
- Known issues list

Then read the specific project note for what you're working on:
- Credentials UX: `Notes/200-Projects/Credentials Page UX Overhaul.md`

---

## Architecture Summary

```
Browser (localhost only)
    ↕ HTTP (127.0.0.1:7788)
Go backend (net/http)
    ↕ SQL
SQLite (data/drishtivault.db)
    — credentials encrypted at rest (AES-256-GCM)
    — master password → Argon2id → KEK → unwrap DEK
    — DEK lives in server RAM only
```

No cloud. No telemetry. No external API calls. 100% local.

---

## Dev Quick Start

```powershell
# Terminal 1 — backend
cd C:\DRISHTI\DRISHTI-Vault\apps\api-go
go run ./cmd/server

# Terminal 2 — frontend
cd C:\DRISHTI\DRISHTI-Vault\apps\web
npm run dev
# → http://127.0.0.1:5174

# Or run containerized:
cd C:\DRISHTI\DRISHTI-Vault
powershell -ExecutionPolicy Bypass -File scripts\podman-drishtivault.ps1
# → http://127.0.0.1:7788
```

---
_Back to [[Project Register]] | Context file: `AGENTS.md`_
