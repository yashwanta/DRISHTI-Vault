---
title: "DRISHTI Server Hardening Report"
source: "DRISHTI_Server_Hardening_Report.docx"
created: 2026-08-14
tags:
  - "docx"
  - "security"
  - "server"
  - "documentation"
---

**DRISHTI AMR Health Server**

**Security Hardening & HTTPS Setup**

─────────────────────────────────────

Server: usspramrapps  (10.222.5.27)

OS: Ubuntu 26.04 LTS "resolute"  ·  Kernel: 7.0.0-29-generic

Executed: August 15, 2026

Organization: Martinrea International

_Compliance: CIS Ubuntu Linux Benchmark v2.0  ·  NIST SP 800-123_

# Executive Summary

This document records the complete security hardening and HTTPS configuration performed on the DRISHTI AMR Health server (usspramrapps / 10.222.5.27) running Ubuntu 26.04 LTS. All steps were executed live on August 15, 2026 and are documented here to serve as a repeatable runbook for future deployments or audits.

The hardening process follows the CIS Ubuntu Linux Benchmark v2.0 and NIST SP 800-123 (Guide to General Server Security). Fifteen phases were completed covering system updates, network security, authentication hardening, intrusion detection, file integrity monitoring, and HTTPS reverse proxy configuration.

### **Key Outcomes**

• System updated from kernel 7.0.0-14 to 7.0.0-29 with all security patches applied

• UFW firewall configured with default-deny; SSH restricted to VPN subnet 10.2.0.0/16 only

• SSH hardened with strong ciphers (AES-256-GCM, ChaCha20), no root login, VPN-only access

• Fail2ban active — SSH brute force blocked after 4 attempts; 1-hour ban

• Auditd rules immutable (-e 2) — auditing identity, SSH, DRISHTI config changes, privileged commands

• AIDE file integrity baseline established (38MB database, scans daily)

• AppArmor: 182 profiles loaded, 106 in enforce mode

• Nginx 1.28.3 installed as HTTPS reverse proxy — TLS 1.2/1.3 only, HSTS enabled

• Self-signed certificate issued for IP 10.222.5.27 / DNS usspramrapps (365 days)

• DRISHTI application locked to 127.0.0.1:8080 — not directly reachable from network

• End-to-end test confirmed: https://10.222.5.27 → HTTP 200

**⚠ Note: **_This document intentionally omits LLM/AI API credentials and model configuration. Those settings are maintained separately._

# Hardening Phase Completion Status

| **Phase** | **Component** | **Status** | **Notes** |
| --- | --- | --- | --- |
| **Phase 0** | Pre-flight Safety Check | **COMPLETE** | _OS confirmed, SSH backup taken_ |
| **Phase 1** | Full System Update + Security Tools | **COMPLETE** | _137 pkgs upgraded, 27 security tools installed_ |
| **Phase 2** | NTP Time Sync (Chrony) | **COMPLETE** | _Synced to ntp.ubuntu.com, Stratum 3, offset 0.000036s_ |
| **Phase 3** | User Accounts & Password Policy | **COMPLETE** | _Root locked, minlen 14, 90-day expiry, dictionary check_ |
| **Phase 4** | SSH Hardening | **COMPLETE** | _VPN-only, no root, AES-256-GCM, LogLevel VERBOSE_ |
| **Phase 5** | UFW Firewall | **COMPLETE** | _Default deny in/out; SSH/80/443 on internal ranges only_ |
| **Phase 6** | Fail2ban | **COMPLETE** | _SSH jail active; Nginx jails ready (activate after Nginx)_ |
| **Phase 7** | Sysctl Kernel Hardening | **COMPLETE** | _ASLR=2, SYN cookies, no forwarding, ptrace_scope=1_ |
| **Phase 8** | Auditd Rules | **COMPLETE** | _Immutable (-e 2); identity, SSH, DRISHTI, modules audited_ |
| **Phase 9** | AIDE File Integrity Baseline | **COMPLETE** | _38MB database, 7min scan, daily check timer active_ |
| **Phase 10** | Unattended Upgrades + AppArmor | **COMPLETE** | _Security-only auto-updates; 182 AA profiles, 106 enforced_ |
| **Phase 11** | Login Banners | **COMPLETE** | _Martinrea legal warning on /etc/issue.net and /etc/motd_ |
| **Phase 12** | Disable Unused Services & Modules | **COMPLETE** | _Postfix localhost-only; cramfs/dccp/sctp/rds blacklisted_ |
| **Phase 13** | Nginx HTTPS Reverse Proxy | **COMPLETE** | _TLS 1.2/1.3, HSTS, X-Frame-Options DENY, port 443 active_ |
| **Phase 15** | DRISHTI Config Update | **COMPLETE** | _LISTEN_ADDR=127.0.0.1:8080, CORS updated, HTTP 200 confirmed_ |

# Phase 0 — Pre-flight Safety Check

Before making any changes, confirm the OS version, who is logged in, and take a backup of the SSH config. This ensures you have a recovery path before touching any security settings.

### **Commands**

# Confirm OS version

lsb_release -a

# Check who is currently logged in

who -a

# Snapshot the current SSH config as backup

sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.ORIGINAL

# Note which port SSH is on

sudo ss -tlnp | grep sshd

### **Expected Output**

Ubuntu 26.04 LTS "resolute" confirmed. SSH listening on port 22 on 0.0.0.0 and [::].

**⚠ Note: **_Always verify you have a second way in (iDRAC, physical console, or backup SSH session) before proceeding with SSH hardening in Phase 4._

# Phase 1 — Full System Update & Security Tool Installation

Update all packages to their latest versions, then install every security tool needed for the subsequent hardening phases in a single apt command.

### **Step 1 — Full system update**

sudo apt-get update && sudo apt-get upgrade -y && sudo apt-get dist-upgrade -y

sudo apt-get autoremove -y

sudo apt-get autoclean -y

### **Step 2 — Install all security tools**

sudo apt-get install -y \

ufw \

fail2ban \

auditd \

audispd-plugins \

aide \

unattended-upgrades \

apt-listchanges \

libpam-pwquality \

acl \

apparmor \

apparmor-utils \

chrony \

net-tools \

curl \

gnupg \

lsof \

sysstat

### **Result on This Server**

**✓ **137 packages upgraded including kernel 7.0.0-29, OpenSSL 3.5.5, OpenSSH 10.2p1, systemd 259.5, AppArmor 5.0.2

**✓ **27 new packages installed: fail2ban, auditd, aide, apparmor-utils, libpam-pwquality, net-tools, postfix, acl, and dependencies

**⚠ Note: **_After this step a kernel upgrade was detected (7.0.0-14 → 7.0.0-29). A reboot was performed before continuing so all hardening runs on the new kernel._

sudo reboot

# After reconnecting, verify new kernel

uname -r

# Expected: 7.0.0-29-generic

# Phase 2 — NTP Time Synchronization (Chrony)

Accurate time is required for log correlation, certificate validation, and audit trail integrity. Chrony was installed in Phase 1 and starts automatically.

### **Verify Chrony is Running**

sudo systemctl status chrony --no-pager

# Verify time sync

chronyc tracking

# Confirm NTP sources

chronyc sources -v

### **If chrony is not active, start it**

sudo systemctl enable --now chrony

### **Result on This Server**

**✓ **Active since 01:34:00 UTC. Synced to ntp-nts-3.ps6.canonical.com (Stratum 3). Offset: 0.000036 seconds. Leap status: Normal.

# Phase 3 — User Accounts & Password Policy

Lock the root account, enforce password complexity via PAM pwquality, and set password aging in /etc/login.defs per CIS Benchmark section 5.3–5.4.

### **Step 1 — Lock root account**

sudo passwd -l root

### **Step 2 — Password aging policy**

sudo sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS   90/' /etc/login.defs

sudo sed -i 's/^PASS_MIN_DAYS.*/PASS_MIN_DAYS   7/'  /etc/login.defs

sudo sed -i 's/^PASS_WARN_AGE.*/PASS_WARN_AGE   14/' /etc/login.defs

# Apply to existing accounts

sudo chage --maxdays 90 --mindays 7 --warndays 14 setup

### **Step 3 — PAM password complexity (CIS 5.3.1)**

sudo tee /etc/security/pwquality.conf << 'EOF'

minlen = 14

dcredit = -1

ucredit = -1

ocredit = -1

lcredit = -1

maxrepeat = 3

gecoscheck = 1

dictcheck = 1

EOF

### **Step 4 — Verify**

sudo chage -l setup

grep -E 'PASS_(MAX|MIN|WARN)' /etc/login.defs

cat /etc/security/pwquality.conf

### **Result on This Server**

**✓ **Root account locked. setup account: expires Nov 12 2026, min 7 days, warn 14 days. pwquality: minlen=14, all 4 character classes required, maxrepeat=3, dictionary check enabled.

# Phase 4 — SSH Hardening

Create a drop-in config file under /etc/ssh/sshd_config.d/ to enforce strong ciphers, disable dangerous features, and restrict SSH access to the VPN subnet only. Using reload (not restart) keeps existing sessions alive.

**⚠ Note: **_CRITICAL: Keep your current SSH session open throughout. Only open a second SSH session to test after reload. If the second session connects, the config is safe. If not, your first session is still live to revert._

### **Step 1 — Backup and write hardening config**

sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.phase4

sudo tee /etc/ssh/sshd_config.d/99-drishti-hardening.conf << 'EOF'

# CIS Ubuntu 26.04 SSH Hardening — DRISHTI usspramrapps

Protocol 2

Port 22

AddressFamily any

# Authentication

PermitRootLogin no

MaxAuthTries 4

MaxSessions 10

PubkeyAuthentication yes

PasswordAuthentication yes

PermitEmptyPasswords no

ChallengeResponseAuthentication no

UsePAM yes

# Session security

LoginGraceTime 60

ClientAliveInterval 300

ClientAliveCountMax 3

TCPKeepAlive no

# Disable dangerous features

X11Forwarding no

AllowAgentForwarding no

AllowTcpForwarding no

PermitUserEnvironment no

PermitTunnel no

GatewayPorts no

PrintMotd no

# Logging (CIS 5.2.5)

SyslogFacility AUTH

LogLevel VERBOSE

# Strong ciphers/MACs only (NIST 800-57)

Ciphers aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr

MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,hmac-sha2-512,hmac-sha2-256

KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group14-sha256,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512

HostKeyAlgorithms rsa-sha2-512,rsa-sha2-256,ecdsa-sha2-nistp521,ecdsa-sha2-nistp384

# Restrict to VPN subnet only

AllowUsers setup@10.2.*.*

Banner /etc/issue.net

EOF

### **Step 2 — Test and reload (safe — does not drop existing session)**

# Test first — if this fails, reload is skipped

sudo sshd -t && echo "Config OK" || echo "CONFIG ERROR — do not reload"

# Reload only if test passes

sudo sshd -t && sudo systemctl reload ssh

### **Step 3 — Verify**

sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|x11forwarding|maxauthtries|loglevel|allowusers'

### **Emergency Revert (if new SSH connections fail)**

# Run from existing session — removes new config and reloads

sudo rm /etc/ssh/sshd_config.d/99-drishti-hardening.conf

sudo systemctl reload ssh

### **Result on This Server**

**✓ **Config OK. permitrootlogin=no, maxauthtries=4, x11forwarding=no, loglevel=VERBOSE, allowusers=setup@10.2.*.* (VPN subnet only).

# Phase 5 — UFW Firewall

Configure UFW with a default-deny policy. Only allow the minimum required inbound and outbound traffic. SSH is restricted to the VPN subnet only.

### **Step 1 — SSH rule (already added at end of Phase 4)**

sudo ufw allow from 10.2.0.0/16 to any port 22 proto tcp

### **Step 2 — Default deny and remaining rules**

sudo ufw default deny incoming

sudo ufw default deny outgoing

# Outbound essentials: DNS, NTP, apt updates

sudo ufw allow out 53

sudo ufw allow out 123/udp

sudo ufw allow out 80/tcp

sudo ufw allow out 443/tcp

# Inbound HTTPS for DRISHTI users (internal network only)

sudo ufw allow from 10.0.0.0/8 to any port 443 proto tcp

# Inbound HTTP (redirects to HTTPS via Nginx)

sudo ufw allow from 10.0.0.0/8 to any port 80 proto tcp

# Enable UFW

sudo ufw --force enable

# Verify

sudo ufw status verbose

### **Removing a wrong rule (example: accidental 8080 exposure)**

sudo ufw delete allow 8080/tcp

### **Result on This Server — Final Ruleset**

Inbound:  22/tcp from 10.2.0.0/16 | 443/tcp from 10.0.0.0/8 | 80/tcp from 10.0.0.0/8

Outbound: 53 (DNS) | 123/udp (NTP) | 80/tcp | 443/tcp

Default:  deny incoming, deny outgoing

**✓ **Port 8080 (DRISHTI) is NOT in the firewall — it is internal only (127.0.0.1) and not reachable from the network.

# Phase 6 — Fail2ban

Configure Fail2ban to ban IPs after repeated SSH failures (4 attempts) and Nginx auth failures. Ban duration: 1 hour. Detection window: 10 minutes.

### **Configure and enable**

sudo tee /etc/fail2ban/jail.d/drishti.conf << 'EOF'

[DEFAULT]

bantime  = 3600

findtime = 600

maxretry = 5

backend  = systemd

[sshd]

enabled  = true

port     = 22

filter   = sshd

logpath  = /var/log/auth.log

maxretry = 4

[nginx-http-auth]

enabled  = true

port     = http,https

filter   = nginx-http-auth

logpath  = /var/log/nginx/error.log

[nginx-limit-req]

enabled  = true

port     = http,https

filter   = nginx-limit-req

logpath  = /var/log/nginx/error.log

EOF

sudo systemctl enable --now fail2ban

# Verify

sudo systemctl status fail2ban --no-pager

sudo fail2ban-client status

### **Result on This Server**

**✓ **fail2ban active. SSH jail active. Nginx jails configured — will activate once Nginx is installed (Phase 13).

**⚠ Note: **_To check banned IPs: sudo fail2ban-client status sshd | To unban: sudo fail2ban-client set sshd unbanip <IP>_

# Phase 7 — Sysctl Kernel Hardening

Apply kernel-level network and security parameters per CIS and NIST guidelines. Settings are written to /etc/sysctl.d/99-drishti-hardening.conf and applied immediately.

sudo tee /etc/sysctl.d/99-drishti-hardening.conf << 'EOF'

# Disable IP forwarding (not a router)

net.ipv4.ip_forward = 0

net.ipv6.conf.all.forwarding = 0

# Anti-spoofing / attack protection

net.ipv4.conf.all.rp_filter = 1

net.ipv4.conf.default.rp_filter = 1

net.ipv4.conf.all.accept_source_route = 0

net.ipv4.conf.default.accept_source_route = 0

net.ipv4.conf.all.accept_redirects = 0

net.ipv4.conf.default.accept_redirects = 0

net.ipv4.conf.all.secure_redirects = 0

net.ipv4.conf.default.secure_redirects = 0

net.ipv6.conf.all.accept_redirects = 0

net.ipv6.conf.all.accept_source_route = 0

net.ipv4.conf.all.send_redirects = 0

net.ipv4.conf.default.send_redirects = 0

# SYN flood protection

net.ipv4.tcp_syncookies = 1

net.ipv4.tcp_max_syn_backlog = 2048

net.ipv4.tcp_synack_retries = 2

net.ipv4.tcp_syn_retries = 5

# Log suspicious packets

net.ipv4.conf.all.log_martians = 1

net.ipv4.conf.default.log_martians = 1

# Ignore ICMP broadcast/bogus

net.ipv4.icmp_echo_ignore_broadcasts = 1

net.ipv4.icmp_ignore_bogus_error_responses = 1

# ASLR full randomisation

kernel.randomize_va_space = 2

# Restrict ptrace (stops process injection)

kernel.yama.ptrace_scope = 1

# Restrict dmesg to root

kernel.dmesg_restrict = 1

# Restrict kernel pointers in /proc

kernel.kptr_restrict = 2

# Disable SysRq

kernel.sysrq = 0

# Restrict core dumps

fs.suid_dumpable = 0

# Shared memory hardening

kernel.shm_rmid_forced = 1

EOF

# Apply immediately

sudo sysctl --system

# Verify key values

sudo sysctl net.ipv4.tcp_syncookies net.ipv4.ip_forward kernel.randomize_va_space kernel.yama.ptrace_scope kernel.dmesg_restrict

### **Result on This Server**

**✓ **All values applied. ip_forward=0, tcp_syncookies=1, randomize_va_space=2, ptrace_scope=1, dmesg_restrict=1, sysrq=0, suid_dumpable=0.

# Phase 8 — Auditd Rules

Configure the Linux Audit daemon to monitor identity changes, SSH config modifications, DRISHTI config changes, privileged command use, login events, and kernel module loading. Rules are made immutable (-e 2) requiring a reboot to change.

sudo tee /etc/audit/rules.d/99-drishti.rules << 'EOF'

-D

-b 8192

-f 1

# Identity changes (CIS 4.1.5)

-w /etc/passwd -p wa -k identity

-w /etc/shadow -p wa -k identity

-w /etc/group -p wa -k identity

-w /etc/gshadow -p wa -k identity

-w /etc/sudoers -p wa -k identity

-w /etc/sudoers.d/ -p wa -k identity

# SSH config changes

-w /etc/ssh/sshd_config -p wa -k sshd_config

-w /etc/ssh/sshd_config.d/ -p wa -k sshd_config

# DRISHTI & Nginx config changes

-w /etc/nginx/ -p wa -k nginx_config

-w /opt/drishti/ -p wa -k drishti_config

# Login/logout events

-w /var/log/faillog -p wa -k logins

-w /var/log/lastlog -p wa -k logins

-w /var/run/utmp -p wa -k session

-w /var/log/wtmp -p wa -k session

-w /var/log/btmp -p wa -k session

# Privileged command use

-a always,exit -F path=/usr/bin/sudo -F perm=x -F auid>=1000 -F auid!=unset -k privileged

-a always,exit -F path=/usr/bin/su -F perm=x -F auid>=1000 -F auid!=unset -k privileged

-a always,exit -F path=/usr/bin/passwd -F perm=x -F auid>=1000 -F auid!=unset -k privileged

# Network config changes

-a always,exit -F arch=b64 -S sethostname -S setdomainname -k network_modifications

-w /etc/hosts -p wa -k network_modifications

-w /etc/sysctl.conf -p wa -k network_modifications

-w /etc/sysctl.d/ -p wa -k network_modifications

# Kernel module loading

-w /sbin/insmod -p x -k modules

-w /sbin/rmmod -p x -k modules

-w /sbin/modprobe -p x -k modules

-a always,exit -F arch=b64 -S init_module -S delete_module -k modules

# Make rules immutable — require reboot to change

-e 2

EOF

# Load the rules

sudo augenrules --load

# Verify

sudo auditctl -l | head -20

sudo systemctl status auditd --no-pager | head -10

### **Searching audit logs**

# Search by key

sudo ausearch -k identity --start today

sudo ausearch -k sshd_config --start today

sudo ausearch -k privileged --start today

### **Result on This Server**

**✓ **enabled=2 (immutable). All watch rules active. auditd running since 01:33:58 UTC.

# Phase 9 — AIDE File Integrity Baseline

AIDE (Advanced Intrusion Detection Environment) takes a cryptographic snapshot of the filesystem. Any subsequent change to a monitored file is detected on the next daily check. The baseline must be taken AFTER all software is installed.

**⚠ Note: **_This step takes 5–10 minutes. The terminal will appear frozen — this is normal. Do not interrupt it._

### **Build initial database**

# Build the database (5-10 minutes)

sudo aideinit

# If aideinit does not find config automatically:

sudo aide --config /etc/aide/aide.conf --init

# Activate the database

sudo cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Verify

sudo ls -lh /var/lib/aide/aide.db

sudo aide --config /etc/aide/aide.conf --check 2>&1 | tail -10

### **Daily check (runs automatically via systemd timer)**

# Check timer status

sudo systemctl status dailyaidecheck.timer

# Run a manual check

sudo aide --config /etc/aide/aide.conf --check

### **After making planned changes (update the database)**

# After installing new software or changing config files intentionally:

sudo aide --config /etc/aide/aide.conf --update

sudo cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

### **Result on This Server**

**✓ **38MB database built in 7 minutes 9 seconds. SHA3-512 checksum recorded. Daily check timer active.

# Phase 10 — Unattended Upgrades & AppArmor

Configure automatic security updates and verify AppArmor is enforcing profiles.

### **Unattended upgrades — security patches only, no auto-reboot**

sudo tee /etc/apt/apt.conf.d/50unattended-upgrades-drishti << 'EOF'

Unattended-Upgrade::Allowed-Origins {

"${distro_id}:${distro_codename}-security";

"${distro_id}ESMApps:${distro_codename}-apps-security";

"${distro_id}ESM:${distro_codename}-infra-security";

};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";

Unattended-Upgrade::MinimalSteps "true";

Unattended-Upgrade::Remove-Unused-Dependencies "true";

Unattended-Upgrade::Automatic-Reboot "false";

Unattended-Upgrade::Mail "root";

EOF

sudo tee /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'

APT::Periodic::Update-Package-Lists "1";

APT::Periodic::Unattended-Upgrade "1";

APT::Periodic::AutocleanInterval "7";

EOF

# Test dry run

sudo unattended-upgrade --dry-run 2>&1 | tail -5

### **AppArmor verification**

sudo systemctl status apparmor --no-pager | head -8

sudo aa-status --verbose 2>&1 | head -15

### **Result on This Server**

**✓ **Auto-upgrades: daily update, security-only patches, no auto-reboot, alerts to root.

**✓ **AppArmor: 182 profiles loaded, 106 in enforce mode (including chronyd, snapd, man).

# Phase 11 — Login Banners

Display a legal warning before SSH login (/etc/issue.net) and after login (/etc/motd). The SSH hardening in Phase 4 already references /etc/issue.net via the Banner directive.

sudo tee /etc/issue.net << 'EOF'

***************************************************************************

AUTHORIZED ACCESS ONLY

***************************************************************************

This system is the property of Martinrea International.

Unauthorized access or use is strictly prohibited and may be subject

to civil and criminal penalties.

All activity on this system is monitored and logged.

By continuing, you consent to this monitoring.

***************************************************************************

EOF

sudo tee /etc/motd << 'EOF'

Host  : usspramrapps

System: DRISHTI AMR Health Server

Owner : Martinrea International

All access is logged. Unauthorized use is prohibited.

EOF

# Disable dynamic MOTD scripts

sudo chmod -x /etc/update-motd.d/*

# Verify

cat /etc/issue.net

### **Result on This Server**

**✓ **Martinrea legal warning displayed on /etc/issue.net and /etc/motd. Dynamic MOTD disabled.

# Phase 12 — Disable Unused Services & Kernel Modules

Stop and disable services that should not run on an application server, lock Postfix to loopback-only, and blacklist unused kernel modules to reduce attack surface.

### **Step 1 — Check what is listening**

sudo ss -tlnp

### **Step 2 — Disable unnecessary services**

sudo systemctl disable --now avahi-daemon 2>/dev/null || true

sudo systemctl disable --now cups 2>/dev/null || true

sudo systemctl disable --now isc-dhcp-server 2>/dev/null || true

sudo systemctl disable --now bluetooth 2>/dev/null || true

### **Step 3 — Restrict Postfix to localhost only**

sudo postconf -e 'inet_interfaces = loopback-only'

sudo systemctl restart postfix

# Verify: should only show 127.0.0.1:25

sudo ss -tlnp | grep 25

### **Step 4 — Blacklist unused kernel modules**

sudo tee /etc/modprobe.d/drishti-disable.conf << 'EOF'

# Disable unused filesystems

install cramfs /bin/true

install freevxfs /bin/true

install jffs2 /bin/true

install hfs /bin/true

install hfsplus /bin/true

install udf /bin/true

# Disable unused network protocols

install dccp /bin/true

install sctp /bin/true

install rds /bin/true

install tipc /bin/true

EOF

### **Result on This Server**

**✓ **Final listening ports: 22/tcp (SSH), 25/tcp (127.0.0.1 only — Postfix), 443/tcp (Nginx), 80/tcp (Nginx), 5432/tcp (127.0.0.1 — PostgreSQL), 53 (systemd-resolved, loopback only), 8080 (127.0.0.1 — DRISHTI).

# Phase 13 — Nginx HTTPS Reverse Proxy

Install Nginx, create a self-signed TLS certificate for the server IP and hostname, configure Nginx to proxy HTTPS traffic to DRISHTI on port 8080, and redirect HTTP to HTTPS.

### **Step 1 — Install Nginx**

sudo apt-get install -y nginx

### **Step 2 — Create SSL directory and self-signed certificate**

sudo mkdir -p /etc/nginx/ssl

sudo openssl req -x509 -nodes -days 365 -newkey rsa:4096 \

-keyout /etc/nginx/ssl/drishti.key \

-out /etc/nginx/ssl/drishti.crt \

-subj "/C=CA/ST=Ontario/L=Vaughan/O=Martinrea International/OU=IT/CN=usspramrapps" \

-addext "subjectAltName=IP:10.222.5.27,DNS:usspramrapps"

sudo chmod 600 /etc/nginx/ssl/drishti.key

sudo chmod 644 /etc/nginx/ssl/drishti.crt

### **Step 3 — Write Nginx site config**

sudo tee /etc/nginx/sites-available/drishti << 'EOF'

# Redirect HTTP to HTTPS

server {

listen 80;

server_name 10.222.5.27 usspramrapps;

return 301 https://$host$request_uri;

}

# HTTPS reverse proxy to DRISHTI on 8080

server {

listen 443 ssl;

server_name 10.222.5.27 usspramrapps;

ssl_certificate     /etc/nginx/ssl/drishti.crt;

ssl_certificate_key /etc/nginx/ssl/drishti.key;

ssl_protocols       TLSv1.2 TLSv1.3;

ssl_ciphers         ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

ssl_prefer_server_ciphers on;

ssl_session_timeout 1d;

ssl_session_cache   shared:SSL:10m;

ssl_session_tickets off;

add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

add_header X-Frame-Options DENY always;

add_header X-Content-Type-Options nosniff always;

add_header X-XSS-Protection "1; mode=block" always;

add_header Referrer-Policy "strict-origin-when-cross-origin" always;

location / {

proxy_pass         http://127.0.0.1:8080;

proxy_http_version 1.1;

proxy_set_header   Host $host;

proxy_set_header   X-Real-IP $remote_addr;

proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;

proxy_set_header   X-Forwarded-Proto $scheme;

proxy_set_header   Upgrade $http_upgrade;

proxy_set_header   Connection "upgrade";

proxy_read_timeout 3600s;

proxy_send_timeout 3600s;

}

}

EOF

### **Step 4 — Enable site and start Nginx**

sudo ln -sf /etc/nginx/sites-available/drishti /etc/nginx/sites-enabled/drishti

sudo rm -f /etc/nginx/sites-enabled/default

# Test config

sudo nginx -t

# Enable and start (or restart if already running)

sudo systemctl enable nginx

sudo systemctl restart nginx

# Verify

sudo systemctl status nginx --no-pager | head -8

sudo ss -tlnp | grep nginx

### **Step 5 — End-to-end test**

# Test HTTPS (ignore self-signed cert warning)

curl -k -o /dev/null -sw "%{http_code}\n" https://127.0.0.1

# Test HTTP redirect

curl -o /dev/null -sw "%{redirect_url}\n" http://127.0.0.1

### **Result on This Server**

**✓ **Nginx 1.28.3 installed. Ports 80 and 443 listening. curl https://10.222.5.27 → HTTP 200. HTTP redirects to https://127.0.0.1/.

# Phase 15 — DRISHTI Application Configuration

Lock DRISHTI to listen on localhost only, update CORS origins to reflect the new HTTPS URLs, and restart the service.

### **Step 1 — Find DRISHTI config location**

sudo find /opt /etc /home /srv -name "*.conf" -o -name ".env" 2>/dev/null | grep -i drishti

sudo systemctl cat drishti 2>/dev/null | head -20

# Config is at: /etc/drishti/drishti.conf

# View current config:

sudo cat /etc/drishti/drishti.conf

### **Step 2 — Apply changes**

# Backup first

sudo cp /etc/drishti/drishti.conf /etc/drishti/drishti.conf.bak

# Lock to localhost only (critical — prevents direct access bypassing Nginx)

sudo sed -i 's|^LISTEN_ADDR=:8080|LISTEN_ADDR=127.0.0.1:8080|' /etc/drishti/drishti.conf

# Update CORS for Nginx HTTPS

sudo sed -i 's|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://10.222.5.27,https://usspramrapps|' /etc/drishti/drishti.conf

# Verify changes

sudo grep -E 'LISTEN_ADDR|ALLOWED_ORIGINS' /etc/drishti/drishti.conf

### **Step 3 — Restart DRISHTI and verify**

sudo systemctl restart drishti

sudo systemctl status drishti --no-pager | head -10

# Confirm DRISHTI is only on localhost

sudo ss -tlnp | grep 8080

# Expected: 127.0.0.1:8080 only (not *:8080)

# Final end-to-end test

curl -k -o /dev/null -sw "%{http_code}\n" https://10.222.5.27

### **Result on This Server**

**✓ **LISTEN_ADDR=127.0.0.1:8080, ALLOWED_ORIGINS updated. DRISHTI restarted at 02:20:12 UTC. curl https://10.222.5.27 → 200.

# Ongoing Maintenance Reference

### **Check security service status at any time**

sudo systemctl status nginx fail2ban auditd chrony apparmor --no-pager

sudo ufw status verbose

sudo fail2ban-client status sshd

### **Renew SSL certificate (before 365-day expiry)**

sudo openssl req -x509 -nodes -days 365 -newkey rsa:4096 \

-keyout /etc/nginx/ssl/drishti.key \

-out /etc/nginx/ssl/drishti.crt \

-subj "/C=CA/ST=Ontario/L=Vaughan/O=Martinrea International/OU=IT/CN=usspramrapps" \

-addext "subjectAltName=IP:10.222.5.27,DNS:usspramrapps"

sudo systemctl reload nginx

### **After planned system changes — update AIDE baseline**

sudo aide --config /etc/aide/aide.conf --update

sudo cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

### **View audit log for a specific event type**

sudo ausearch -k identity --start today

sudo ausearch -k sshd_config --start today

sudo ausearch -k privileged --start today

sudo ausearch -k nginx_config --start today

### **View Nginx access and error logs**

sudo tail -f /var/log/nginx/access.log

sudo tail -f /var/log/nginx/error.log

### **DRISHTI application log**

sudo tail -f /var/log/drishti/drishti.log

# Appendix — Key File Locations

| **File / Path** | **Purpose** |
| --- | --- |
| /etc/ssh/sshd_config.d/99-drishti-hardening.conf | SSH hardening drop-in config |
| /etc/ssh/sshd_config.ORIGINAL | Original SSH config backup |
| /etc/fail2ban/jail.d/drishti.conf | Fail2ban jail configuration |
| /etc/audit/rules.d/99-drishti.rules | Auditd rules (immutable) |
| /etc/sysctl.d/99-drishti-hardening.conf | Kernel hardening parameters |
| /etc/modprobe.d/drishti-disable.conf | Blacklisted kernel modules |
| /etc/security/pwquality.conf | PAM password complexity rules |
| /var/lib/aide/aide.db | AIDE file integrity database |
| /etc/nginx/sites-available/drishti | Nginx HTTPS reverse proxy config |
| /etc/nginx/ssl/drishti.crt | TLS certificate (365-day self-signed) |
| /etc/nginx/ssl/drishti.key | TLS private key (chmod 600) |
| /etc/drishti/drishti.conf | DRISHTI application configuration |
| /etc/drishti/drishti.conf.bak | DRISHTI config backup (pre-hardening) |
| /etc/issue.net | Pre-login legal banner |
| /etc/motd | Post-login message |
| /var/log/nginx/access.log | Nginx access log |
| /var/log/nginx/error.log | Nginx error log (used by fail2ban) |
| /var/log/drishti/drishti.log | DRISHTI application log |

_Document prepared by IT Security — Martinrea International  ·  August 15, 2026_

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
- [[DRISHTI_SiteOps_Agent_Brief|DRISHTI Siteops Agent Brief]]
- [[WI-09-Podman-Desktop-on-Windows-VMware|WI 09 Podman Desktop On Windows Vmware]]
- [[WI-10-Windows-Installer-Workspace-Capacity|WI 10 Windows Installer Workspace Capacity]]
- [[WI-11-Native-Windows-Installation|WI 11 Native Windows Installation]]
- [[WI-IT-OT-001_FleetManager_Server_Build_Standard_v1.0|WI IT OT 001 Fleetmanager Server Build Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
