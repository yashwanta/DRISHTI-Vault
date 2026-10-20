---
title: "WI 10 Windows Installer Workspace Capacity"
source: "WI-10-Windows-Installer-Workspace-Capacity.docx"
created: 2026-08-09
tags:
  - "docx"
  - "server"
  - "documentation"
---

**WORK INSTRUCTION**

**Resolve the Windows Installer Workspace Capacity Check**

Safely correct the 199 GB versus 200 GB precheck without weakening the migration workspace safeguard

| **Document ID** | WI-10 | Version 1.0 |
| --- | --- | --- |
| **Effective date** | August 8, 2026 | Owner: DRISHTI HyperShift Operations |

| **Decision: **Keep the 200 GB minimum. Prefer 220-250 GB free so Podman builds and migration staging have operating headroom. |
| --- |

# Trigger and cause

Use this instruction when Install-HyperShift.ps1 reports that the workspace drive has 199 GB free and requires at least 200 GB. The installer rounds available bytes down to a whole GiB. Therefore, 199.9 GB is reported as 199 and fails closed before deployment continues.

| $freeGB = [math]::Floor($workspaceDrive.AvailableFreeSpace / 1GB) if ($freeGB -lt 200) { throw 'Workspace capacity check failed' } |
| --- |

# Step 1 - Measure the exact installer value

Open PowerShell as Administrator and run:

| $drive = [IO.DriveInfo]::new('E:\') [math]::Floor($drive.AvailableFreeSpace / 1GB) |
| --- |

Do not retry until the / 1GB result is 200 or greater. A result of 220 or more is preferred. Do not divide by 2GB when reproducing the installer check: 99 only counts complete two-gigabyte blocks and is not the value HyperShift evaluates. Use [math]::Round($drive.AvailableFreeSpace / 1GB, 2) to display the unrounded value.

If the diagnostic unexpectedly returns 0, recreate the DriveInfo object in the current PowerShell session and confirm E: is accessible: Test-Path 'E:\'; $freeBytes = ([IO.DriveInfo]::new('E:\')).AvailableFreeSpace. A False path result or zero byte count means the drive is unavailable; stop and correct that before installation.

## PowerShell profile warning

A warning that Microsoft.PowerShell_profile.ps1 cannot be loaded because running scripts is disabled concerns the optional user profile and does not invalidate the capacity result. The packaged Setup.cmd uses powershell.exe -NoProfile -ExecutionPolicy Bypass -File Install-HyperShift.ps1. This avoids loading the profile and limits the bypass to the installer process. Do not change the computer-wide execution policy; run Setup.cmd as administrator.

## Password validation failure and safe retry

The initial administrator password must contain 12-72 UTF-8 bytes. Use a unique password of at least 16 ASCII characters from a password manager or approved passphrase process, and enter it only in the two masked installer prompts. Never record a plaintext password in commands, logs, documentation, tickets, or chat. If it was disclosed outside the prompt, treat it as compromised and do not reuse it.

This failure occurs after application files and the installation marker are created but before the auth file, database, or HyperShift pod. Run the included uninstaller from Administrator PowerShell with: powershell.exe -NoProfile -ExecutionPolicy Bypass -File $env:ProgramData\DRISHTI\HyperShift\Uninstall-HyperShift.ps1 -RemoveConfiguration. Confirm removal; do not add -PurgeDatabase. The workspace is preserved. Then rerun the installer with the documented E:\DrishtiImport path and the controlled 199-GiB pilot threshold.

### If the uninstaller reports no HyperShift pod

The pilot uninstaller currently tries to stop the pod before confirming it exists. A password-stage failure has no pod, so the uninstaller can stop before cleanup. Verify that $env:ProgramData\DRISHTI\HyperShift\.hypershift-pilot-install contains exactly DRISHTI HyperShift pilot installation, list pod names with podman pod ps --format {{.Name}} and verify hypershift is absent, and then remove only $env:ProgramData\DRISHTI\HyperShift with Remove-Item -LiteralPath -Recurse -Force. Confirm Test-Path returns False. This preserves E:\DrishtiImport and Podman images. The removed partial application directory is not recoverable, but no completed auth file or database exists at this failure point.

### PipelineVariable error after password confirmation

This error means the password was accepted and hashed; it is unrelated to password complexity. In version 0.1.0-pilot, Podman's -p option collided with PowerShell's -PipelineVariable common parameter inside an advanced wrapper. The same design could affect -d, -e, and -v. Do not retry that package.

Run the marker-verified partial cleanup, then use DRISHTI-HyperShift-Windows-0.1.1-pilot.zip with SHA256 1edb4b5b2dc6b9b1b2317ab5862895fe4588589e2c32b11ba1a6c12bfe9e64b3. The corrected wrapper preserves Podman short flags exactly, and the corrected uninstaller handles a missing pod. At this failure point the partial directory contains only a bcrypt hash and generated database password, never plaintext; the empty PostgreSQL volume can be reused.

### Copy and extract the corrected package

PATH-TO-EXTRACTED-0.1.1-PILOT is an example placeholder, not a literal folder. The package initially exists on the computer running Codex at C:\DRISHTI\Drishti-ServerMigration tool\artifacts\DRISHTI-HyperShift-Windows-0.1.1-pilot.zip; that path does not automatically exist inside a separate Windows controller VM. Transfer the ZIP to the VM by an approved method such as an RDP redirected drive, RDP clipboard file copy, or an authorized shared folder. Do not transfer passwords or credentials with it. Copy the ZIP into the signed-in VM user's Downloads folder. Set $zip = Join-Path $env:USERPROFILE 'Downloads\DRISHTI-HyperShift-Windows-0.1.1-pilot.zip' and $dest = Join-Path $env:USERPROFILE 'Downloads\DRISHTI-HyperShift-Windows-0.1.1-pilot'. Confirm Test-Path -LiteralPath $zip returns True.

Verify (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() equals 1edb4b5b2dc6b9b1b2317ab5862895fe4588589e2c32b11ba1a6c12bfe9e64b3. If $dest exists, inspect it and choose a different empty destination instead of deleting it blindly. Otherwise run Expand-Archive -LiteralPath $zip -DestinationPath $dest.

Set $installer = Join-Path $dest 'Install-HyperShift.ps1' and confirm Test-Path -LiteralPath $installer returns True. Run powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -WorkspacePath E:\DrishtiImport -MinimumWorkspaceFreeGB 199. Enter the administrator password only at the two masked prompts; never place it in command history, chat, logs, or documentation. If dir in the extracted VM folder lists Install-HyperShift.ps1, Setup.cmd, Uninstall-HyperShift.ps1, and payload, the transfer and extraction are complete. The development computer's C:\DRISHTI\...\artifacts folder is not supposed to appear inside the VM; do not copy the package again.

### PowerShell treats -WorkspacePath as the script file

If PowerShell reports Processing -File '-WorkspacePath' failed, the variable passed after -File was empty or undefined in the current session. Variables created in another PowerShell window or an earlier session do not carry over.

From any Administrator PowerShell location, first run Test-Path 'C:\Users\thakury\Downloads\DRISHTI-HyperShift-Windows-0.1.1-pilot\Install-HyperShift.ps1'. Continue only when it returns True. Then run powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\thakury\Downloads\DRISHTI-HyperShift-Windows-0.1.1-pilot\Install-HyperShift.ps1' -WorkspacePath 'E:\DrishtiImport' -MinimumWorkspaceFreeGB 199.

### Podman cannot find /mnt/e/DrishtiImport

If image builds and password generation succeed but worker creation reports statfs /mnt/e/DrishtiImport: no such file or directory, Windows can see the workspace but Podman's Linux machine cannot resolve the translated E: bind-mount path. The protected configuration, hypershift pod, and PostgreSQL container may already exist; the worker, backend, and frontend are not fully installed.

Do not rerun the installer, remove the pod, purge the database volume, or mount the drive manually until the partial state and Podman provider are confirmed. From Administrator PowerShell run: Get-Item -LiteralPath 'E:\DrishtiImport'; podman machine list; wsl.exe -l -v; podman pod ps; and podman ps -a --pod.

If podman machine ssh returns no visible output, record $LASTEXITCODE and query the WSL distribution directly with: wsl.exe -d podman-machine-default -- ls -ld /mnt; wsl.exe -d podman-machine-default -- ls -ld /mnt/e; wsl.exe -d podman-machine-default -- ls -ld /mnt/e/DrishtiImport; wsl.exe -d podman-machine-default -- cat /etc/wsl.conf; and wsl.exe -d podman-machine-default -- mount. These checks are read-only.

A partial state containing only the hypershift infrastructure container and hs-postgres is consistent with worker-creation failure; preserve it until drive visibility is diagnosed. An existing Podman machine with 2 CPUs and 2 GiB RAM is below the pilot installer's intended 4 CPUs and 8 GiB. Do not resize or restart it until the partial-state evidence has been captured.

When direct WSL checks show E: mounted on /mnt/e as writable 9p and /mnt/e/DrishtiImport exists, do not add another manual mount. The earlier failure may have occurred before WSL exposed the drive to the running Podman service.

Create a unique probe name and run the already-built worker image with the exact E:\DrishtiImport:/mnt/drishti-import:rw bind mount. As the worker's non-root user, write a small uniquely named file, confirm it is non-empty, remove it, and print BIND_MOUNT_RW_OK. Then use Windows Test-Path to confirm the probe file is absent.

Success is BIND_MOUNT_RW_OK followed by False. The probe contacts no VMware or Proxmox endpoint. If either result differs, preserve the output and stop before cleanup, Podman resize, or installer retry.

If WSL lists the workspace but the bind probe still returns statfs /mnt/e/DrishtiImport: no such file or directory, the Podman service is not seeing the same drive mount as the interactive WSL session.

After recording the partial state, run podman machine stop podman-machine-default followed by podman machine start podman-machine-default. Stop if either command fails.

For the WSL provider, podman machine set --cpus 4 --memory 8192 can report changing CPUs not supported for WSL machines. This does not damage the machine, but it does not provide a verified resource change; do not repeat it. Confirm post-restart values with podman machine list. Inspect any existing Windows .wslconfig before handling the intended 4-CPU/8-GiB allocation separately, and only after the bind mount succeeds.

The controlled restart stops runtime processes temporarily but does not delete the pod, named PostgreSQL volume, protected configuration, or E:\DrishtiImport. Verify the machine resources, WSL workspace path, and pod state, then repeat the unique bind probe. Do not clean or retry installation until it returns BIND_MOUNT_RW_OK followed by False.

When the post-restart probe returns BIND_MOUNT_RW_OK and Windows returns False, the bind-mount recovery is verified. Keep the partial pod stopped while checking Windows controller CPU/RAM capacity and whether .wslconfig already exists.

Use Get-CimInstance Win32_ComputerSystem and Win32_OperatingSystem to record logical processors, total physical memory, and available physical memory. Set $wslConfig = Join-Path $env:USERPROFILE '.wslconfig'; run Test-Path; and read it only when it exists.

Do not create or overwrite .wslconfig until controller capacity and existing settings have been reviewed. Do not start the exited partial pod or rerun the installer during this check.

On a controller with 4 logical processors, 16 GiB total RAM, and no existing .wslconfig, verify effective distribution resources with wsl.exe -d podman-machine-default -- nproc and wsl.exe -d podman-machine-default -- free -h before creating a global WSL configuration.

Use effective WSL values as the decision point because podman machine list may show metadata that differs from the resources exposed by the WSL kernel. If WSL reports 4 processors and approximately 7-8 GiB RAM, do not create .wslconfig; proceed to controlled partial-install cleanup. Otherwise stop for a reviewed WSL configuration change.

### Confirmed WSL resource result

The verified Windows pilot controller exposes 4 processors, 7.8 GiB total WSL memory (7.2 GiB available), and 2.0 GiB swap. No Windows .wslconfig exists. These effective WSL values are sufficient; do not create .wslconfig or use the lower metadata shown by podman machine list as the resource decision point.

Because the failed installation initialized PostgreSQL but never reached the backend, remove only the hypershift pod, hypershift-postgres-data volume, and marker-verified ProgramData installation directory before retrying. This prevents a newly generated database password from being paired with the old partial volume. Perform this cleanup only after confirming the failed install contains no application data.

From Administrator PowerShell run: podman pod rm --force hypershift; podman volume rm hypershift-postgres-data. Then set $installRoot to $env:ProgramData\DRISHTI\HyperShift, verify that .hypershift-pilot-install contains exactly 'DRISHTI HyperShift pilot installation', and remove only $installRoot recursively.

Confirm that the hypershift pod, hypershift-postgres-data volume, and ProgramData installation root no longer exist, while E:\DrishtiImport still exists. Do not run podman system reset, do not delete the workspace, and do not remove unrelated pods, volumes, or images.

Record the exact Podman machine name, then run podman machine ssh <machine-name> 'ls -ld /mnt /mnt/e /mnt/e/DrishtiImport'. If /mnt/e is absent, stop and resolve Podman/WSL drive exposure before recovery. Do not redirect the migration workspace into the Podman machine's small internal disk; retain the verified capacity on E:.

# Step 2 - Provide safe capacity

## Option A - Free space

Move or remove only confirmed-unneeded files from E:. Empty the Recycle Bin when appropriate, then repeat the exact measurement. Although roughly 1 GB may cross the threshold, 20 GB or more of additional free space is safer.

## Option B - Expand the VMware virtual disk

## Do not shrink C: for this disk layout

For the observed EFI | C: | E: | Recovery layout, cancel the Shrink C: dialog. Shrinking C: creates unallocated space to the left of E:, which Windows Disk Management cannot use to extend E:. Expanding Disk 0 would place new space after the Recovery partition, also not directly adjacent to E:. Do not move or delete the Recovery partition merely to satisfy this check.

## Controlled pilot exception

For this verified dedicated nominal-200-GB volume with 199.90 GiB free, use the current pilot's one-GiB filesystem-overhead allowance by running: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-HyperShift.ps1 -WorkspacePath E:\DrishtiImport -MinimumWorkspaceFreeGB 199. Do not use a lower value or apply this exception to a partially full drive. A new dedicated 220-GB-or-larger virtual disk remains the preferred expansion path.

Use Windows Disk Management to identify the virtual disk containing E:. Shut down the HyperShift controller VM, increase that disk by 20-50 GB or more in vCenter or ESXi, restart Windows, open diskmgmt.msc as administrator, and extend E: into the new unallocated space.

| **Safety: **Confirm you are editing the Windows HyperShift controller, not a production VM or a VM selected for migration. |
| --- |

# Step 3 - Retry installation

When the exact measurement returns at least 200, right-click Setup.cmd, choose Run as administrator, and enter E:\DrishtiImport. An empty directory left by the failed precheck is safe to reuse. Inspect any unexpected contents before retrying.

# Acceptance record

| **Check** | **Acceptance criterion** | **Result** |
| --- | --- | --- |
| **Exact PowerShell measurement** | 200 or greater; 220+ preferred | Pass / Fail |
| **Workspace path** | E:\DrishtiImport, not the E: drive root | Pass / Fail |
| **Controller isolation** | Controller VM is not a migration source | Pass / Fail |
| **Podman state** | Podman machine is running | Pass / Fail |
| **Installer launch** | Setup.cmd run as administrator | Pass / Fail |

# Prohibited workaround

Do not lower MinimumWorkspaceFreeGB merely to make installation proceed. An 80 GB source disk can require both downloaded VMDK and converted-image capacity, plus PostgreSQL, container images, logs, and retry overhead. A bypass can turn a clear precheck failure into a mid-conversion failure.

# Reference

Companion knowledge-base article: 10-windows-installer-workspace-capacity.md

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
- [[WI-11-Native-Windows-Installation|WI 11 Native Windows Installation]]
- [[WI-IT-OT-001_FleetManager_Server_Build_Standard_v1.0|WI IT OT 001 Fleetmanager Server Build Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
