---
title: "WI IT OT 001 Fleetmanager Server Build Standard V1.0"
source: "WI-IT-OT-001_FleetManager_Server_Build_Standard_v1.0.docx"
created: 2026-07-02
tags:
  - "docx"
  - "server"
  - "project"
  - "documentation"
---

**MARTINREA INTERNATIONAL INC.**

Information Technology — OT Infrastructure

**WORK INSTRUCTION**

**AMR Fleet Manager Server**

Build & Security Hardening Standard

**WI-IT-OT-001**

| **Field** | **Detail** |
| --- | --- |
| Document Number | WI-IT-OT-001 |
| Document Title | AMR Fleet Manager Server Build & Security Hardening Standard |
| Version | 1.0 |
| Effective Date | July 2, 2026 |
| Author | Yashwanta Thakur |
| Title | IT Manager / Cybersecurity & Infrastructure |
| Department | Information Technology |
| Classification | CONFIDENTIAL — Internal Use Only |
| Review Cycle | Annual or after major infrastructure change |
| Plants Applicable | All Martinrea AMR Plants — Shelbyville, Springfield, Hopkinsville, Jonesville |

_MARTINREA INTERNATIONAL INC. — CONFIDENTIAL — AUTHORIZED PERSONNEL ONLY_

# **1. Purpose and Scope**

This Work Instruction defines the standard build, configuration, and security hardening procedure for Autonomous Mobile Robot (AMR) Fleet Manager servers deployed at Martinrea International plant locations. It ensures all Fleet Manager servers are consistently provisioned, secured, and maintained to the same standard regardless of plant location.

## **1.1 Purpose**

To establish a repeatable, documented, and auditable process for:

- Provisioning new Fleet Manager servers on Proxmox VE virtualization infrastructure

- Hardening operating system security to protect OT network assets

- Configuring firewall rules appropriate to the plant network architecture

- Deploying the DRISHTI AMR Health monitoring application

- Ensuring Veeam backup integration is preserved throughout hardening

## **1.2 Scope**

| **Item** | **In Scope** | **Out of Scope** |
| --- | --- | --- |
| Operating System | Ubuntu 24.04 LTS on Proxmox VM | Bare metal, other Linux distros |
| Virtualization | Proxmox VE — VM and LXC | VMware, Hyper-V |
| Application | RDS Fleet Manager, DRISHTI AMR Health | Roboshop, third-party tools |
| Network | Plant LAN, AMR VLAN 193, Corp VPN | Public internet configuration |
| Plants | All AMR-enabled Martinrea plants | Non-AMR facilities |

## **1.3 Prerequisites**

Before beginning this procedure, confirm the following are available:

| **Requirement** | **Details** | **Verified By** |
| --- | --- | --- |
| Proxmox VE access | Admin credentials to plant Proxmox node | IT Manager |
| Corp VPN access | Connected to plant VPN profile | IT Manager |
| Ubuntu 24.04 LTS ISO | Available in Proxmox storage | IT Manager |
| Plant network details | Plant LAN subnet, AMR VLAN, Veeam IP | IT Manager |
| Veeam credentials | Backup server IP and service account | IT Manager |
| robowatch account | SSH access or password for AMR auth setup | RDS Vendor |
| CrowdStrike license | Falcon sensor deployment access | IT Security |

# **2. Safety and Security Requirements**

**🔴 CRITICAL: This procedure modifies production OT infrastructure. Always take a Proxmox snapshot before beginning. Never perform hardening steps during active production shifts without plant manager approval.**

## **2.1 Mandatory Safety Rules**

- **ALWAYS take a Proxmox VM snapshot before starting any hardening step**

- **NEVER close your SSH session until a new terminal is verified working after SSH changes**

- ALWAYS open Proxmox console before rebooting — provides recovery access if SSH fails

- NEVER disable password authentication without first confirming SSH key works in new terminal

- ALWAYS verify Veeam backup works after each major hardening step

- NEVER store private keys, passwords, or credentials in source code or Git repositories

- NEVER allow contractor or vendor remote access to plant servers

## **2.2 Access Control Policy**

| **User / System** | **Access Allowed** | **Access Denied** |
| --- | --- | --- |
| IT Staff (Corp VPN 10.2.1.0/24) | SSH, Proxmox UI, DRISHTI, RDS API | PostgreSQL direct |
| Plant LAN devices | DRISHTI view, RDS API | SSH, Proxmox UI, database |
| AMR VLAN 193 | RDS API port 8080 only | All other ports |
| Veeam Backup Server | SSH port 22, Proxmox API 8006 | All other ports |
| Contractors | NONE — no exceptions | Everything |
| Vendors | NONE — no exceptions | Everything |
| Internet / Public | NONE — blocked by firewall | Everything |

## **2.3 Cybersecurity Standards**

This procedure complies with the following security principles:

- Zero Trust: Default deny all incoming traffic, allow only verified sources

- Least Privilege: Services run as non-root users with minimum required permissions

- Defence in Depth: Firewall + application binding + audit logging as layered controls

- Air-Gap Safe: All DRISHTI data stays on plant network — no cloud dependency

- Audit Trail: All admin actions logged with timestamp and engineer identity

# **3. Network Architecture**

## **3.1 Plant Network Overview**

Each Martinrea AMR plant operates an isolated network. Plant servers have internet access but are not accessible from the corporate network without VPN. Only authorized IT staff laptops have VPN profiles for each plant.

| **Plant** | **Server Hostname** | **Plant LAN** | **AMR VLAN** | **Veeam VM** |
| --- | --- | --- | --- | --- |
| Shelbyville | USSHBAMRU250006 | 10.205.0.0/16 | 10.215.48.0/23 | 10.205.22.50 |
| Springfield | USSPRAMRFLMGR260003 | 10.222.10.0/24 | 10.215.48.0/23 | TBD |
| Hopkinsville | TBD | 10.216.4.0/24 | TBD | TBD |
| Jonesville | TBD | TBD | TBD | TBD |

## **3.2 Proxmox VM Architecture — Per Plant**

| **VM ID** | **Role** | **Color Tag** | **Key Services** |
| --- | --- | --- | --- |
| 101 | RDS Fleet Manager + rbk | Red/Pink | Java RDS :8080/:8090, rbk :8088/:8089, MariaDB :3306 |
| 100 | Veeam Backup Agent | Orange | Backup jobs via SSH to VM 101 |
| 104 | Kafka / Warlink | Yellow | Message broker for AMR events |
| 106 | PostgreSQL | Green | DRISHTI database :5432 |
| New | DRISHTI AMR Health | Blue | Go/Gin API :8088, React UI |
| 900 | Template | None | Base Ubuntu 24.04 LTS template |

## **3.3 Port Reference**

| **Port** | **Service** | **Protocol** | **Allowed From** |
| --- | --- | --- | --- |
| 22 | SSH | TCP | Corp VPN, Plant LAN, Veeam VM, AMR VLAN |
| 8080 | RDS Fleet Manager API | TCP | Corp VPN, Plant LAN, AMR VLAN |
| 8088 | rbk / DRISHTI | TCP | AMR VLAN, Plant LAN |
| 8089 | rbk internal | TCP | AMR VLAN, Plant LAN |
| 8090 | RDS internal | TCP | Corp VPN, Plant LAN |
| 3306 | MariaDB | TCP | localhost ONLY — never network |
| 5432 | PostgreSQL | TCP | DRISHTI VM only |
| 502 | Modbus | TCP | AMR VLAN ONLY |
| 3389/3390 | RDP/xRDP | TCP | Corp VPN ONLY |
| 8006 | Proxmox UI | TCP | Corp VPN, Veeam VM |
| 6160/6162 | Veeam Agent | TCP | Veeam VM only |
| 2500-3300 | Veeam Data Mover | TCP | Veeam VM only |

# **4. VM Provisioning on Proxmox**

## **4.1 Pre-Provisioning Checklist**

**⚠ WARNING: Confirm plant VPN is connected before attempting to access Proxmox.**

Complete all items before creating the VM:

| **#** | **Check Item** | **Status** |
| --- | --- | --- |
| 1 | Connected to plant VPN | ☐ |
| 2 | Proxmox UI accessible at https://[node-ip]:8006 | ☐ |
| 3 | Ubuntu 24.04 LTS ISO uploaded to Proxmox storage | ☐ |
| 4 | Plant LAN subnet confirmed | ☐ |
| 5 | AMR VLAN subnet confirmed | ☐ |
| 6 | Veeam server IP identified from auth.log | ☐ |
| 7 | Available VM ID confirmed (next sequential) | ☐ |
| 8 | Disk size confirmed with plant team (minimum 200GB) | ☐ |

## **4.2 Create VM in Proxmox**

### **Step-by-Step: Create New VM**

1. Log into Proxmox UI: https://[PROXMOX-NODE-IP]:8006

  1. Use your named IT admin account — never the generic 'admin' account

2. Click 'Create VM' button in top right

3. General tab — configure:

  2. Node: Select your plant Proxmox node

  3. VM ID: Next available sequential number (e.g., 102)

  4. Name: Follow naming convention: US[PLANT][ROLE][YEAR] e.g., USSHDRISHTI260001

  5. Color Tag: Blue — indicates DRISHTI application server

4. OS tab — configure:

  6. ISO Image: ubuntu-24.04.4-live-server-amd64.iso

  7. Guest OS Type: Linux, Version: 6.x - 2.6 Kernel

5. System tab — configure:

  8. BIOS: SeaBIOS (default)

  9. SCSI Controller: VirtIO SCSI

  10. Qemu Agent: Enable

6. Disks tab — configure:

  11. Bus/Device: SCSI, scsi0

  12. Storage: vmdata-12tb (or plant local storage)

  13. Disk size: 200GB minimum

  14. Cache: Write back

  15. iothread: Enable

7. CPU tab — configure:

  16. Sockets: 1, Cores: 4 minimum

  17. Type: host

8. Memory tab — configure:

  18. Memory: 8192 MB (8GB) minimum

  19. Ballooning: Disable for production

9. Network tab — configure:

  20. Bridge: vmbr0 (plant management LAN)

  21. Model: VirtIO (paravirtualized)

  22. VLAN Tag: Set appropriate plant management VLAN

10. Confirm tab — review all settings and click Finish

11. Start VM and open Console

### **4.3 Expand LVM After OS Install**

_ℹ NOTE: Ubuntu 24.04 LTS installer often allocates only 50% of available disk to LVM. Always expand after installation._

Run the following commands after first boot:

# Step 1 — Check current disk layout

sudo parted /dev/sda print free

# Answer 'Fix' if prompted about GPT table

# Step 2 — Install growpart

sudo apt-get install -y cloud-guest-utils

# Step 3 — Extend partition to use full disk

sudo growpart /dev/sda 3

# Step 4 — Resize LVM physical volume

sudo pvresize /dev/sda3

# Step 5 — Extend logical volume

sudo lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv

# Step 6 — Resize filesystem (live, no reboot needed)

sudo resize2fs /dev/ubuntu-vg/ubuntu-lv

# Step 7 — Verify — should show near full disk available

df -h /

✅ VERIFY: df -h / must show > 190GB total for a 200GB disk allocation

# **5. Operating System Configuration**

## **5.1 Initial System Update**

**⚠ WARNING: Always update the system before any hardening. Never harden an out-of-date OS.**

12. Connect to server via SSH:

ssh setup@[SERVER-IP]

13. Update all packages:

sudo apt-get update && \

sudo apt-get upgrade -y && \

sudo apt-get autoremove -y && \

sudo apt-get clean

14. Check if reboot is required:

sudo ls /var/run/reboot-required 2>/dev/null && \

echo 'REBOOT REQUIRED' || echo 'No reboot needed'

15. If reboot required — open Proxmox console FIRST, then reboot:

sudo reboot

16. After reboot, verify new kernel:

uname -r

✅ VERIFY: Kernel version should match latest Ubuntu 24.04 LTS kernel

## **5.2 Remove Unnecessary Packages**

Production OT servers must not run desktop GUI, printing, or Bluetooth services. Remove all unnecessary packages to reduce attack surface.

17. Remove desktop and GUI packages:

sudo apt-get remove -y lightdm lightdm-gtk-greeter

sudo apt-get remove -y xrdp gnome-shell ubuntu-desktop

sudo apt-get remove -y cups cups-browsed wpa-supplicant

sudo apt-get remove -y colord bluez

sudo apt-get autoremove -y

sudo apt-get clean

18. Clean up Snap packages — remove non-essential snaps:

sudo snap remove chromium 2>/dev/null || true

sudo snap remove gnome-46-2404 2>/dev/null || true

sudo snap remove gtk-common-themes 2>/dev/null || true

sudo snap remove mesa-2404 2>/dev/null || true

sudo snap set system refresh.retain=2

19. Remove old disabled snap versions:

sudo sh -c 'snap list --all | awk "/disabled/{print \$1, \$3}" | \

while read name rev; do snap remove "$name" --revision="$rev"; done'

20. Verify disk space recovered:

df -h /

✅ VERIFY: Root filesystem should be under 50% utilization after cleanup

## **5.3 User Account Security**

21. Lock the mysql user shell — database service account must not allow login:

sudo usermod -s /sbin/nologin mysql

grep mysql /etc/passwd

✅ VERIFY: mysql entry must show /sbin/nologin as shell

22. Lock setup account after hardening is complete (LAST STEP):

# NOTE: Only run this AFTER all configuration is complete

# and you have verified your named account can SSH in

sudo passwd -l setup

sudo usermod -s /sbin/nologin setup

**⚠ WARNING: Locking the setup account is irreversible without Proxmox console access. Verify all access paths work before executing.**

23. Verify root login is disabled:

sudo passwd -S root

_ℹ NOTE: Root account status should show 'L' (locked). Never enable root SSH login._

# **6. SSH Hardening**

## **6.1 Create SSH Login Banner**

The SSH banner displays a legal warning before login. It must be created before modifying sshd_config as the config references the banner file.

24. Create the Martinrea legal banner — update Location per plant:

sudo tee /etc/ssh/martinrea-banner.txt << 'EOF'

*************************************************************

*         MARTINREA INTERNATIONAL INC.                      *

*         AUTHORIZED ACCESS ONLY                            *

*                                                           *

*  This system is the property of Martinrea International.  *

*  Unauthorized access or use is strictly prohibited and    *

*  may result in disciplinary action and/or criminal        *

*  prosecution under applicable laws.                       *

*                                                           *

*  All activities on this system are monitored, logged,     *

*  and subject to audit. By continuing, you consent to      *

*  such monitoring.                                         *

*                                                           *

*  If you are not an authorized user, disconnect NOW.       *

*                                                           *

*  Report security incidents to:                            *

*  IT Manager / Cybersecurity & Infrastructure              *

*  Yashwanta Thakur                                         *

*  Location: [PLANT NAME] Plant — [SERVER HOSTNAME]         *

*************************************************************

EOF

25. Set correct permissions:

sudo chmod 644 /etc/ssh/martinrea-banner.txt

26. Verify banner content:

cat /etc/ssh/martinrea-banner.txt

✅ VERIFY: Banner file must exist at /etc/ssh/martinrea-banner.txt before proceeding

## **6.2 Apply SSH Hardening Configuration**

27. Create hardening config as a drop-in file:

sudo tee /etc/ssh/sshd_config.d/99-martinrea-hardening.conf << 'EOF'

# ============================================================

# Martinrea International Inc. — SSH Security Configuration

# Engineer:  Yashwanta Thakur — IT Manager / Cybersecurity

# Version:   1.0

# ============================================================

# Authentication — keep password ON for OT environment

PasswordAuthentication yes

PermitRootLogin no

MaxAuthTries 5

LoginGraceTime 60

# Session management

ClientAliveInterval 300

ClientAliveCountMax 3

# Security

X11Forwarding no

Banner /etc/ssh/martinrea-banner.txt

LogLevel VERBOSE

EOF

28. Test configuration syntax — MUST pass before reloading:

sudo sshd -t && echo '✅ Config OK — safe to reload' || echo '❌ ERROR — do not reload'

**🔴 CRITICAL: Only proceed to step 3 if the test shows 'Config OK'. Never reload SSH with a broken config.**

29. Reload SSH service:

sudo systemctl reload ssh

sudo systemctl status ssh | grep Active

30. Test banner from NEW terminal window — do not close current session:

# From your Windows laptop — open new CMD window

ssh setup@[SERVER-IP]

✅ VERIFY: Banner must appear before password prompt in the new terminal window

31. Log the change:

sudo tee -a /var/log/martinrea-hardening.log << EOF

[$(date)] SSH hardening applied — 99-martinrea-hardening.conf

[$(date)] Banner deployed — /etc/ssh/martinrea-banner.txt

[$(date)] Engineer: Yashwanta Thakur — IT Manager / Cybersecurity & Infrastructure

EOF

# **7. Firewall Configuration**

## **7.1 Pre-Firewall: Identify Required IPs**

**⚠ WARNING: Never enable firewall until all required IP addresses are confirmed. Incorrect rules will lock you out.**

Run the following to identify all IPs that have connected to this server:

sudo journalctl -u ssh --since '30 days ago' \

--output short-precise | \

grep 'Accepted' | \

awk '{print $11, $9}' | \

sort | uniq -c | sort -rn

Record findings in this table:

| **IP Address** | **Who / What** | **Access Required** | **Verified** |
| --- | --- | --- | --- |
| 10.2.1.0/24 | IT Staff Corp VPN | SSH, Proxmox, DRISHTI, RDS | ☐ |
| 10.205.22.50 | Veeam amrveeam VM | SSH port 22 only | ☐ |
| 10.205.0.0/16 | Plant LAN | DRISHTI :8088, RDS :8080 | ☐ |
| 10.215.48.0/23 | AMR VLAN | RDS :8080, SSH robowatch | ☐ |
| [VEEAM IP] | Veeam Server | SSH :22, Proxmox :8006 | ☐ |

## **7.2 Pre-Firewall: Identify Veeam IP**

The Veeam backup server connects on a regular schedule. Find its IP from auth logs:

sudo grep 'Accepted' /var/log/auth.log | \

awk '{print $11}' | sort | uniq -c | sort -rn | head -20

_ℹ NOTE: Veeam's IP will appear repeatedly at consistent times matching your backup schedule (e.g., every 6 hours). Record this IP before proceeding._

32. Run test backup in Veeam BEFORE applying firewall rules

33. Confirm backup completes successfully

34. Record Veeam IP: ___________________________

## **7.3 Create and Run Firewall Script**

Create the firewall script with plant-specific IP variables. Update the variables section for each plant before running.

sudo tee /home/setup/drishti-firewall-[PLANT].sh << 'EOF'

#!/bin/bash

# ============================================================

# Martinrea International Inc. — Firewall Hardening

# Engineer:  Yashwanta Thakur — IT Manager / Cybersecurity

# Version:   1.0 — Update per plant

# ============================================================

set -e

# ── UPDATE THESE PER PLANT ────────────────────────────────

CORP_VPN='10.2.1.0/24'          # IT staff corp VPN — same all plants

PLANT_LAN='10.205.0.0/16'       # CHANGE per plant

AMR_VLAN='10.215.48.0/23'       # CHANGE per plant

VEEAM_VM='10.205.22.50'         # CHANGE per plant — find from auth.log

# ──────────────────────────────────────────────────────────

sudo ufw --force reset

sudo ufw default deny incoming

sudo ufw default allow outgoing

sudo ufw default deny forward

sudo ufw allow in on lo comment 'Loopback'

# SSH

sudo ufw allow from $CORP_VPN  to any port 22 proto tcp comment 'SSH IT VPN'

sudo ufw allow from $PLANT_LAN to any port 22 proto tcp comment 'SSH plant LAN'

sudo ufw allow from $VEEAM_VM  to any port 22 proto tcp comment 'SSH Veeam'

sudo ufw allow from $AMR_VLAN  to any port 22 proto tcp comment 'SSH AMR robowatch'

# RDS API

sudo ufw allow from $CORP_VPN  to any port 8080 proto tcp comment 'RDS VPN'

sudo ufw allow from $PLANT_LAN to any port 8080 proto tcp comment 'RDS plant LAN'

sudo ufw allow from $AMR_VLAN  to any port 8080 proto tcp comment 'RDS AMR VLAN'

sudo ufw allow from $CORP_VPN  to any port 8090 proto tcp comment 'RDS 8090 VPN'

sudo ufw allow from $PLANT_LAN to any port 8090 proto tcp comment 'RDS 8090 plant'

# rbk robot ports

sudo ufw allow from $AMR_VLAN  to any port 8088 proto tcp comment 'rbk AMR'

sudo ufw allow from $AMR_VLAN  to any port 8089 proto tcp comment 'rbk AMR'

sudo ufw allow from $PLANT_LAN to any port 8088 proto tcp comment 'rbk plant'

sudo ufw allow from $PLANT_LAN to any port 8089 proto tcp comment 'rbk plant'

sudo ufw allow from $AMR_VLAN  to any port 12398 proto tcp comment 'rbk internal'

sudo ufw allow from $AMR_VLAN  to any port 19204:19208 proto tcp comment 'rbk ports'

sudo ufw allow from $AMR_VLAN  to any port 20204:20207 proto tcp comment 'rbk ports'

sudo ufw allow from $AMR_VLAN  to any port 30204:30207 proto tcp comment 'rbk ports'

sudo ufw allow from $PLANT_LAN to any port 19208 proto tcp comment 'robod plant'

# Modbus — AMR VLAN ONLY

sudo ufw allow from $AMR_VLAN  to any port 502 proto tcp comment 'Modbus AMR only'

sudo ufw deny  to any port 502 comment 'Block Modbus internet'

# Block sensitive ports

sudo ufw deny  to any port 3306 comment 'Block MariaDB network'

sudo ufw allow from $CORP_VPN  to any port 3389 proto tcp comment 'RDP VPN only'

sudo ufw allow from $CORP_VPN  to any port 3390 proto tcp comment 'xRDP VPN only'

sudo ufw deny  to any port 3389 comment 'Block RDP internet'

sudo ufw deny  to any port 3390 comment 'Block xRDP internet'

# Veeam backup ports

sudo ufw allow from $VEEAM_VM  to any port 8006 proto tcp comment 'Proxmox Veeam'

sudo ufw allow from $VEEAM_VM  to any port 2500:3300 proto tcp comment 'Veeam data'

sudo ufw allow from $VEEAM_VM  to any port 6160 proto tcp comment 'Veeam agent'

sudo ufw allow from $VEEAM_VM  to any port 6162 proto tcp comment 'Veeam agent'

sudo ufw --force enable

sudo ufw status numbered

EOF

chmod +x /home/setup/drishti-firewall-[PLANT].sh

sudo bash /home/setup/drishti-firewall-[PLANT].sh

## **7.4 Post-Firewall Verification**

35. Open NEW terminal and confirm SSH still works:

ssh setup@[SERVER-IP]

36. Verify firewall is active:

sudo ufw status numbered

37. Run Veeam backup job and confirm it completes

38. Verify RDS API still responds:

curl -s http://localhost:8080 | head -3

✅ VERIFY: All 4 verifications must pass before proceeding to next section

# **8. Database Security — MariaDB**

## **8.1 Bind MariaDB to Localhost**

**⚠ WARNING: Before restarting MariaDB, verify the application connects via 'localhost' not the server IP. Incorrect binding will break the RDS application.**

39. Verify RDS application uses localhost for database connection:

sudo grep -E 'url|host|mysql|jdbc|datasource' \

/opt/data/rds/app/application.yml | head -10

_ℹ NOTE: Connection string must show 'localhost' or '127.0.0.1' — if it shows the server IP, update it before proceeding._

40. Find MariaDB configuration file:

sudo find /etc/mysql -name '*.cnf' 2>/dev/null

41. View current configuration:

sudo cat /etc/mysql/conf.d/my.cnf

42. Add bind-address — preserve ALL existing settings:

sudo tee /etc/mysql/conf.d/my.cnf << 'EOF'

[mysqld]

# Existing production settings — DO NOT REMOVE

lower_case_table_names=1

innodb_buffer_pool_size=2048M

max_connections=3000

# Martinrea Security Hardening

# Engineer: Yashwanta Thakur — IT Manager / Cybersecurity

bind-address = 127.0.0.1

EOF

43. Restart MariaDB:

sudo systemctl restart mariadb

44. Verify localhost binding:

sudo ss -tlnp | grep 3306

✅ VERIFY: Output must show 127.0.0.1:3306 — NOT 0.0.0.0:3306

45. Verify RDS Java application is still running:

sudo ps aux | grep java | grep -v grep | awk '{print $1,$11}'

curl -s http://localhost:8080 | head -3

✅ VERIFY: Java process must be running and RDS API must return HTML response

# **9. Audit Logging Configuration**

## **9.1 Install and Configure auditd**

46. Install auditd:

sudo apt-get install -y auditd audispd-plugins

47. Configure audit file size limits:

sudo sed -i 's/^max_log_file =.*/max_log_file = 50/' /etc/audit/auditd.conf

sudo sed -i 's/^max_log_file_action =.*/max_log_file_action = ROTATE/' /etc/audit/auditd.conf

sudo sed -i 's/^num_logs =.*/num_logs = 8/' /etc/audit/auditd.conf

sudo sed -i 's/^space_left =.*/space_left = 1024/' /etc/audit/auditd.conf

sudo sed -i 's/^space_left_action =.*/space_left_action = SYSLOG/' /etc/audit/auditd.conf

48. Create audit rules for critical system files:

sudo tee /etc/audit/rules.d/martinrea.rules << 'EOF'

# Martinrea International — Audit Rules

-w /etc/passwd -p wa -k identity

-w /etc/shadow -p wa -k identity

-w /etc/ssh/sshd_config -p wa -k sshd_config

-w /etc/sudoers -p wa -k sudoers

-a always,exit -F arch=b64 -S execve -F euid=0 -k root_commands

-w /etc/ufw -p wa -k firewall

-w /var/log/ufw.log -p wa -k firewall

-w /etc/cron.d -p wa -k cron

-w /var/log/lastlog -p wa -k logins

-w /var/run/utmp -p wa -k session

EOF

49. Enable and start auditd:

sudo systemctl enable auditd

sudo systemctl restart auditd

sudo systemctl status auditd | grep Active

50. Verify audit config:

sudo cat /etc/audit/auditd.conf | grep -E 'max_log|num_logs|space_left'

✅ VERIFY: auditd must show 'active (running)' status

## **9.2 Configure Log Rotation**

51. Create logrotate config for Martinrea hardening log:

sudo tee /etc/logrotate.d/martinrea << 'EOF'

/var/log/martinrea-hardening.log {

weekly

rotate 12

compress

delaycompress

missingok

notifempty

size 50M

dateext

create 640 root adm

}

EOF

52. Configure systemd journal size limits:

sudo mkdir -p /etc/systemd/journald.conf.d

sudo tee /etc/systemd/journald.conf.d/martinrea.conf << 'EOF'

[Journal]

SystemMaxUse=2G

SystemMaxFileSize=200M

MaxRetentionSec=3month

Compress=yes

EOF

sudo systemctl restart systemd-journald

53. Set up automatic boot logging service:

sudo tee /usr/local/bin/martinrea-boot-log.sh << 'EOF'

#!/bin/bash

LOG=/var/log/martinrea-hardening.log

echo '========================================' >> $LOG

echo "[$(date)] SYSTEM BOOT" >> $LOG

echo "[$(date)] Kernel: $(uname -r)" >> $LOG

echo "[$(date)] Disk: $(df -h / | tail -1)" >> $LOG

echo "[$(date)] IP: $(hostname -I)" >> $LOG

systemctl is-active mariadb >> $LOG

systemctl is-active ssh >> $LOG

systemctl is-active auditd >> $LOG

echo '========================================' >> $LOG

EOF

sudo chmod +x /usr/local/bin/martinrea-boot-log.sh

54. Create systemd service for boot logging:

sudo tee /etc/systemd/system/martinrea-boot-log.service << 'EOF'

[Unit]

Description=Martinrea Boot Activity Logger

After=network.target ssh.service mariadb.service

[Service]

Type=oneshot

ExecStart=/usr/local/bin/martinrea-boot-log.sh

RemainAfterExit=yes

[Install]

WantedBy=multi-user.target

EOF

sudo systemctl daemon-reload

sudo systemctl enable martinrea-boot-log.service

sudo systemctl start martinrea-boot-log.service

55. Set up SSH login auto-logging:

sudo tee /etc/profile.d/martinrea-login-log.sh << 'EOF'

#!/bin/bash

echo "[$(date)] SSH LOGIN | User: $USER | From: $SSH_CLIENT" \

>> /var/log/martinrea-hardening.log

EOF

sudo chmod +x /etc/profile.d/martinrea-login-log.sh

# **10. DRISHTI AMR Health Deployment**

## **10.1 Prerequisites**

DRISHTI AMR Health requires Go backend and React frontend. Deploy one instance per plant — each instance connects only to its local RDS Fleet Manager.

| **Component** | **Requirement** | **Version** |
| --- | --- | --- |
| Go | Backend runtime | 1.21+ |
| PostgreSQL | DRISHTI database | 15+ |
| Node.js | Build React UI only — not runtime | 20 LTS |
| Nginx | Reverse proxy | Latest stable |
| SSH Key | robowatch AMR access | ed25519 |

## **10.2 Build Package on Laptop**

56. In your DRISHTI repository on Windows laptop:

# Build Go binary for Linux

$env:GOOS='linux'

$env:GOARCH='amd64'

go build -o drishti-linux ./cmd/main.go

57. Build React UI:

cd ui

npm ci

npm run build

cd ..

58. Create deployment package:

tar -czf drishti-package.tar.gz drishti-linux ui/build deploy.sh drishti.service

## **10.3 Deploy to Plant Server**

59. Connect plant VPN

60. Copy package to server:

scp drishti-package.tar.gz setup@[SERVER-IP]:~/

61. SSH into server and extract:

ssh setup@[SERVER-IP]

tar -xzf drishti-package.tar.gz

62. Create directory structure:

sudo mkdir -p /opt/drishti/keys /opt/drishti/static /opt/drishti/data/scans

63. Copy files:

sudo cp drishti-linux /opt/drishti/drishti

sudo chmod +x /opt/drishti/drishti

sudo cp -r ui/build/* /opt/drishti/static/

64. Create environment file — fill in plant-specific values:

sudo tee /opt/drishti/.env << 'EOF'

RDS_HOST=localhost

RDS_PORT=8080

PLANT=[PLANT_NAME]

SSH_KEY_PATH=/opt/drishti/keys/robowatch_id

DB_HOST=localhost

DB_PORT=5432

DB_NAME=drishti

DB_USER=drishti

DB_PASS=[SECURE_PASSWORD]

PORT=8088

EOF

sudo chmod 600 /opt/drishti/.env

**🔴 CRITICAL: Never commit the .env file to Git. Never store RDS credentials in React frontend files. All sensitive values must be in Go environment variables only.**

65. Create systemd service:

sudo tee /etc/systemd/system/drishti.service << 'EOF'

[Unit]

Description=DRISHTI AMR Health

After=network.target postgresql.service

[Service]

Type=simple

User=fleetmanager

WorkingDirectory=/opt/drishti

ExecStart=/opt/drishti/drishti

Restart=always

RestartSec=5

EnvironmentFile=/opt/drishti/.env

[Install]

WantedBy=multi-user.target

EOF

66. Enable and start DRISHTI:

sudo systemctl daemon-reload

sudo systemctl enable drishti

sudo systemctl start drishti

sudo systemctl status drishti | grep Active

✅ VERIFY: DRISHTI service must show 'active (running)' status

## **10.4 Set Up robowatch SSH Key for RSSI**

67. Generate SSH key on the plant server:

sudo mkdir -p /opt/drishti/keys

sudo ssh-keygen -t ed25519 -C 'robowatch-drishti' \

-f /opt/drishti/keys/robowatch_id \

-N ''

sudo chmod 600 /opt/drishti/keys/robowatch_id

sudo chmod 644 /opt/drishti/keys/robowatch_id.pub

68. Display public key — you will need this for AMR authorization:

sudo cat /opt/drishti/keys/robowatch_id.pub

69. Contact RDS vendor team to add public key to AMR authorized_keys

_ℹ NOTE: AMR robowatch user must have the DRISHTI public key in /home/robowatch/.ssh/authorized_keys for RSSI polling to work._

70. Test key authentication once vendor confirms:

ssh -i /opt/drishti/keys/robowatch_id \

-o StrictHostKeyChecking=no \

robowatch@[AMR-IP] \

'iw dev | grep Interface | head -1'

✅ VERIFY: Command must return WiFi interface name without password prompt

# **11. Veeam Backup Verification**

## **11.1 Verify Veeam After Each Major Change**

Run a Veeam backup job after each of the following steps to confirm backup integrity is maintained:

| **After Completing** | **Veeam Test Required** | **Pass Criteria** |
| --- | --- | --- |
| Firewall rules applied | Yes — mandatory | Backup completes without SSH error |
| SSH hardening applied | Yes — mandatory | Backup connects and completes |
| MariaDB restart | Yes — mandatory | Backup completes, no DB errors |
| System reboot | Yes — mandatory | Backup connects after reboot |
| DRISHTI deployment | Recommended | Backup not impacted by new service |

## **11.2 Veeam Port Requirements**

Ensure these ports are allowed from the Veeam server IP in UFW:

| **Port** | **Purpose** | **UFW Rule** |
| --- | --- | --- |
| 22/tcp | SSH access for backup | ALLOW from [VEEAM-IP] |
| 8006/tcp | Proxmox API access | ALLOW from [VEEAM-IP] |
| 2500-3300/tcp | Veeam data mover | ALLOW from [VEEAM-IP] |
| 6160/tcp | Veeam agent control | ALLOW from [VEEAM-IP] |
| 6162/tcp | Veeam agent data | ALLOW from [VEEAM-IP] |

# **12. Completion Checklist and Sign-Off**

## **12.1 Per-Plant Completion Checklist**

Complete and sign off for each plant server. Keep this record as evidence of hardening.

| **#** | **Task** | **Command to Verify** | **Status** | **Notes** |
| --- | --- | --- | --- | --- |
| 1 | Proxmox snapshot taken | Proxmox UI → Snapshots | ☐ |  |
| 2 | OS updated, kernel current | uname -r | ☐ |  |
| 3 | Disk expanded to full size | df -h / | ☐ |  |
| 4 | Desktop packages removed | dpkg -l \| wc -l | ☐ |  |
| 5 | Snap packages cleaned | snap list | ☐ |  |
| 6 | SSH banner deployed | ssh setup@[IP] | ☐ |  |
| 7 | SSH hardening applied | sshd -t | ☐ |  |
| 8 | auditd installed | systemctl status auditd | ☐ |  |
| 9 | Log rotation configured | cat /etc/logrotate.d/martinrea | ☐ |  |
| 10 | Firewall active | ufw status | ☐ |  |
| 11 | MariaDB localhost only | ss -tlnp \| grep 3306 | ☐ |  |
| 12 | RDS API responding | curl localhost:8080 | ☐ |  |
| 13 | mysql shell locked | grep mysql /etc/passwd | ☐ |  |
| 14 | Veeam backup verified | Veeam console | ☐ |  |
| 15 | DRISHTI deployed | systemctl status drishti | ☐ |  |
| 16 | AMR RSSI SSH key setup | ssh robowatch@[AMR-IP] | ☐ |  |
| 17 | Hardening log written | cat /var/log/martinrea-hardening.log | ☐ |  |
| 18 | setup account locked | passwd -S setup | ☐ | LAST STEP |

## **12.2 Sign-Off**

| **Field** | **Detail** |
| --- | --- |
| Plant |  |
| Server Hostname |  |
| Server IP |  |
| Date Completed |  |
| Engineer | Yashwanta Thakur |
| Title | IT Manager / Cybersecurity & Infrastructure |
| Signature |  |
| Reviewed By |  |
| Review Date |  |

## **12.3 Final Verification Command**

Run this final check and paste output into the hardening log:

echo '=== MARTINREA FINAL HARDENING VERIFICATION ===' && \

echo "Date: $(date)" && \

echo "Server: $(hostname)" && \

echo "Kernel: $(uname -r)" && \

echo "Disk: $(df -h / | tail -1 | awk '{print $3\" used / \"$4\" free / \"$5}')" && \

echo 'Firewall:' && sudo ufw status | head -2 && \

echo 'Services:' && sudo systemctl is-active ssh mariadb auditd ufw && \

echo 'MariaDB binding:' && sudo ss -tlnp | grep 3306 && \

echo 'RDS API:' && curl -s http://localhost:8080 | head -1 | cut -c1-50 && \

echo '=== VERIFICATION COMPLETE ==='

# **13. Per-Plant Variable Reference**

Update this table as each plant is completed. These values are required for the firewall script and DRISHTI configuration.

| **Variable** | **Shelbyville** | **Springfield** | **Hopkinsville** | **Jonesville** |
| --- | --- | --- | --- | --- |
| Server Hostname | USSHBAMRU250006 | USSPRAMRFLMGR260003 | TBD | TBD |
| Server IP | 10.205.22.12 | 10.222.10.76 | TBD | TBD |
| Plant LAN | 10.205.0.0/16 | 10.222.10.0/24 | 10.216.4.0/24 | TBD |
| AMR VLAN | 10.215.48.0/23 | 10.215.48.0/23 | TBD | TBD |
| Veeam VM IP | 10.205.22.50 | TBD | TBD | TBD |
| Login User | setup | fleetmanager | TBD | TBD |
| RDS Port | 8080 | 8080 | 8080 | 8080 |
| Hardening Date | 2026-07-02 | TBD | TBD | TBD |
| Status | ✅ Complete | ⏳ Pending | ⏳ Pending | ⏳ Pending |

# **14. Revision History**

| **Version** | **Date** | **Author** | **Change Description** |
| --- | --- | --- | --- |
| 1.0 | 2026-07-02 | Yashwanta Thakur | Initial release — based on Shelbyville hardening session |
|  |  |  |  |
|  |  |  |  |

_MARTINREA INTERNATIONAL INC. — CONFIDENTIAL — AUTHORIZED PERSONNEL ONLY_

_WI-IT-OT-001 v1.0 | IT Manager / Cybersecurity & Infrastructure: Yashwanta Thakur | July 2, 2026_

## Related Documents

- [[192.168.1.1 - wbshocket findings|192.168.1.1 Wbshocket Findings]]
- [[Drishti_Line_Side_Board_Work_Instruction|Drishti Line Side Board Work Instruction]]
- [[DRISHTI-NOC-Audit-Report|DRISHTI NOC Audit Report]]
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
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
