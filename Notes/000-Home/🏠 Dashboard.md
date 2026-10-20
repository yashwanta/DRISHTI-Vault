---
tags: [home, dashboard]
---

# 🏠 DRISHTI Notes — Dashboard

> **IT Manager · Special Projects · Cybersecurity**  
> *Yash | k_yashwanta@hotmail.com*

---

## 🚀 Quick Navigation

| Area | Link | Purpose |
|------|------|---------|
| 📝 Today | [[100-Daily-Notes/2026-08-06\|Today's Note]] | Daily log & tasks |
| 📋 Capture | [[📋 Quick Capture]] | Brain dump anything fast |
| 🔴 Incidents | [[400-Incidents/Incident Register]] | Active & recent incidents |
| 📁 Projects | [[200-Projects/Project Register]] | All active projects |
| 🏷 Tags | Use `Ctrl+G` for graph view | Visual connection map |

---

## 🔴 Active Incidents
> _Update this section or use the [[400-Incidents/Incident Register]]_

- None currently open ✅

---

## 📁 Active Projects

- [[200-Projects/DRISHTI-Vault Credential Manager]] — Password vault for IT team
- Add more with `[[` wikilinks

---

## 📅 Recent Daily Notes

- [[100-Daily-Notes/2026-08-06|2026-08-06 — Thursday]]

---

## 🔖 Reference Quick-Links

- [[500-Reference/Network Reference|Network Reference (VLANs, Subnets, DNS)]]
- [[500-Reference/IT Standards & Policies|IT Standards & Policies]]
- [[500-Reference/Contacts & Escalation|Contacts & Escalation]]
- [[500-Reference/Acronym Glossary|IT Acronym Glossary]]

---

## 📊 Vault Stats
> _Install the Dataview plugin to make this live_

```dataview
TABLE file.ctime AS "Created", tags AS "Tags"
FROM ""
WHERE type = "incident" AND status = "open"
SORT file.ctime DESC
```

---

## 🗂 Folder Map

```
Notes/
  000-Home/         ← You are here
  100-Daily-Notes/  ← One note per day (Ctrl+Shift+D)
  200-Projects/     ← Project notes with milestones & tasks
  300-Meetings/     ← Meeting notes, agendas, action items
  400-Incidents/    ← Incident reports & PIRs
  500-Reference/    ← Static reference: network, contacts, standards
  600-Archive/      ← Completed / closed notes
  _Templates/       ← Note templates (Ctrl+P → Templates)
```

---

## ⌨️ Key Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Command palette |
| `Ctrl+O` | Quick open any note |
| `Ctrl+G` | Graph view |
| `Ctrl+Shift+D` | Open today's daily note |
| `Ctrl+L` | Toggle checkbox |
| `[[` | Insert wikilink to another note |
| `#` | Add a tag |

---
_Last updated: 2026-08-06 · [[500-Reference/IT Standards & Policies|Policies]] · [[400-Incidents/Incident Register|Incidents]]_
