---
date: 2026-06-17
type: project
tags: [project, security, drishti]
status: active
priority: high
owner: Yash
stakeholders: [IT Team]
---

# Project: DRISHTI-Vault Credential Manager

> **Status:** 🟢 Active | **Priority:** High | **Owner:** Yash

---

## Overview
DRISHTI-Vault is a **secure localhost-only IT password vault & server inventory** application. It replaces the Excel-based AMR Proxmox VM tracker and provides encrypted credential storage for IT systems.

Runs at `http://127.0.0.1:7788` — never exposed to the network.

## Goals
- [x] Replace Excel credential tracking
- [x] Encrypt passwords with AES-256-GCM
- [x] RBAC with Super Admin (Yash) + Global/Location Admins
- [x] Proxmox VM & Server Inventory
- [ ] OneNote migration — bring IT notes into the Notes vault
- [ ] Plugin: Kanban board for IT tasks

## Stack
| Layer | Tech |
|-------|------|
| Backend | Go (net/http, `127.0.0.1:7788`) |
| Frontend | React + TypeScript + Vite |
| Database | SQLite (`data/drishtivault.db`) |
| Cipher | AES-256-GCM |
| KDF | Argon2id |

## Key Features
- Encrypted credential vault with master-password re-auth to reveal
- Proxmox VM / server inventory
- Network reference (VLANs, subnets, DNS)
- Audit log (immutable)
- Encrypted backup/restore

## Notes & Decisions
- Binds to `127.0.0.1` only — never exposed remotely
- Two separate passwords: Master Password (vault access) + Vault Backup Password
- No cloud sync, no telemetry

## References
- Codebase: `C:\DRISHTI\DRISHTI-Vault\`
- Docs: [[../../docs/SECURITY.md]] | [[../../docs/RECOVERY.md]]

---
_Back to [[Project Register]]_
