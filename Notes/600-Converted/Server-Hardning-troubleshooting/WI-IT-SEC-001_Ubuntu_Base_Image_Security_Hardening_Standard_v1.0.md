---
title: "WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0"
source: "WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0.docx"
created: 2026-07-02
tags:
  - "docx"
  - "security"
  - "server"
  - "documentation"
---

**MARTINREA INTERNATIONAL INC.**

Information Technology — Cybersecurity & Infrastructure

**WORK INSTRUCTION**

**Ubuntu Base Image**

Security Hardening Standard

_Applies to: Ubuntu Desktop 24.04 LTS  |  Ubuntu Server 24.04 LTS_

**WI-IT-SEC-001**

| **Field** | **Detail** |
| --- | --- |
| Document Number | WI-IT-SEC-001 |
| Title | Ubuntu Base Image Security Hardening Standard |
| Applies To | Ubuntu 22.04 LTS, Ubuntu 24.04 LTS — Desktop and Server |
| Version | 1.0 |
| Effective Date | July 2, 2026 |
| Author | Yashwanta Thakur |
| Title | IT Manager / Cybersecurity & Infrastructure |
| Department | Information Technology |
| Classification | CONFIDENTIAL — Internal Use Only |
| Review Cycle | Annual or after CIS benchmark update |
| Scope | All Martinrea Ubuntu workstations, servers, and VMs |

_MARTINREA INTERNATIONAL INC. — CONFIDENTIAL — AUTHORIZED PERSONNEL ONLY_

# **1. Purpose, Scope, and Applicability**

This Work Instruction establishes the minimum security hardening standard for all Ubuntu Linux systems deployed at Martinrea International. It applies regardless of the application running on the system. Application-specific instructions are covered in separate documents.

## **1.1 Applicability**

| **System Type** | **Applies?** | **Notes** |
| --- | --- | --- |
| Ubuntu Server 24.04 LTS (VM) | ✅ Yes | Primary target — Proxmox VMs |
| Ubuntu Server 22.04 LTS (VM) | ✅ Yes | Legacy — apply where possible |
| Ubuntu Desktop 24.04 LTS | ✅ Yes | Additional desktop controls apply |
| Ubuntu Desktop — Engineering workstations | ✅ Yes | Extra USB and screen lock controls |
| Other Linux distros (RHEL, Debian, etc.) | ⚠ Partially | Adapt commands — principles apply |
| Windows systems | ❌ No | Covered in separate WI |
| Network switches and routers | ❌ No | Covered in separate WI |
| AMR robots (embedded Linux) | ❌ No | Vendor-managed — do not modify |

## **1.2 Hardening Levels**

| **Level** | **Description** | **Target Systems** |
| --- | --- | --- |
| Level 1 — Base | Minimum required for ALL Ubuntu systems | Every Ubuntu VM and workstation |
| Level 2 — Server | Additional controls for server-role systems | All Ubuntu servers and VMs |
| Level 3 — Desktop | Additional controls for desktop GUI systems | Workstations with GUI only |
| Level 4 — OT/Critical | Strictest controls for OT-adjacent systems | Fleet manager, DRISHTI servers |

## **1.3 Compliance Alignment**

- CIS Ubuntu Linux 24.04 LTS Benchmark v1.0

- NIST SP 800-123 — Guide to General Server Security

- Martinrea IT Security Policy — OT Infrastructure

- CrowdStrike Falcon EDR deployment standard

# **2. Pre-Hardening Requirements**

**🔴 CRITICAL: Always take a full system backup or VM snapshot before starting any hardening procedure.**

## **2.1 Pre-Hardening Checklist**

| **#** | **Requirement** | **Server** | **Desktop** | **Verified** |
| --- | --- | --- | --- | --- |
| 1 | VM snapshot or full backup taken | ✅ | ✅ | ☐ |
| 2 | System can be accessed via console if SSH fails | ✅ | ✅ | ☐ |
| 3 | Current kernel and OS version documented | ✅ | ✅ | ☐ |
| 4 | All running services documented before changes | ✅ | ✅ | ☐ |
| 5 | Application team notified of maintenance window | ✅ | ✅ | ☐ |
| 6 | Veeam or backup job confirmed working | ✅ | N/A | ☐ |
| 7 | Rollback plan documented | ✅ | ✅ | ☐ |
| 8 | Corp VPN connected (if remote) | ✅ | ✅ | ☐ |

## **2.2 Document Current State**

Run these commands and save output BEFORE making any changes:

# Document current system state

echo '=== PRE-HARDENING BASELINE ===' && \

date && hostname && uname -r && \

cat /etc/os-release | grep PRETTY && \

df -h / && free -h && \

sudo ss -tlnp && \

sudo ufw status && \

sudo systemctl list-units --type=service --state=running && \

cat /etc/passwd | grep -v nologin | grep -v false && \

sudo last | head -20 | tee /var/log/martinrea-pre-hardening-baseline.txt

✅ VERIFY: File /var/log/martinrea-pre-hardening-baseline.txt must exist before proceeding

# **3. System Updates and Package Management**

## **3.1 Apply All System Updates — Level 1 (All Systems)**

**⚠ WARNING: Never skip system updates. An unpatched system cannot be considered hardened regardless of other controls applied.**

1. Update package lists and apply all upgrades:

sudo apt-get update && \

sudo apt-get upgrade -y && \

sudo apt-get dist-upgrade -y && \

sudo apt-get autoremove -y && \

sudo apt-get autoclean

2. Check if reboot is required:

sudo ls /var/run/reboot-required 2>/dev/null && \

echo '⚠ REBOOT REQUIRED' || echo '✅ No reboot needed'

3. If reboot required — open console access first, then reboot:

sudo reboot

4. Verify kernel after reboot:

uname -r

## **3.2 Configure Automatic Security Updates — Level 1**

5. Install unattended-upgrades:

sudo apt-get install -y unattended-upgrades apt-listchanges

6. Enable automatic security updates:

sudo tee /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'

Unattended-Upgrade::Allowed-Origins {

"${distro_id}:${distro_codename}-security";

};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";

Unattended-Upgrade::Remove-Unused-Dependencies "true";

Unattended-Upgrade::Automatic-Reboot "false";

Unattended-Upgrade::Mail "yashwanta.thakur@martinrea.com";

EOF

7. Enable the auto-update timer:

sudo tee /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'

APT::Periodic::Update-Package-Lists "1";

APT::Periodic::Download-Upgradeable-Packages "1";

APT::Periodic::AutocleanInterval "7";

APT::Periodic::Unattended-Upgrade "1";

EOF

8. Test configuration:

sudo unattended-upgrades --dry-run --debug

✅ VERIFY: Output should show security updates would be applied with no errors

## **3.3 Remove Unnecessary Packages — Level 1**

Minimize attack surface by removing services not required for the system's role.

### **For All Systems (Server and Desktop):**

9. Remove legacy and insecure services:

sudo apt-get remove -y telnet rsh-client rsh-server \

ftp lftp tftp tftpd-hpa \

rpcbind nfs-kernel-server \

nis yp-tools \

finger talk talkd \

xinetd 2>/dev/null || true

10. Remove if not needed (check before removing):

# Only remove if confirmed not in use

sudo apt-get remove -y avahi-daemon 2>/dev/null || true   # mDNS

sudo apt-get remove -y cups 2>/dev/null || true           # Printing

sudo apt-get remove -y samba 2>/dev/null || true          # Windows file share

11. Clean up:

sudo apt-get autoremove -y && sudo apt-get autoclean

### **For Servers Only (Level 2):**

12. Remove desktop and GUI packages from servers:

sudo apt-get remove -y lightdm gdm3 xorg \

ubuntu-desktop gnome-shell \

xrdp wpa-supplicant \

bluetooth bluez \

colord cups-browsed 2>/dev/null || true

sudo apt-get autoremove -y

✅ VERIFY: Servers must not run GUI desktop environments, Bluetooth, or printing services

# **4. User Account Security**

## **4.1 Root Account — Level 1 (All Systems)**

13. Lock the root password (disable direct root login):

sudo passwd -l root

14. Verify root is locked:

sudo passwd -S root

✅ VERIFY: Output must show 'root L' — the L indicates locked

15. Ensure root SSH login is disabled (covered in Section 6 — SSH):

sudo grep 'PermitRootLogin' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null

✅ VERIFY: Must show 'PermitRootLogin no' or 'PermitRootLogin prohibit-password'

## **4.2 Service Account Shells — Level 1 (All Systems)**

Service accounts must not have interactive login shells. Review all accounts:

16. List all accounts with interactive shells:

cat /etc/passwd | grep -v '/sbin/nologin' | grep -v '/bin/false' | grep -v '/usr/sbin/nologin'

17. Lock shell for service accounts — only human admin accounts should have shells:

# Lock service account shells — adjust list per system

for svc in mysql postgres www-data daemon bin sys games man lp mail news uucp proxy backup list irc; do

id $svc > /dev/null 2>&1 && sudo usermod -s /sbin/nologin $svc

done

18. Verify — only your named admin accounts should remain with bash:

cat /etc/passwd | grep -v '/sbin/nologin' | grep -v '/bin/false' | grep -v '/usr/sbin/nologin'

## **4.3 Password Policy — Level 1 (All Systems)**

19. Install password quality enforcement:

sudo apt-get install -y libpam-pwquality

20. Configure password quality requirements:

sudo tee /etc/security/pwquality.conf << 'EOF'

# Martinrea Password Policy

minlen = 14          # Minimum 14 characters

dcredit = -1         # At least 1 digit

ucredit = -1         # At least 1 uppercase

ocredit = -1         # At least 1 special character

lcredit = -1         # At least 1 lowercase

maxrepeat = 3        # No more than 3 consecutive identical chars

maxclassrepeat = 4   # No more than 4 consecutive same-class chars

minclass = 3         # At least 3 character classes

EOF

21. Configure password aging in /etc/login.defs:

sudo sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS   90/'  /etc/login.defs

sudo sed -i 's/^PASS_MIN_DAYS.*/PASS_MIN_DAYS   1/'   /etc/login.defs

sudo sed -i 's/^PASS_WARN_AGE.*/PASS_WARN_AGE   14/'  /etc/login.defs

22. Verify:

grep -E 'PASS_MAX_DAYS|PASS_MIN_DAYS|PASS_WARN_AGE' /etc/login.defs

✅ VERIFY: PASS_MAX_DAYS must be 90 or less

## **4.4 Account Lockout Policy — Level 1 (All Systems)**

23. Install PAM faillock:

sudo apt-get install -y libpam-modules

24. Configure account lockout after failed attempts:

sudo tee /etc/security/faillock.conf << 'EOF'

# Martinrea Account Lockout Policy

deny = 5              # Lock after 5 failed attempts

unlock_time = 900     # Lock for 15 minutes (900 seconds)

fail_interval = 900   # Count failures within 15-minute window

even_deny_root = true # Apply to root too

audit = true          # Log failures to audit

EOF

25. Enable faillock in PAM:

sudo pam-auth-update --enable faillock

26. Test — attempt wrong password 5 times then verify lockout:

# Verify faillock is tracking failures

sudo faillock --user [USERNAME]

## **4.5 Sudo Configuration — Level 1 (All Systems)**

27. Verify sudoers file is valid:

sudo visudo -c

28. Configure sudo logging:

sudo tee /etc/sudoers.d/martinrea-sudo-policy << 'EOF'

# Martinrea Sudo Policy

# Require password for sudo even if recently entered

Defaults timestamp_timeout=5

# Log all sudo commands

Defaults logfile=/var/log/sudo.log

Defaults log_input, log_output

# Disable sudo over SSH without TTY

Defaults requiretty

EOF

29. Verify no unauthorized users have sudo:

grep -E '^%sudo|^%admin|NOPASSWD' /etc/sudoers /etc/sudoers.d/* 2>/dev/null

**⚠ WARNING: NOPASSWD in sudoers is a significant security risk. Remove unless absolutely required and documented.**

# **5. Filesystem Security**

## **5.1 Filesystem Mount Options — Level 2 (Servers)**

Restrict filesystem permissions on sensitive mount points to prevent exploitation.

30. Edit /etc/fstab to add security options:

sudo cp /etc/fstab /etc/fstab.bak

sudo nano /etc/fstab

Add these options to the appropriate mount points:

| **Mount Point** | **Add Options** | **Effect** |
| --- | --- | --- |
| /tmp | nodev,nosuid,noexec | Prevent device files, setuid, and executables |
| /var/tmp | nodev,nosuid,noexec | Same as /tmp |
| /dev/shm | nodev,nosuid,noexec | Secure shared memory |
| /home | nodev,nosuid | Prevent device files and setuid in home dirs |
| /boot | nodev,nosuid,noexec,ro | Read-only boot partition |

31. Apply changes without reboot:

sudo mount -o remount,nodev,nosuid,noexec /tmp

sudo mount -o remount,nodev,nosuid,noexec /dev/shm

## **5.2 SUID/SGID Audit — Level 1 (All Systems)**

32. Find all SUID/SGID binaries — document before and after hardening:

sudo find / -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null \

| tee /var/log/martinrea-suid-audit.txt

33. Review list and remove SUID from non-essential binaries:

# Example — remove SUID from tools not needed

sudo chmod u-s /usr/bin/at 2>/dev/null || true

sudo chmod u-s /usr/bin/wall 2>/dev/null || true

sudo chmod u-s /usr/bin/write 2>/dev/null || true

_ℹ NOTE: Never remove SUID from system-critical binaries such as passwd, sudo, ping, or su without fully understanding the impact._

## **5.3 World-Writable Files — Level 1 (All Systems)**

34. Find world-writable files excluding /proc and /sys:

sudo find / -xdev -type f -perm -0002 2>/dev/null \

| grep -v '/proc/' | grep -v '/sys/' \

| tee /var/log/martinrea-worldwrite-audit.txt

35. Remove world-writable permission from any unexpected files:

# Review the list — for each unexpected file:

sudo chmod o-w [FILENAME]

## **5.4 Core Dump Restrictions — Level 2 (Servers)**

36. Disable core dumps — they can expose sensitive memory:

sudo tee -a /etc/security/limits.conf << 'EOF'

# Martinrea — Disable core dumps

*    hard    core    0

*    soft    core    0

EOF

37. Disable core dumps via sysctl:

sudo tee /etc/sysctl.d/99-martinrea-coredump.conf << 'EOF'

fs.suid_dumpable = 0

EOF

sudo sysctl -p /etc/sysctl.d/99-martinrea-coredump.conf

# **6. SSH Hardening**

## **6.1 SSH Legal Banner — Level 1 (All Systems)**

A legal banner must display before login on all SSH-accessible systems.

38. Create the banner file — update plant/hostname per system:

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

*  All sessions are monitored, logged, and subject to audit.*

*  By continuing, you consent to monitoring.                *

*                                                           *

*  If you are not an authorized user, disconnect NOW.       *

*                                                           *

*  Report security incidents to:                            *

*  IT Manager / Cybersecurity & Infrastructure              *

*  Yashwanta Thakur                                         *

*************************************************************

EOF

sudo chmod 644 /etc/ssh/martinrea-banner.txt

## **6.2 SSH Daemon Configuration — Level 1 (All Systems)**

39. Backup original SSH config:

sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%Y%m%d)

40. Apply hardening config as drop-in file:

sudo tee /etc/ssh/sshd_config.d/99-martinrea-hardening.conf << 'EOF'

# ============================================================

# Martinrea International Inc. — SSH Security Hardening

# Engineer: Yashwanta Thakur — IT Manager / Cybersecurity

# WI-IT-SEC-001 v1.0

# ============================================================

# Protocol and version

Protocol 2

# Authentication

PermitRootLogin no

MaxAuthTries 5

MaxSessions 10

LoginGraceTime 60

PermitEmptyPasswords no

# Password auth — keep yes for OT environments

# Set to 'no' only if SSH keys are deployed for ALL users

PasswordAuthentication yes

# Key-based auth

PubkeyAuthentication yes

AuthorizedKeysFile .ssh/authorized_keys

# Disable insecure auth methods

ChallengeResponseAuthentication no

KerberosAuthentication no

GSSAPIAuthentication no

HostbasedAuthentication no

IgnoreRhosts yes

# Session

ClientAliveInterval 300

ClientAliveCountMax 3

TCPKeepAlive no

# Forwarding — disable all unless specifically needed

X11Forwarding no

AllowTcpForwarding no

AllowAgentForwarding no

PermitTunnel no

# Security

StrictModes yes

UsePrivilegeSeparation sandbox

Compression no

PermitUserEnvironment no

# Logging

LogLevel VERBOSE

SyslogFacility AUTH

# Display legal banner

Banner /etc/ssh/martinrea-banner.txt

EOF

41. Test SSH config syntax — MUST pass before reloading:

sudo sshd -t && echo '✅ Config OK' || echo '❌ ERROR — do not reload'

**🔴 CRITICAL: Only proceed if sshd -t returns no errors. Test from a NEW terminal before closing current session.**

42. Reload SSH:

sudo systemctl reload ssh

sudo systemctl status ssh | grep Active

43. Verify from new terminal window — banner must appear:

ssh [USERNAME]@[SERVER-IP]

✅ VERIFY: Banner must appear and login must succeed before closing original session

## **6.3 SSH Ciphers and Algorithms — Level 2 (Servers)**

Restrict SSH to modern, secure cryptographic algorithms only.

44. Add cipher restrictions to SSH hardening config:

sudo tee -a /etc/ssh/sshd_config.d/99-martinrea-hardening.conf << 'EOF'

# Approved ciphers only — disable weak algorithms

Ciphers aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr

MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,hmac-sha2-512,hmac-sha2-256

KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group14-sha256,diffie-hellman-group16-sha512

HostKeyAlgorithms ssh-ed25519,rsa-sha2-512,rsa-sha2-256

EOF

45. Test and reload:

sudo sshd -t && sudo systemctl reload ssh

## **6.4 Fail2Ban — Brute Force Protection — Level 1 (All Systems)**

46. Install fail2ban:

sudo apt-get install -y fail2ban

47. Create Martinrea jail configuration:

sudo tee /etc/fail2ban/jail.d/martinrea-ssh.conf << 'EOF'

[DEFAULT]

bantime  = 3600        # Ban for 1 hour

findtime = 600         # Within 10-minute window

maxretry = 5           # After 5 failures

[sshd]

enabled  = true

port     = ssh

filter   = sshd

logpath  = %(sshd_log)s

backend  = %(sshd_backend)s

banaction = ufw

EOF

48. Enable and start fail2ban:

sudo systemctl enable fail2ban

sudo systemctl start fail2ban

sudo fail2ban-client status sshd

✅ VERIFY: fail2ban-client status sshd must show jail is active with 0 or more banned IPs

# **7. Firewall Configuration**

## **7.1 UFW Base Configuration — Level 1 (All Systems)**

**⚠ WARNING: Define all required access rules BEFORE enabling UFW. Wrong rules will lock you out.**

49. Reset UFW to clean state:

sudo ufw --force reset

50. Set default policies:

sudo ufw default deny incoming

sudo ufw default allow outgoing

sudo ufw default deny forward

51. Allow loopback:

sudo ufw allow in on lo comment 'Loopback'

52. Allow SSH from trusted networks only — REPLACE with your actual networks:

# Corp VPN — IT staff

sudo ufw allow from 10.2.1.0/24 to any port 22 proto tcp comment 'SSH IT VPN'

# Plant management LAN

sudo ufw allow from 10.0.0.0/8 to any port 22 proto tcp comment 'SSH plant LAN'

53. Add application-specific rules — see application work instruction

54. Enable UFW:

sudo ufw --force enable

sudo ufw status verbose

✅ VERIFY: UFW status must show 'active' and all expected rules must be listed

## **7.2 ICMP Configuration — Level 1 (All Systems)**

Restrict ping/ICMP to trusted networks only — block from internet.

55. Edit UFW before.rules to restrict ICMP:

sudo cp /etc/ufw/before.rules /etc/ufw/before.rules.bak

sudo sed -i 's/-A ufw-before-input -p icmp --icmp-type echo-request -j ACCEPT/

-A ufw-before-input -s 10.0.0.0\/8 -p icmp --icmp-type echo-request -j ACCEPT\n

-A ufw-before-input -p icmp --icmp-type echo-request -j DROP/' \

/etc/ufw/before.rules

56. Reload UFW:

sudo ufw reload

## **7.3 Kernel Network Parameters — Level 2 (Servers)**

Harden kernel network stack against common attacks.

57. Create sysctl hardening config:

sudo tee /etc/sysctl.d/99-martinrea-network.conf << 'EOF'

# Martinrea Network Security — sysctl hardening

# Engineer: Yashwanta Thakur — IT Manager / Cybersecurity

# IP Spoofing protection

net.ipv4.conf.all.rp_filter = 1

net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP broadcast requests

net.ipv4.icmp_echo_ignore_broadcasts = 1

# Disable source packet routing

net.ipv4.conf.all.accept_source_route = 0

net.ipv4.conf.default.accept_source_route = 0

net.ipv6.conf.all.accept_source_route = 0

net.ipv6.conf.default.accept_source_route = 0

# Ignore send redirects

net.ipv4.conf.all.send_redirects = 0

net.ipv4.conf.default.send_redirects = 0

# Block SYN attacks

net.ipv4.tcp_syncookies = 1

net.ipv4.tcp_max_syn_backlog = 2048

net.ipv4.tcp_synack_retries = 2

net.ipv4.tcp_syn_retries = 5

# Log suspicious packets

net.ipv4.conf.all.log_martians = 1

net.ipv4.conf.default.log_martians = 1

# Disable IPv6 if not needed

# net.ipv6.conf.all.disable_ipv6 = 1

# net.ipv6.conf.default.disable_ipv6 = 1

# Disable IP forwarding (servers are not routers)

net.ipv4.ip_forward = 0

net.ipv6.conf.all.forwarding = 0

# Protect against time-wait assassination

net.ipv4.tcp_rfc1337 = 1

# Randomize virtual address space (ASLR)

kernel.randomize_va_space = 2

# Restrict kernel pointer exposure

kernel.kptr_restrict = 2

# Restrict dmesg access

kernel.dmesg_restrict = 1

# Disable magic SysRq key

kernel.sysrq = 0

EOF

58. Apply sysctl settings:

sudo sysctl -p /etc/sysctl.d/99-martinrea-network.conf

59. Verify key settings applied:

sudo sysctl net.ipv4.tcp_syncookies net.ipv4.conf.all.rp_filter kernel.randomize_va_space

✅ VERIFY: All three values must return 1, 1, 2 respectively

# **8. Audit Logging and Monitoring**

## **8.1 Install and Configure auditd — Level 1 (All Systems)**

60. Install auditd:

sudo apt-get install -y auditd audispd-plugins

61. Configure audit daemon settings:

sudo tee -a /etc/audit/auditd.conf << 'EOF'

# Martinrea Audit Configuration

max_log_file = 50

max_log_file_action = ROTATE

num_logs = 8

space_left = 1024

space_left_action = SYSLOG

admin_space_left = 512

admin_space_left_action = SUSPEND

EOF

62. Create comprehensive audit rules:

sudo tee /etc/audit/rules.d/99-martinrea.rules << 'EOF'

# ============================================================

# Martinrea International — auditd Rules

# WI-IT-SEC-001 v1.0

# ============================================================

# Delete all existing rules first

-D

# Set buffer size

-b 8192

# Failure mode — 1=log, 2=panic

-f 1

# ── Identity and Authentication ──────────────────

-w /etc/passwd         -p wa -k identity

-w /etc/shadow         -p wa -k identity

-w /etc/group          -p wa -k identity

-w /etc/gshadow        -p wa -k identity

-w /etc/security/opasswd -p wa -k identity

# ── SSH ──────────────────────────────────────────

-w /etc/ssh/sshd_config      -p wa -k sshd

-w /etc/ssh/sshd_config.d/   -p wa -k sshd

-w /home/                    -p wa -k home_ssh

# ── Privileged commands ──────────────────────────

-a always,exit -F arch=b64 -S execve -F euid=0 -k root_commands

-w /usr/bin/sudo  -p x -k sudo

-w /usr/bin/su    -p x -k sudo

-w /bin/su        -p x -k sudo

# ── Sudo config ──────────────────────────────────

-w /etc/sudoers        -p wa -k sudoers

-w /etc/sudoers.d/     -p wa -k sudoers

# ── Firewall ─────────────────────────────────────

-w /etc/ufw/           -p wa -k firewall

-w /etc/iptables/      -p wa -k firewall

# ── Cron ─────────────────────────────────────────

-w /etc/cron.d/        -p wa -k cron

-w /etc/crontab        -p wa -k cron

-w /etc/cron.hourly/   -p wa -k cron

-w /etc/cron.daily/    -p wa -k cron

-w /etc/cron.weekly/   -p wa -k cron

-w /etc/cron.monthly/  -p wa -k cron

-w /var/spool/cron/    -p wa -k cron

# ── Session tracking ─────────────────────────────

-w /var/log/lastlog -p wa -k logins

-w /var/run/utmp    -p wa -k session

-w /var/log/wtmp    -p wa -k session

-w /var/log/btmp    -p wa -k session

# ── System calls — suspicious activity ───────────

-a always,exit -F arch=b64 -S mount     -k mount

-a always,exit -F arch=b64 -S umount2   -k mount

-a always,exit -F arch=b64 -S ptrace    -k ptrace

-a always,exit -F arch=b64 -S kill      -F a1=9  -k kill_signal

# ── File deletions ──────────────────────────────

-a always,exit -F arch=b64 -S unlink -S unlinkat -S rename -S renameat -k delete

# ── Network config changes ───────────────────────

-a always,exit -F arch=b64 -S sethostname -S setdomainname -k network_modifications

-w /etc/network/      -p wa -k network

-w /etc/netplan/      -p wa -k network

-w /etc/resolv.conf   -p wa -k network

# ── Kernel modules ───────────────────────────────

-w /sbin/insmod -p x -k modules

-w /sbin/rmmod  -p x -k modules

-w /sbin/modprobe -p x -k modules

-a always,exit -F arch=b64 -S init_module -S delete_module -k modules

# ── Make audit config immutable (reboot to change)

-e 2

EOF

63. Enable and start auditd:

sudo systemctl enable auditd

sudo systemctl restart auditd

sudo systemctl status auditd | grep Active

✅ VERIFY: auditd must be active (running)

## **8.2 Log Management — Level 1 (All Systems)**

64. Configure log rotation for all Martinrea logs:

sudo tee /etc/logrotate.d/martinrea << 'EOF'

/var/log/martinrea-*.log {

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

65. Configure systemd journal limits:

sudo mkdir -p /etc/systemd/journald.conf.d

sudo tee /etc/systemd/journald.conf.d/martinrea.conf << 'EOF'

[Journal]

SystemMaxUse=2G

SystemMaxFileSize=200M

MaxRetentionSec=3month

Compress=yes

EOF

sudo systemctl restart systemd-journald

## **8.3 CrowdStrike Falcon EDR — Level 1 (All Systems)**

All Martinrea systems must have CrowdStrike Falcon Sensor deployed. This is mandatory and non-negotiable.

66. Verify CrowdStrike is installed and running:

sudo systemctl status falcon-sensor | grep -E 'Active|running'

sudo /opt/CrowdStrike/falconctl -g --aid

✅ VERIFY: falcon-sensor must show 'active (running)' with a valid AID (Agent ID)

67. If CrowdStrike is not installed — install from Martinrea IT portal:

# Download from Martinrea IT security portal

# Transfer to server and install:

sudo dpkg -i falcon-sensor_*.deb

sudo /opt/CrowdStrike/falconctl -s --cid=[YOUR-CID]

sudo systemctl enable falcon-sensor

sudo systemctl start falcon-sensor

**🔴 CRITICAL: Never disable or uninstall CrowdStrike Falcon without written approval from the IT Manager. Doing so leaves the system unprotected and violates Martinrea security policy.**

# **9. Kernel and Boot Security**

## **9.1 Kernel Module Restrictions — Level 2 (Servers)**

68. Disable uncommon network protocols not needed in plant environment:

sudo tee /etc/modprobe.d/martinrea-disable-modules.conf << 'EOF'

# Martinrea — Disable unnecessary kernel modules

# Engineer: Yashwanta Thakur — IT Manager / Cybersecurity

# Uncommon network protocols

install dccp    /bin/true

install sctp    /bin/true

install rds     /bin/true

install tipc    /bin/true

install n-hdlc  /bin/true

install ax25    /bin/true

install netrom  /bin/true

install x25     /bin/true

install rose    /bin/true

install decnet  /bin/true

install econet  /bin/true

install af_802154 /bin/true

install ipx     /bin/true

install appletalk /bin/true

install psnap   /bin/true

install p8023   /bin/true

install p8022   /bin/true

# USB storage — remove if USB drives should not be used

# install usb-storage /bin/true

# Firewire

install firewire-core /bin/true

install firewire-ohci /bin/true

install firewire-sbp2 /bin/true

EOF

69. Update module dependencies:

sudo update-initramfs -u

## **9.2 GRUB Boot Security — Level 2 (Servers)**

70. Set GRUB password to prevent unauthorized boot options:

# Generate password hash

sudo grub-mkpasswd-pbkdf2

# Enter and confirm password when prompted

# Copy the grub.pbkdf2.sha512... hash

71. Add password to GRUB config:

sudo tee /etc/grub.d/40_custom << 'EOF'

set superusers="martinrea-admin"

password_pbkdf2 martinrea-admin [PASTE_HASH_HERE]

EOF

72. Update GRUB:

sudo update-grub

_ℹ NOTE: The GRUB password prevents physical attackers from booting into recovery mode. Store the password securely in your IT password manager._

# **10. Desktop-Specific Hardening**

This section applies ONLY to Ubuntu Desktop systems — workstations, engineering PCs, and any system running a GUI desktop environment. Skip this section for headless servers.

## **10.1 Screen Lock and Session Timeout — Level 3 (Desktop)**

73. Configure automatic screen lock via gsettings:

# Apply for all users via dconf system database

sudo mkdir -p /etc/dconf/db/local.d

sudo tee /etc/dconf/db/local.d/00-martinrea-screensaver << 'EOF'

[org/gnome/desktop/screensaver]

lock-enabled=true

lock-delay=uint32 0

[org/gnome/desktop/session]

idle-delay=uint32 600

[org/gnome/settings-daemon/plugins/power]

sleep-inactive-ac-type='blank'

sleep-inactive-ac-timeout=900

EOF

74. Lock settings so users cannot change them:

sudo tee /etc/dconf/db/local.d/locks/martinrea-screensaver << 'EOF'

/org/gnome/desktop/screensaver/lock-enabled

/org/gnome/desktop/screensaver/lock-delay

/org/gnome/desktop/session/idle-delay

EOF

75. Apply dconf changes:

sudo dconf update

✅ VERIFY: Screen must lock after 10 minutes of inactivity. Users must not be able to disable this.

## **10.2 USB Storage Restrictions — Level 3 (Desktop)**

76. Disable USB storage to prevent data exfiltration — servers only:

sudo tee /etc/modprobe.d/martinrea-usb-storage.conf << 'EOF'

# Disable USB storage devices

# Remove this file to re-enable USB storage

install usb-storage /bin/true

EOF

_ℹ NOTE: For engineering workstations that legitimately need USB access, create an exception and document it. Exception requires IT Manager approval._

77. If USB storage is allowed — configure USBGuard to whitelist only approved devices:

sudo apt-get install -y usbguard

sudo usbguard generate-policy | sudo tee /etc/usbguard/rules.conf

sudo systemctl enable usbguard

sudo systemctl start usbguard

## **10.3 Disable Guest Account — Level 3 (Desktop)**

78. Disable LightDM guest session:

sudo tee /etc/lightdm/lightdm.conf.d/99-martinrea.conf << 'EOF'

[Seat:*]

allow-guest=false

greeter-hide-users=true

greeter-show-manual-login=true

EOF

79. If using GDM:

sudo tee /etc/gdm3/custom.conf << 'EOF'

[daemon]

AllowRoot=false

[security]

AllowRoot=false

EOF

## **10.4 AppArmor Enforcement — Level 3 (Desktop)**

80. Ensure AppArmor is enabled and enforcing:

sudo aa-status

sudo systemctl enable apparmor

sudo systemctl start apparmor

81. Set all profiles to enforce mode:

sudo aa-enforce /etc/apparmor.d/*

82. Verify enforcement:

sudo aa-status | grep -E 'profiles.*enforce|profiles.*complain'

✅ VERIFY: All profiles must show 'enforce' mode — not 'complain'

## **10.5 Automatic Updates for Desktop — Level 3 (Desktop)**

83. Configure GNOME Software to auto-install security updates:

sudo tee /etc/dconf/db/local.d/00-martinrea-updates << 'EOF'

[org/gnome/software]

allow-updates=true

download-updates=true

download-updates-notify=true

EOF

sudo dconf update

# **11. Service Hardening**

## **11.1 Disable Unused Services — Level 1 (All Systems)**

Disable services that are not required for the system's function. Review each before disabling — some may be needed.

| **Service** | **Default State** | **Disable If...** | **Command** |
| --- | --- | --- | --- |
| avahi-daemon | Running | mDNS not needed (most servers) | sudo systemctl disable --now avahi-daemon |
| cups | Running | No printing needed (all servers) | sudo systemctl disable --now cups |
| bluetooth | Running | No Bluetooth needed (all servers) | sudo systemctl disable --now bluetooth |
| wpa_supplicant | Running | No WiFi adapter (most servers) | sudo systemctl disable --now wpa_supplicant |
| ModemManager | Running | No cellular modem | sudo systemctl disable --now ModemManager |
| rpcbind | If installed | No NFS needed | sudo systemctl disable --now rpcbind |
| rsync | If installed | No rsync service needed | sudo systemctl disable --now rsync |

84. Run disable commands for services not needed:

# Review each service before disabling

sudo systemctl disable --now avahi-daemon 2>/dev/null || true

sudo systemctl disable --now cups 2>/dev/null || true

sudo systemctl disable --now bluetooth 2>/dev/null || true

sudo systemctl disable --now ModemManager 2>/dev/null || true

85. Verify disabled services are not running:

sudo systemctl list-units --type=service --state=running | \

grep -E 'avahi|cups|bluetooth|ModemManager'

✅ VERIFY: Disabled services must not appear in the running services list

## **11.2 Cron Job Security — Level 1 (All Systems)**

86. Restrict cron access to authorized users only:

sudo touch /etc/cron.allow

sudo chmod 600 /etc/cron.allow

# Add only authorized users who need cron

echo 'root' | sudo tee /etc/cron.allow

# Add other authorized users:

# echo 'setup' | sudo tee -a /etc/cron.allow

87. Restrict at job access:

sudo touch /etc/at.allow

sudo chmod 600 /etc/at.allow

echo 'root' | sudo tee /etc/at.allow

88. Set correct permissions on cron directories:

sudo chmod 700 /etc/cron.d /etc/cron.daily /etc/cron.hourly /etc/cron.monthly /etc/cron.weekly

sudo chmod 600 /etc/crontab

## **11.3 NTP Time Synchronization — Level 1 (All Systems)**

Correct time is critical for log integrity, audit trails, and certificate validation.

89. Verify systemd-timesyncd is running:

sudo timedatectl status

sudo systemctl status systemd-timesyncd | grep Active

90. Configure NTP servers — use Martinrea internal NTP if available:

sudo tee /etc/systemd/timesyncd.conf << 'EOF'

[Time]

# Use Martinrea internal NTP or regional pool

NTP=time.cloudflare.com pool.ntp.org

FallbackNTP=ntp.ubuntu.com

EOF

sudo systemctl restart systemd-timesyncd

sudo timedatectl timesync-status

✅ VERIFY: Time must be synchronized — timedatectl must show 'System clock synchronized: yes'

# **12. Verification and Compliance Check**

## **12.1 Run Full Security Verification — All Systems**

Run this verification script after all hardening steps are complete. Save output as evidence.

sudo tee /usr/local/bin/martinrea-security-check.sh << 'CHECKEOF'

#!/bin/bash

# Martinrea Security Hardening Verification

# WI-IT-SEC-001 v1.0

LOG=/var/log/martinrea-security-check-$(date +%Y%m%d-%H%M%S).txt

PASS=0; FAIL=0; WARN=0

check() {

local desc=$1; local cmd=$2; local expect=$3

result=$(eval "$cmd" 2>/dev/null)

if echo "$result" | grep -q "$expect"; then

echo "[PASS] $desc" | tee -a $LOG; ((PASS++))

else

echo "[FAIL] $desc — Got: $result" | tee -a $LOG; ((FAIL++))

fi

}

echo '=========================================' | tee -a $LOG

echo "Martinrea Security Check — $(date)"     | tee -a $LOG

echo "Server: $(hostname)"                    | tee -a $LOG

echo "Kernel: $(uname -r)"                   | tee -a $LOG

echo '=========================================' | tee -a $LOG

# System

check 'OS is Ubuntu 24.04'           'cat /etc/os-release'        'noble'

check 'Disk usage under 80%'         "df / | tail -1 | awk '{print \$5}'" '[0-7][0-9]%'

# User security

check 'Root account locked'          'sudo passwd -S root'        'root L'

check 'PermitRootLogin disabled'     'sudo sshd -T | grep permitrootlogin' 'no'

check 'PasswordAuthentication set'   'sudo sshd -T | grep passwordauthentication' 'auth'

# SSH

check 'SSH banner configured'        'sudo sshd -T | grep banner' 'martinrea'

check 'SSH X11 forwarding disabled'  'sudo sshd -T | grep x11forwarding' 'no'

check 'SSH MaxAuthTries <= 5'        'sudo sshd -T | grep maxauthtries' '[1-5]'

# Services

check 'SSH service running'          'systemctl is-active ssh'        'active'

check 'auditd running'               'systemctl is-active auditd'     'active'

check 'fail2ban running'             'systemctl is-active fail2ban'   'active'

check 'UFW firewall active'          'sudo ufw status'                'active'

check 'CrowdStrike running'          'systemctl is-active falcon-sensor' 'active'

check 'Avahi disabled'               'systemctl is-active avahi-daemon 2>&1' 'inactive'

# Kernel

check 'SYN cookies enabled'          'sysctl net.ipv4.tcp_syncookies'     '= 1'

check 'ASLR enabled'                 'sysctl kernel.randomize_va_space'   '= 2'

check 'IP forwarding disabled'       'sysctl net.ipv4.ip_forward'         '= 0'

check 'RP filter enabled'            'sysctl net.ipv4.conf.all.rp_filter' '= 1'

check 'Source routing disabled'      'sysctl net.ipv4.conf.all.accept_source_route' '= 0'

check 'dmesg restricted'             'sysctl kernel.dmesg_restrict'       '= 1'

# Audit

check 'Audit rules loaded'           'sudo auditctl -l | wc -l'          '[1-9]'

check 'Identity rules present'       'sudo auditctl -l'                   'identity'

check 'Login rules present'          'sudo auditctl -l'                   'logins'

echo '=========================================' | tee -a $LOG

echo "Results: PASS=$PASS  FAIL=$FAIL  WARN=$WARN" | tee -a $LOG

echo "Report saved to: $LOG"

echo '========================================='

CHECKEOF

sudo chmod +x /usr/local/bin/martinrea-security-check.sh

sudo bash /usr/local/bin/martinrea-security-check.sh

✅ VERIFY: Target: ZERO FAIL results. Address any FAIL before signing off.

## **12.2 CIS Benchmark Quick Reference**

| **CIS Control** | **WI Section** | **Level** | **Status** |
| --- | --- | --- | --- |
| 1.1 — Filesystem configuration | Sec 5 | L1/L2 | ☐ |
| 1.8 — GNOME Display Manager | Sec 10 | L1 Desktop | ☐ |
| 2.1 — inetd Services | Sec 3.3 | L1 | ☐ |
| 2.2 — Special Purpose Services | Sec 11.1 | L1 | ☐ |
| 3.1 — Network Parameters (Host) | Sec 7.3 | L1 | ☐ |
| 4.1 — Configure System Accounting (auditd) | Sec 8.1 | L2 | ☐ |
| 4.2 — Configure Logging | Sec 8.2 | L1 | ☐ |
| 5.1 — Configure cron | Sec 11.2 | L1 | ☐ |
| 5.2 — SSH Server Configuration | Sec 6.2 | L1 | ☐ |
| 5.3 — Configure PAM | Sec 4.3/4.4 | L1 | ☐ |
| 5.4 — User Accounts and Environment | Sec 4.1/4.2 | L1 | ☐ |
| 6.1 — System File Permissions | Sec 5.2/5.3 | L1 | ☐ |
| 6.2 — User and Group Settings | Sec 4 | L1 | ☐ |

# **13. Completion Checklist and Sign-Off**

## **13.1 Level 1 — Base (All Systems)**

| **#** | **Task** | **Verified** | **Notes** |
| --- | --- | --- | --- |
| 1 | Pre-hardening baseline saved | ☐ |  |
| 2 | VM/system snapshot taken | ☐ |  |
| 3 | All packages updated, kernel current | ☐ |  |
| 4 | Automatic security updates configured | ☐ |  |
| 5 | Unnecessary packages removed | ☐ |  |
| 6 | Root account locked | ☐ |  |
| 7 | Service account shells locked (/sbin/nologin) | ☐ |  |
| 8 | Password policy configured (minlen=14) | ☐ |  |
| 9 | Account lockout configured (5 attempts) | ☐ |  |
| 10 | Sudo logging enabled | ☐ |  |
| 11 | SSH banner deployed | ☐ |  |
| 12 | SSH hardening config applied (sshd -t passed) | ☐ |  |
| 13 | SSH banner verified in new terminal | ☐ |  |
| 14 | Fail2ban installed and active | ☐ |  |
| 15 | UFW firewall enabled with correct rules | ☐ |  |
| 16 | auditd installed and configured | ☐ |  |
| 17 | Log rotation configured | ☐ |  |
| 18 | CrowdStrike Falcon active with valid AID | ☐ |  |
| 19 | NTP time sync verified | ☐ |  |
| 20 | Security check script run — zero FAIL | ☐ |  |

## **13.2 Level 2 — Server Additional**

| **#** | **Task** | **Verified** | **Notes** |
| --- | --- | --- | --- |
| 1 | Desktop/GUI packages removed | ☐ |  |
| 2 | Filesystem mount options hardened | ☐ |  |
| 3 | Core dumps disabled | ☐ |  |
| 4 | SSH ciphers restricted to approved list | ☐ |  |
| 5 | Kernel sysctl hardening applied | ☐ |  |
| 6 | Unused kernel modules disabled | ☐ |  |
| 7 | GRUB password configured | ☐ |  |
| 8 | Unused services disabled (avahi, cups, bt) | ☐ |  |
| 9 | Cron access restricted to authorized users | ☐ |  |

## **13.3 Level 3 — Desktop Additional**

| **#** | **Task** | **Verified** | **Notes** |
| --- | --- | --- | --- |
| 1 | Screen lock after 10 min (dconf enforced) | ☐ |  |
| 2 | USB storage disabled or USBGuard configured | ☐ |  |
| 3 | Guest account disabled | ☐ |  |
| 4 | AppArmor enforcing all profiles | ☐ |  |
| 5 | Auto security updates via GNOME Software | ☐ |  |

## **13.4 Engineer Sign-Off**

| **Field** | **Detail** |
| --- | --- |
| System Hostname |  |
| System IP |  |
| System Role | ☐ Server  ☐ Desktop  ☐ VM  ☐ Workstation |
| Hardening Level Applied | ☐ L1 Base  ☐ L2 Server  ☐ L3 Desktop  ☐ L4 OT |
| OS Version |  |
| Kernel Version |  |
| Date Completed |  |
| Engineer Name | Yashwanta Thakur |
| Title | IT Manager / Cybersecurity & Infrastructure |
| Signature |  |
| Security Check Score | PASS: ___  FAIL: 0  (target) |
| Reviewed By |  |
| Review Date |  |

# **14. Quick Reference Card**

Cut out and keep at your workstation for quick reference during hardening sessions.

| **Action** | **Command** |
| --- | --- |
| Check open ports | sudo ss -tlnp |
| Check firewall rules | sudo ufw status numbered |
| Check running services | sudo systemctl list-units --type=service --state=running |
| Check failed logins | sudo journalctl -u ssh --since '24h ago' \| grep Failed |
| Check SSH logins by IP | sudo journalctl -u ssh --since '7 days ago' \| grep Accepted \| awk '{print $11,$9}' \| sort \| uniq -c \| sort -rn |
| Test SSH config | sudo sshd -t |
| Reload SSH safely | sudo systemctl reload ssh |
| View audit log | sudo ausearch -k identity \| tail -20 |
| Check fail2ban | sudo fail2ban-client status sshd |
| Run security check | sudo bash /usr/local/bin/martinrea-security-check.sh |
| View hardening log | cat /var/log/martinrea-hardening.log |
| Check disk space | df -h / |
| Check kernel | uname -r |
| Enable UFW | sudo ufw --force enable |
| Check CrowdStrike | sudo systemctl status falcon-sensor |
| List sudo users | grep -E 'sudo\|admin\|NOPASSWD' /etc/sudoers /etc/sudoers.d/* |
| Check password aging | sudo chage -l [USERNAME] |
| Lock a user account | sudo passwd -l [USERNAME] |
| Unlock a user account | sudo passwd -u [USERNAME] |
| View all users with shells | cat /etc/passwd \| grep -v nologin \| grep -v false |

_MARTINREA INTERNATIONAL INC. — CONFIDENTIAL — AUTHORIZED PERSONNEL ONLY_

_WI-IT-SEC-001 v1.0  |  Ubuntu Base Image Security Hardening Standard  |  IT Manager / Cybersecurity: Yashwanta Thakur  |  July 2, 2026_

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
- [[WI-IT-OT-001_FleetManager_Server_Build_Standard_v1.0|WI IT OT 001 Fleetmanager Server Build Standard V1.0]]
