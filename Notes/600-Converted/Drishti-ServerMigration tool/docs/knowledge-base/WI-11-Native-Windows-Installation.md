---
title: "WI 11 Native Windows Installation"
source: "WI-11-Native-Windows-Installation.docx"
created: 2026-08-09
tags:
  - "docx"
  - "server"
  - "documentation"
---

**WI-11**

**Install DRISHTI HyperShift as Native Windows Services**

Podman-free lab-mode controller installation and recovery

| Release gate: UI-driven SFTP provisioning and checksum verification are implemented, but this native track is not yet approved for a real VM migration. Keep both migration mutation flags false until real-node staging, signed installer, and disposable-lab qualification are complete. |
| --- |

# Purpose and scope

Use this instruction to build, install, validate, operate, uninstall, or recover the native Windows controller. It does not require Podman, WSL2, Hyper-V, nginx, or nested virtualization. It never configures mock mode and never contacts VMware or Proxmox during installation.

# Service layout

| **Service** | **Runtime** | **Endpoint** | **Identity** |
| --- | --- | --- | --- |
| DRISHTIHyperShiftPostgres | PostgreSQL Windows | 127.0.0.1:5432 | Network Service |
| DRISHTIHyperShiftWorker | Worker + qemu-img | 127.0.0.1:8090 | Local Service |
| DRISHTIHyperShiftBackend | API/orchestrator | 127.0.0.1:8080 | Local Service |
| DRISHTIHyperShiftWeb | Static SPA/proxy | 127.0.0.1:5173 | Local Service |

# Safety controls

| **Control** | **Required behavior** |
| --- | --- |
| Runtime mode | Exactly lab; no mock fallback and no production installer option. |
| Mutation gates | Both migration flags are false by default. UI SFTP provisioning uses a separate lab-only flag, explicit checkbox, platform_admin authorization, and mandatory denylist; it never unlocks migration. |
| Source protection | Never delete or unregister a source VM; cold migration requires powered-off confirmation/approval. |
| Workspace | Dedicated folder, never a drive root, at least 200 GiB free. |
| Secrets | Password plaintext stays in memory/pipes; hashes and secrets are ACL-protected and never logged. |
| Worker commands | Only fixed allowlisted binaries with validated argument arrays; no shell command assembly. |

# Part A - Build the release payload

## Step 1 - Approve third-party inputs

From an Administrator PowerShell prompt on the controlled release workstation, run the standalone fetcher. It discovers and validates the official PostgreSQL 16 Windows x86-64 ZIP, installs or reuses MSYS2 QEMU, resolves the qemu-img.exe DLL closure transitively, and creates evidence under artifacts\release-inputs.

```
Set-Location 'C:\DRISHTI\Drishti-ServerMigration tool\packaging\windows\native'
.\fetch-build-inputs.ps1
```

Confirm the output says HUMAN REVIEW REQUIRED. Review the PostgreSQL source and version, QEMU package versions, THIRD-PARTY-MANIFEST.json, MSYS2 repository timestamp/hash, archive paths, and SHA-256 values. The fetcher must stop without starting build-native.ps1.

A reviewer independent of acquisition must approve both hashes. Do not bypass an evidence mismatch or use a .partial archive. Only approved hashes may proceed to Step 4.

## Step 2 - Prepare the release workstation

Install Go 1.25 or newer, Node.js 20 or newer, npm, WiX Toolset v5, and Inno Setup 6. For race detection, install MSYS2 with mingw-w64-ucrt-x86_64-gcc. Protect the Authenticode private key separately from the source tree and build output.

## Step 3 - Qualify the Windows race detector

Use process-local PATH, CGO_ENABLED, CC, and CXX values. Require MinGW-w64 libsynchronization.a, binutils 2.37 or newer, windows/amd64 CGO, and passing backend and worker race suites. Bare cl.exe or clang-cl is not the approved toolchain.

```
$env:Path='C:\msys64\ucrt64\bin;'+$env:Path; $env:CGO_ENABLED='1'; $env:CC='gcc'; $env:CXX='g++'
$syncLib=gcc --print-file-name libsynchronization.a; Test-Path -LiteralPath $syncLib
Push-Location backend; try { go test -race -count=1 ./... } finally { Pop-Location }
Push-Location worker; try { go test -race -count=1 ./... } finally { Pop-Location }
```

## Step 4 - Run the native build

Run packaging\windows\native\build-native.ps1 with version 0.2.0 and the exact archive paths and independently approved hashes printed by fetch-build-inputs.ps1. The build script re-verifies both hashes, builds stripped Windows binaries, builds the Vite production frontend and staged manifest, and compiles MSI/EXE packages when WiX and Inno Setup are available.

```
.\build-native.ps1 -Version 0.2.0 `
  -PostgreSQLZip <printed-postgresql-archive> `
  -PostgreSQLSHA256 <approved-postgresql-sha256> `
  -QEMUZip <printed-qemu-archive> `
  -QEMUSHA256 <approved-qemu-sha256>
```

## Step 5 - Sign and verify

Sign every shipped EXE and the compiled MSI/installer EXE with Authenticode. Recompute SHA-256 values after signing, publish the signed manifest, and test signature validation on a clean disposable Windows VM.

# Part B - Install on a disposable Windows 11 controller

## Step 1 - Confirm the controller

Use a dedicated Windows 11 x64 VM with at least four logical processors and 8 GiB RAM. The controller must not be any VM selected for migration.

## Step 2 - Confirm the workspace

Choose a dedicated folder with at least 200 GiB free. The installer rejects a drive root and protects the workspace ACL for the worker service identity.

## Step 3 - Run as Administrator

Run the signed EXE or MSI workflow as Administrator. The configuration stage validates payload completeness and collects the workspace and initial administrator password. Never enter a platform credential during installation.

## Step 4 - Keep mutation disabled

Do not enable either migration mutation switch during initial installation. The runtime must report DRISHTI_MODE=lab, DRISHTI_ENABLE_LAB_MIGRATION=false, DRISHTI_ENABLE_PLATFORM_MUTATION=false, and DRISHTI_ENABLE_SFTP_PROVISIONING=false.

## Step 5 - Verify local services

Run Manage-Native.ps1 Status and Test. All four services must be Running and all three HTTP health checks must return 200 before any platform connection is created.

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:ProgramFiles\DRISHTI\HyperShift\installer\Manage-Native.ps1" Status
```

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:ProgramFiles\DRISHTI\HyperShift\installer\Manage-Native.ps1" Test
```

# Part C - Qualification before real lab mutation

## Step 1 - Enable only the provisioning interlock

Set DRISHTI_ENABLE_SFTP_PROVISIONING=true only in lab mode and provide a non-empty mutation denylist containing every protected endpoint. Keep DRISHTI_ENABLE_LAB_MIGRATION=false and DRISHTI_ENABLE_PLATFORM_MUTATION=false; staging setup does not unlock migration execution.

## Step 2 - Provision from Add Target

As platform_admin, open Add Target, choose direct root@pam credentials, and explicitly select Provision hardened SFTP staging. Enter the exact node SSH host/port, independently verified Ed25519 host-key SHA-256 fingerprint, controller /32 or /128, dedicated staging port, staging account, and normalized chroot. The Test button remains read-only.

```
DRISHTI_ENABLE_SFTP_PROVISIONING=true
DRISHTI_MUTATION_DENYLIST=<all-protected-endpoints>
DRISHTI_ENABLE_LAB_MIGRATION=false
DRISHTI_ENABLE_PLATFORM_MUTATION=false
```

Provisioning must fail closed unless cluster and node firewalls are already enabled, every CIDR/path/user/port is safe, the administrative SSH host key matches its pin, named firewall rules are absent or exactly matching, the allow rule precedes the deny rule, sshd validation passes, and the dedicated service becomes active.

## Step 3 - Verify evidence and audit

Confirm the target card reports SFTP staging provisioned with the verified node, staging address, host import root, and controller firewall source. Confirm audit contains connection.sftp_provision with the acting administrator and no password, private key, or hash material. The generated private key remains process-local; re-add and re-provision after restart.

## Step 4 - Verify staging without enabling migration

Keep DRISHTI_ENABLE_LAB_MIGRATION=false and DRISHTI_ENABLE_PLATFORM_MUTATION=false. Verify host-key mismatch, wrong-node selection, unsafe paths/symlinks, interrupted .partial upload, and checksum corruption all fail closed. Record the unit/in-process test output and the separate disposable-node test evidence.

## Step 5 - Apply the orphan retention policy

A .partial file is orphaned only when its durable job is failed, cancelled, or absent; no matching retry is active; and its modification time is at least 24 hours old. Final staged images are retained at least seven days after terminal job state and longer during an incident, validation hold, or rollback investigation.

Cleanup is never automatic and never part of import or startup. Only a platform_admin may approve it. The operation must enumerate exact non-symlink paths beneath the staging root and audit actor, job/idempotency identity, exact path, size/digest when available, reason, timestamp, and result. Until the audited cleanup operation is implemented, use a manual change-controlled Proxmox procedure and retain the same evidence. Never recursively delete the staging root.

| Implemented staging control: TargetAdapter.AttachDisk hashes the Windows conversion output, pushes it through typed SFTP into a content-bound .partial path, verifies the bytes exposed by the Proxmox node, atomically publishes the file, and only then submits the node-local POSIX path for import. No shell/scp/rsync path exists. |
| --- |

| **Gate** | **Pass evidence** |
| --- | --- |
| Signed packages | MSI and EXE signatures and published hashes validate. |
| Clean install | No Podman/WSL2 present; install, reboot, repair, and uninstall tests pass. |
| PostgreSQL | Backup/restore and service-account ACL tests pass. |
| SFTP endpoint | Add Target verifies ChrootDirectory, ForceCommand internal-sftp, Ed25519 key only, pinned admin host key, dedicated port, and controller-only allow-before-deny firewall rules. |
| Transfer integrity | Local worker digest, remote size/SHA-256, atomic publication, and corruption refusal pass. |
| Safety | Denylist, isolated bridge, powered-off VM, plan approval, and power-off approval recorded. |

# Part D - Uninstall

The uninstaller stops and deletes only the four named services and removes application binaries. Configuration, secrets, PostgreSQL data, logs, and workspace are preserved by default. Database, configuration, and workspace removal require explicit switches. Workspace deletion additionally requires the recorded exact path and marker.

| **Prohibited: **Do not use broad service deletion, podman system reset, wildcard filesystem deletion, or an unverified workspace path. |
| --- |

# Part E - WinPE controller recovery

Build-WinPE.ps1 requires the Windows ADK and WinPE add-on. It injects operator-approved storage/network drivers, the validated native payload, and a conservative repair script into a recovery ISO. The recovery tool inventories and backs up the controller; it never contacts VMware/Proxmox and does not automatically mutate an offline database or service configuration.

Writing the ISO to USB is intentionally separate because selecting the wrong disk is destructive. Verify the USB disk identity in an approved imaging workflow before writing.

# Acceptance record

| **Check** | **Result / evidence** |
| --- | --- |
| Native Windows cross-build | Record build ID and hashes |
| Backend/worker tests and vet | Record command output |
| Frontend typecheck/build | Record command output |
| MSI clean-VM test | Pending until compiled/signed |
| EXE clean-VM test | Pending until compiled/signed |
| SFTP staging implementation | Unit and mocked-SSH provisioning tests pass; record disposable-node qualification separately. |
| Operator approval | Name, date, disposable VM ID |
| Windows race detector | Record compiler/runtime probes and backend/worker go test -race output |

# References

SECURITY.md; docs/release-readiness-verdict.md; docs/knowledge-base/11-native-windows-installation.md; packaging/windows/native/README.md.

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
- [[WI-IT-OT-001_FleetManager_Server_Build_Standard_v1.0|WI IT OT 001 Fleetmanager Server Build Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
