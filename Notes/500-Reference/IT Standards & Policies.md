---
tags: [reference, policy, standards]
updated: 2026-08-06
---

# 📜 IT Standards & Policies

> Internal standards for the IT team. Update as policies change.

---

## Password & Credentials Policy

| Rule | Standard |
|------|----------|
| Minimum length | 16 characters |
| Complexity | Upper + lower + number + symbol |
| Rotation — service accounts | 90 days |
| Rotation — privileged accounts | 60 days |
| MFA required | All admin / remote access accounts |
| Shared accounts | Not permitted (use DRISHTI-Vault per-user) |
| Storage | DRISHTI-Vault only — never in spreadsheets or email |

---

## Patching Policy

| System Type | Patch Cycle | Emergency Patch SLA |
|-------------|------------|---------------------|
| Servers (OS) | Monthly | 24 hours (Critical CVE) |
| Workstations | Monthly | 72 hours |
| Network devices | Quarterly | 48 hours |
| Applications | Per-vendor release | 48 hours (Critical) |

---

## Backup Policy

| System | Frequency | Retention | Tested |
|--------|-----------|-----------|--------|
| Critical servers | Daily | 30 days + 12 monthly | Monthly |
| Workstations | Weekly | 4 weeks | Quarterly |
| DRISHTI-Vault | Weekly encrypted export | 3 copies | Monthly |

---

## Change Management

- All changes require a [[_Templates/Change Request Template|Change Request (CR)]]
- Emergency changes: verbal approval from IT Manager, CR filed within 24h
- Change window: Saturdays 02:00–06:00 (production systems)
- Rollback plan required for all P1/P2 risk changes

---

## Incident Severity & SLA

| Severity | Response | Resolution Target | Escalate to Manager |
|----------|----------|-------------------|---------------------|
| P1 Critical | Immediate | 4 hours | Immediately |
| P2 Major | 1 hour | 8 hours | 30 minutes if no progress |
| P3 Minor | 4 hours | 2 business days | 1 day if no progress |
| P4 Low | Next business day | 5 business days | Never (self-resolve) |

---

## Acceptable Use

- Company devices for company work only
- No personal cloud storage (OneDrive personal, Google Drive) for company data
- VPN required for all remote access
- USB drives: IT-issued encrypted only

---

## References & Documents

- 
- 

---
_Back to [[🏠 Dashboard]]_
