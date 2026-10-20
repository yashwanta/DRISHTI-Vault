---
title: "DRISHTI NOC Audit Report"
source: "DRISHTI-NOC-Audit-Report.docx"
created: 2026-05-29
tags:
  - "docx"
  - "noc"
  - "documentation"
---

**DRISHTI**

Network Operations Centre Portal

_Technical Audit Report — Menu, Pages & Feature Recommendations_

| **Prepared by**<br>Claude (AI Code Assistant) | **Date**<br>May 29, 2026 |
| --- | --- |
| **Project**<br>NetVizProCodex / DRISTI-NOC | **Version**<br>v0.1.0-mvp |

| **SCOPE** | This document covers: duplicate routes, redundant pages, navigation consolidation, and new feature recommendations for Network Tools, Infrastructure, and Server Rack modules. |
| --- | --- |

# **1. Executive Summary**

A full code audit of the DRISHTI NOC Portal frontend was performed on May 29, 2026. The audit covered all navigation items, React page routes, and component files. The following key findings were identified:

| **Area** | **Finding** | **Severity** |
| --- | --- | --- |
| Duplicate Routes | 6 routes load the exact same page as another route | **Medium** |
| Unreachable Pages | 2 pages exist but have no navigation link | **High** |
| Dead Routes | 5 placeholder routes with no nav link and no real content | **Low** |
| Naming Inconsistency | Sidebar labels do not match page titles in 3 places | **Low** |
| Monitor Overcrowding | 9 items in Monitor section — 3 dashboards causing confusion | **Medium** |
| Missing Features | 8 high-value network/infra tools not yet built | **High** |

# **2. Duplicate & Redundant Routes**

The following routes were found in App.tsx that are either exact duplicates (same component) or legacy aliases that are no longer needed. These create dead weight in the codebase and can confuse developers maintaining the app.

## **2.1 Exact Duplicate Routes**

| **Route A (Nav Link)** | **Route B (Duplicate)** | **Component** | **Action** |
| --- | --- | --- | --- |
| /network/arp-mac | /network/mac-ip-search | ArpMacTablePage | Remove mac-ip-search — same page, no difference |
| /security/alerts | /alerts | AlertsPage | Remove /alerts — legacy alias |
| /ops/audit | /audit | AuditLogPage | Remove /audit — legacy alias |
| /ops/reports | /reports | ReportsPage | Remove /reports — legacy alias |
| /infra/servers | /servers | ServersPage | Remove /servers — legacy alias |
| /infra/server-map | /servers/map | ServerMapPage | Remove /servers/map — legacy alias |

## **2.2 Dead Placeholder Routes (No Nav Link, No Real Content)**

These routes exist in App.tsx and render a generic PlaceholderPage. They have no navigation link so users can never reach them. They should either be replaced with real pages or removed.

| **Route** | **Placeholder Title** | **Recommendation** |
| --- | --- | --- |
| /ports | Ports | Remove — port data exists under VLAN & Ports > Port Config |
| /vlans | VLANs | Remove — VLAN data exists under VLAN & Ports > VLAN Manager |
| /svis | SVIs | Remove — SVI data exists under VLAN & Ports > SVI / IP Interfaces |
| /gateways | Gateways | Replace with real Gateway/IP routing summary page under Infrastructure |
| /subnets | Subnets | Replace with IP Address Manager (IPAM) page under Infrastructure |

## **2.3 Unreachable Pages (Exist but Have No Nav Link)**

| **File** | **Route** | **Issue** | **Fix** |
| --- | --- | --- | --- |
| DiscoveredAPsPage.tsx | /access-points | Page and route exist but no sidebar link | Add to NETWORK section in nav |
| AccessPointsPage.tsx | /access-points | Same as above — route registered but hidden | Add to NETWORK section in nav |

# **3. Navigation Menu Restructure**

The current sidebar has 7 sections with 42 total navigation items. Several items overlap in purpose, especially in the Monitor section. Below is the recommended restructure to reduce confusion and improve discoverability.

## **3.1 MONITOR Section (9 items → 6 items)**

| **PROBLEM** | Three separate dashboards (Dashboard, Global Dashboard, Host Wall) all live at the top of Monitor. Users don't know which one to use. Map/Topology is also misplaced here — it belongs in Network. |
| --- | --- |

| **Current Item** | **Action** | **Reason** |
| --- | --- | --- |
| Dashboard | KEEP — rename to 'NOC Overview' | Primary landing page — keep prominent |
| Global Dashboard | MERGE — make a tab inside NOC Overview | Overlaps with Dashboard, causes confusion |
| Host Wall | MERGE — make a tab inside NOC Overview | Another dashboard view, not a separate page |
| Traffic Dashboard | KEEP | Distinct enough — bandwidth/flow data |
| ISP & CMS Monitor | KEEP | Specific ISP link monitoring — valuable |
| UPS Monitor | KEEP | Hardware monitoring — keep separate |
| Latency Map | KEEP | Geolocation latency — distinct value |
| Camera Pull | KEEP | Specific CCTV integration |
| Map | MOVE to NETWORK section | Map is a Topology view — belongs with network tools |

## **3.2 NETWORK Section (10 items → 10 items, better organized)**

| **PROBLEM** | MAC/IP Search is a duplicate of ARP/MAC Table. Access Points page exists but is hidden. Topology/Map belongs here not in Monitor. |
| --- | --- |

| **Action** | **Item** | **Notes** |
| --- | --- | --- |
| **KEEP** | Locations |  |
| **KEEP** | Devices |  |
| **KEEP** | Switches |  |
| **KEEP** | Endpoints |  |
| **ADD** | Access Points | Currently unreachable — add nav link |
| **KEEP** | Interface Monitor |  |
| **KEEP** | Wi-Fi Monitor |  |
| **KEEP** | ARP / MAC Table | Already has search built in |
| **REMOVE** | MAC/IP Search | Duplicate of ARP/MAC Table |
| **KEEP** | Saturation |  |
| **MOVE from Monitor** | Topology / Map | Belongs in Network section |

## **3.3 VLAN & PORTS Section — No Changes Needed**

All 5 items are distinct and well-organized: VLAN Manager, Port Config, Trunk Viewer, SVI / IP Interfaces, Routing Table. No changes recommended.

## **3.4 OPERATIONS Section — No Changes Needed**

All 5 items are distinct: Syslog Viewer, SNMP Trap Inbox, Event Timeline, Audit Log, Reports. No changes recommended.

## **3.5 SECURITY Section — No Changes Needed**

All 8 items are distinct and well-structured: Alerts, Rogue Devices, CVE Drill-Down, Switch Vulnerabilities, Port Security, 802.1X / NAC, Firewall Logs, Firewall / ACL Rules.

## **3.6 INFRASTRUCTURE Section (5 items → 8 items with new tools)**

| **OPPORTUNITY** | Infrastructure is currently thin — only 5 items. This section has the most room for high-value additions that your team would use daily. |
| --- | --- |

| **Action** | **Item** | **Priority** |
| --- | --- | --- |
| **KEEP** | Servers |  |
| **KEEP** | Server Map |  |
| **KEEP** | DHCP Scope |  |
| **KEEP** | DNS Monitor |  |
| **KEEP** | Config Backup / Diff |  |
| **ADD NEW** | Server Rack View | **High** |
| **ADD NEW** | IP Address Manager (IPAM) | **High** |
| **ADD NEW** | NTP Monitor | **Medium** |

# **4. New Feature Recommendations**

The following features are recommended to make the portal significantly more useful for your NOC team at Martinrea. Each is described with business value and technical approach.

## **4.1 Server Rack View — Infrastructure**

| **VALUE** | A visual U-slot rack diagram for each plant location. NOC engineers can immediately see which physical slots are occupied, what hardware is in each slot, and its online/offline status — without walking to the server room. |
| --- | --- |

**What it shows:**

- Per-location rack diagrams (one rack or multiple racks per site)

- Each U-slot shows: device name, vendor, model, IP, and status pill (Online / Offline / Warning)

- Color-coded by device type: switches (blue), servers (green), UPS (yellow), patch panels (grey)

- Empty slots shown in dark grey with U number

- Click any device to open its detail page

**Technical approach:**

- New DB table: rack_units (rack_id, location_id, u_position, u_height, device_id, label)

- Backend: GET /api/racks and GET /api/racks/:id

- Frontend: SVG-based rack diagram, 1U = fixed pixel height, rendered top-to-bottom

- Admin UI to assign devices to U-slots in the Setup page

## **4.2 IP Address Manager (IPAM) — Infrastructure**

| **VALUE** | Replace the dead /subnets placeholder with a real subnet and IP tracking tool. NOC can see which IPs are allocated, which are free, and which subnet each device belongs to — critical for multi-site Martinrea networks. |
| --- | --- |

**What it shows:**

- All subnets per location with CIDR notation (e.g. 10.199.203.0/24)

- Used IP count vs total — shown as a progress bar (e.g. 47/254 used = 18%)

- IP address table: each IP, hostname, MAC, device type, last seen timestamp

- Free IP list — IPs in the subnet with no recorded device

- Conflict detection — same IP assigned to two devices

**Technical approach:**

- Leverages existing vlans table (subnet_cidr, gateway_ip already stored)

- Cross-references devices and ARP/MAC table to determine used IPs

- No new backend needed for read — frontend calculates free/used from existing data

- New endpoint for manual IP reservations: POST /api/ip-reservations

## **4.3 NTP Monitor — Infrastructure**

| **VALUE** | Clock drift on network devices causes certificate failures, Kerberos authentication breaks, and log timestamps to become unreliable. NTP Monitor shows sync status across all switches and servers at a glance. |
| --- | --- |

**What it shows:**

- NTP sync status per device: Synced / Drifting / Unreachable

- Offset from reference clock in milliseconds

- Reference NTP server each device is polling

- Last sync timestamp

- Alert highlight for any device with offset > 500ms (configurable threshold)

**Technical approach:**

- SNMP OID: NTP-MIB::ntpEntStatusOffset or Cisco IOS: CISCO-NTP-MIB

- Collected during the same SNMP polling cycle as interface data

- New DB table: ntp_status (device_id, offset_ms, ref_server, synced, polled_at)

- Frontend: simple table with status pills and offset values in monospace

## **4.4 Network Ping / Reachability Tool — Network**

| **VALUE** | Most basic NOC tool — on-demand ping any device IP directly from the portal. Saves engineers from opening a terminal. Works for quick 'is it up?' checks during incidents. |
| --- | --- |

**What it shows:**

- Input: IP address or hostname

- Output: round-trip time (ms), packet loss %, min/avg/max RTT

- Status: Reachable (green) / Unreachable (red) / High Latency (yellow)

- History: last 10 pings stored per device for trend view

**Technical approach:**

- Backend: POST /api/ping with { target: '10.x.x.x', count: 4 }

- Go implementation: exec.Command('ping') or use go-ping library

- Rate limit: max 1 ping per second per user to prevent abuse

- Frontend: simple form + live result display, no page reload needed

## **4.5 Bandwidth Top-N — Monitor**

| **VALUE** | Shows the top 10 devices consuming the most bandwidth right now. Immediately useful during incidents to identify which device is saturating a link. |
| --- | --- |

**What it shows:**

- Ranked list: device name, site, interface, inbound Mbps, outbound Mbps

- Bar chart showing relative consumption

- Filter by site/location

- Auto-refreshes every 60 seconds

**Technical approach:**

- Requires SNMP polling of ifInOctets / ifOutOctets (delta over time = rate)

- New DB table: interface_counters (switch_id, port, in_bytes, out_bytes, polled_at)

- Backend calculates delta between last two polls to get Mbps rate

- Frontend: sorted table + inline sparkline charts using existing SVG chart component

## **4.6 Config Change Diff Viewer — Operations**

| **VALUE** | Config Backup already stores device configs. A Diff Viewer lets engineers visually compare any two config snapshots side-by-side — immediately shows what changed and when, useful for post-incident review. |
| --- | --- |

**What it shows:**

- Select any device + two config snapshot dates to compare

- Side-by-side or unified diff view with colour-coded additions (green) and removals (red)

- Line numbers, scroll-synced panels

- Export diff as PDF for change management records

**Technical approach:**

- Backend: GET /api/config-backup/:deviceId/diff?from=timestamp&to=timestamp

- Go: use go-diff library (github.com/sergi/go-diff) to compute diff

- Frontend: render diff hunks with CSS-highlighted lines — no external library needed

## **4.7 Network Health Score — Dashboard**

| **VALUE** | A single 0-100 score per site summarising overall network health. Gives management an instant red/amber/green view without reading detailed tables. Calculated from uptime %, saturation %, active alerts, and offline devices. |
| --- | --- |

**Score formula (suggested):**

- Base score: 100

- Deduct 10 points per offline device (max -40)

- Deduct 5 points per active alert (max -30)

- Deduct 1 point per 1% average link saturation above 60% (max -20)

- Deduct 10 points if any link is above 90% saturation

**What it shows on the dashboard:**

- Large coloured score circle per site: Green (80-100), Amber (50-79), Red (0-49)

- Trend arrow: improving / stable / degrading vs yesterday

- Click to drill down to the site's detail page

## **4.8 Asset QR Code / Label Print — Network**

| **VALUE** | Generate printable QR code labels for any device. Scan the label with a phone to instantly open that device's detail page in DRISHTI. Useful for physical asset management in the server room. |
| --- | --- |

**What it shows:**

- QR code encoding the device's DRISHTI URL (e.g. https://noc.martinrea.com/switches/uuid)

- Label includes: hostname, IP, location, device type, asset tag field

- Print-ready PDF format — standard label sizes (Avery 5160 compatible)

**Technical approach:**

- Frontend: use qrcode.js (browser-only, no backend needed)

- Generate PDF using browser print dialog with print-specific CSS

- Add 'Print Label' button to device and switch detail pages

# **5. Implementation Priority Summary**

All recommendations ranked by business value and implementation effort:

| **#** | **Action** | **Effort** | **Priority** | **Section** |
| --- | --- | --- | --- | --- |
| 1 | Remove 6 duplicate routes | **Low** | **Do Now** | App.tsx |
| 2 | Remove 5 dead placeholder routes | **Low** | **Do Now** | App.tsx |
| 3 | Add Access Points to NETWORK nav | **Low** | **Do Now** | Navigation |
| 4 | Merge 3 dashboards into tabbed view | **Medium** | **Sprint 1** | Monitor |
| 5 | Move Map/Topology to NETWORK | **Low** | **Sprint 1** | Navigation |
| 6 | Network Ping Tool | **Medium** | **Sprint 1** | Network |
| 7 | IP Address Manager (IPAM) | **Medium** | **Sprint 1** | Infrastructure |
| 8 | Server Rack View | **High** | **Sprint 2** | Infrastructure |
| 9 | Bandwidth Top-N | **High** | **Sprint 2** | Monitor |
| 10 | NTP Monitor | **Medium** | **Sprint 2** | Infrastructure |
| 11 | Network Health Score | **Medium** | **Sprint 2** | Dashboard |
| 12 | Config Diff Viewer | **Medium** | **Sprint 3** | Operations |
| 13 | Asset QR Code Labels | **Low** | **Sprint 3** | Network |

# **6. Notes for Developers**

## **6.1 Simulated vs Real Data**

Several widgets currently display simulated/estimated data rather than live SNMP data. This is clearly labelled in code but not always visible to users. The following pages use estimated data:

| **Page** | **Widget** | **Data Source** | **Real Data Requires** |
| --- | --- | --- | --- |
| Traffic Dashboard | Live Bandwidth Gauge % | Formula: device count per site | SNMP ifInOctets polling |
| Traffic Dashboard | Waveform chart | Simulated pointSeries() | SNMP time-series collection |
| ARP / MAC Table | Top Active VLAN | From existing DB records | L3 ARP polling from SVI/gateway |
| Interface Monitor | Utilization bars | ports_used / ports_total ratio | Live SNMP port counters |
| Saturation | LAN/WAN bars | Estimated from switch inventory | SNMP ifInOctets / ifOutOctets |

## **6.2 Database — Missing schema_migrations Records**

| **NOTE** | On this instance the schema_migrations table was empty despite all DB tables existing. All 24 migration records were manually inserted on 2026-05-29. Future developers should ensure migration records are always written when deploying to a new database. |
| --- | --- |

## **6.3 .env DATABASE_URL**

| **FIXED** | The DATABASE_URL in .env was pointing to a stale container IP (172.18.93.36). It has been corrected to localhost:5432. Always use localhost or the container service name — never hardcode internal container IPs. |
| --- | --- |

_End of Report  —  DRISHTI NOC Portal Technical Audit  —  May 2026_

## Related Documents

- [[192.168.1.1 - wbshocket findings|192.168.1.1 Wbshocket Findings]]
- [[Drishti_Line_Side_Board_Work_Instruction|Drishti Line Side Board Work Instruction]]
- [[DRISHTI_NOC_Codex_Remediation_Steps|DRISHTI NOC Codex Remediation Steps]]
- [[DRISHTI_NOC_Codex_Remediation_Steps|DRISHTI NOC Codex Remediation Steps]]
- [[DRISHTI_NOC_Codex_Remediation_Steps|DRISHTI NOC Codex Remediation Steps]]
- [[DRISHTI_NOC_Multi_Plant_Federation_Project_Plan|DRISHTI NOC Multi Plant Federation Project Plan]]
- [[DRISHTI_NOC_Multi_Plant_Federation_Project_Plan|DRISHTI NOC Multi Plant Federation Project Plan]]
- [[DRISHTI-RiskAssesment_Phased_Codex_Build_Plan|DRISHTI Riskassesment Phased Codex Build Plan]]
- [[DRISHTI_Server_Hardening_Report|DRISHTI Server Hardening Report]]
- [[DRISHTI_SiteOps_Agent_Brief|DRISHTI Siteops Agent Brief]]
- [[WI-09-Podman-Desktop-on-Windows-VMware|WI 09 Podman Desktop On Windows Vmware]]
- [[WI-10-Windows-Installer-Workspace-Capacity|WI 10 Windows Installer Workspace Capacity]]
- [[WI-11-Native-Windows-Installation|WI 11 Native Windows Installation]]
- [[WI-IT-OT-001_FleetManager_Server_Build_Standard_v1.0|WI IT OT 001 Fleetmanager Server Build Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
