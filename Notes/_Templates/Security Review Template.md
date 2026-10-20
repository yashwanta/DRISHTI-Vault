---
date: {{date:YYYY-MM-DD}}
type: security-review
tags: [security, review]
scope: 
reviewer: Yash
status: in-progress
risk-level: medium
---

# Security Review: {{title}}

> **Date:** {{date:MMMM D, YYYY}}  
> **Scope:** 
> **Risk Level:** 🟡 Medium  

---

## Scope & Objectives
_What system / change / vendor is being reviewed?_

## Review Checklist

### Access & Authentication
- [ ] MFA enabled
- [ ] Least-privilege principle applied
- [ ] Service accounts reviewed
- [ ] Default credentials changed
- [ ] Password policy meets standard

### Network & Perimeter
- [ ] Firewall rules reviewed
- [ ] Unnecessary ports closed
- [ ] Network segmentation in place (VLANs)
- [ ] VPN / remote access secured

### Data Protection
- [ ] Data classified appropriately
- [ ] Encryption at rest: Yes / No / N/A
- [ ] Encryption in transit (TLS 1.2+): Yes / No / N/A
- [ ] Backup encrypted and tested

### Logging & Monitoring
- [ ] Audit logging enabled
- [ ] Logs centralized / SIEM ingesting
- [ ] Alerts configured for critical events
- [ ] Log retention meets policy (90 days+)

### Patch & Vulnerability
- [ ] OS patched (within 30 days)
- [ ] Application patched
- [ ] Vulnerability scan run
- [ ] Known CVEs reviewed

### Compliance
- [ ] Meets internal policy
- [ ] Regulatory requirements checked (if applicable)

## Findings

### Critical 🔴
| # | Finding | System | Remediation | Owner | Due |
|---|---------|--------|-------------|-------|-----|
|   |         |        |             |       |     |

### High 🟠
| # | Finding | System | Remediation | Owner | Due |
|---|---------|--------|-------------|-------|-----|
|   |         |        |             |       |     |

### Medium 🟡
| # | Finding | System | Remediation | Owner | Due |
|---|---------|--------|-------------|-------|-----|
|   |         |        |             |       |     |

### Low / Informational 🟢
| # | Finding | Note |
|---|---------|------|
|   |         |      |

## Risk Summary
- **Open Critical:** 0
- **Open High:** 0
- **Open Medium:** 0
- **Overall Risk:** 🟡 Medium

## Recommendations
1. 
2. 

## Sign-off
- **Reviewed by:** Yash — {{date:YYYY-MM-DD}}
- **Next review due:** 

---
**Related incidents:** 
**Related projects:** 
