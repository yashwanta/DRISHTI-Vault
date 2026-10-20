---
tags: [reference, network]
updated: 2026-08-06
---

# 🌐 Network Reference

> VLANs, subnets, DNS, gateways. Keep this updated as the network changes.  
> **Related:** [[DRISHTI-Vault Credential Manager]] stores device credentials.

---

## Sites

| Site | Short Name | Location |
|------|-----------|----------|
| Springfield | SPR | Springfield Plant |
| Hopkinsville | HKV | Hopkinsville Plant |

---

## VLANs & Subnets

### Springfield (SPR)

| VLAN | Name | Subnet | Gateway | Notes |
|------|------|--------|---------|-------|
| 1 | Management | | | |
| 10 | Servers | | | |
| 20 | Workstations | | | |
| 30 | IoT / OT | | | |
| 99 | Native / Trunk | | | |

### Hopkinsville (HKV)

| VLAN | Name | Subnet | Gateway | Notes |
|------|------|--------|---------|-------|
| 1 | Management | | | |
| 10 | Servers | | | |
| 20 | Workstations | | | |

---

## DNS Servers

| Site | Primary | Secondary |
|------|---------|-----------|
| SPR | | |
| HKV | | |

---

## Key Servers & Services

| Hostname | IP | Role | Site | Notes |
|----------|----|------|------|-------|
| | | Proxmox Host | SPR | |
| | | Domain Controller | SPR | |
| | | | | |

---

## Proxmox Hosts

| Host | IP | Cores | RAM | Storage | VMs |
|------|----|-------|-----|---------|-----|
| | | | | | |

---

## Firewall / Security Notes

- 
- 

---
_Back to [[🏠 Dashboard]] | Credentials in [[DRISHTI-Vault Credential Manager]]_
