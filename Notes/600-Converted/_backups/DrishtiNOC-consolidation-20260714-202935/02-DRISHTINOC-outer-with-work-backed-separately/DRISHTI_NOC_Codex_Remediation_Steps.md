---
title: "DRISHTI NOC Codex Remediation Steps"
source: "DRISHTI_NOC_Codex_Remediation_Steps.docx"
created: 2026-07-14
tags:
  - "docx"
  - "noc"
  - "documentation"
---

**DRISHTI NOC — Codex Remediation Steps**

Application Risk Assessment Remediation Guide  |  July 2026

# Overview

This document provides safe, surgical Codex prompts to remediate each finding from the DRISHTI NOC Application Risk Assessment. Each prompt is scoped to the minimum change required to address the security concern without breaking existing functionality.

Current Overall Risk Level: HIGH — Expected reduction to MEDIUM upon completion of Priority 1–4 items.

# Global Codex Safety Rules

**Append these instructions to EVERY Codex session before running any prompt below.**

• Do not modify test files.

• Do not change any function signatures or API endpoints.

• Do not alter database schema table or column names.

• Make the smallest possible change to address the security concern.

• After each change, list exactly which files were modified and what was changed.

# Remediation Steps by Priority

| **Priority** | **Finding** | **Risk** | **Codex Prompt** | **Safe Guard** |
| --- | --- | --- | --- | --- |
| **1** | **Default Privileged Credentials** | ** High ** | In the SQL migration/seed files, find any INSERT or UPDATE statement that sets a Super Admin or admin account with a hardcoded default password. Remove or comment out that statement. Replace it with a placeholder comment: `-- SECURITY: Admin account must be created manually at deployment time`. Do not remove the schema or table structure. | _Only touches SQL seed/init files, not the schema._ |
| **2** | **Default Login Shown After Deployment** | ** High ** | In the LXC/shell deployment script, find any echo or print statement that outputs a default username, email, or password after installation. Remove or replace those lines with: echo 'Installation complete. Configure admin credentials manually.' Do not change any functional installation steps. | _Only modifies echo/print output lines in the deployment script._ |
| **3** | **HTTP Deployment Defaults** | ** High ** | In the nginx configuration file(s), change the listen 80 directive to listen 443 ssl. Add stub SSL certificate directives (with a comment pointing to where real certs go). Add an HTTP-to-HTTPS redirect block on port 80. Do not change any upstream proxy_pass or application port settings. | _Does not touch application code, only nginx config._ |
| **4** | **Collector Token Handling** | ** High ** | In the Linux agent installer script, after writing the collector token to its config file, add a chmod 600 and chown root:root command on that file. Also find any logging or echo statement that outputs the token value and remove it. Do not change how the token is read or used by the agent. | _Only adds file permission commands and removes token logging. Agent functionality unchanged._ |
| **5** | **TLS Verification Bypass Option** | ** Medium to High ** | In the Linux agent installer, find any flag, variable, or condition that sets ssl_verify=false, --insecure, verify=False, or equivalent TLS bypass. Remove the option entirely, or if it is a configurable flag, change the default to true (verify enabled) and add a comment: # SECURITY: TLS verification must not be disabled in production. Do not change the rest of the connection logic. | _Only changes default value or removes the bypass flag; does not alter any other connection logic._ |
| **6** | **Database Deployment Defaults** | ** Medium to High ** | In the database connection config and migration scripts, find any hardcoded default PostgreSQL credentials (username/password) and any sslmode=disable setting. Replace the credentials with environment variable references (e.g. os.environ['DB_USER'] / os.environ['DB_PASSWORD']). Change sslmode=disable to sslmode=require. Add a .env.example file listing these variables with empty values. Do not change any query logic or ORM models. | _Only changes config values and adds an example env file; does not touch queries or models._ |
| **7** | **Build and Update Process** | ** Medium ** | In the update or deploy shell script, add a confirmation prompt before rebuilding: read -p 'Are you sure you want to redeploy? (yes/no): ' confirm && [ "$confirm" = "yes" ] \|\| exit 1. Also add a git status check at the top that exits with an error if there are uncommitted changes. Do not change the actual build or restart commands. | _Only adds a guard prompt and a git check before existing build steps._ |

# Detailed Remediation Steps

**Priority 1: ****Default Privileged Credentials**  ** High **

**Codex Prompt:**

In the SQL migration/seed files, find any INSERT or UPDATE statement that sets a Super Admin or admin account with a hardcoded default password. Remove or comment out that statement. Replace it with a placeholder comment: `-- SECURITY: Admin account must be created manually at deployment time`. Do not remove the schema or table structure.

**Safe Guard: **_Only touches SQL seed/init files, not the schema._

**Priority 2: ****Default Login Shown After Deployment**  ** High **

**Codex Prompt:**

In the LXC/shell deployment script, find any echo or print statement that outputs a default username, email, or password after installation. Remove or replace those lines with: echo 'Installation complete. Configure admin credentials manually.' Do not change any functional installation steps.

**Safe Guard: **_Only modifies echo/print output lines in the deployment script._

**Priority 3: ****HTTP Deployment Defaults**  ** High **

**Codex Prompt:**

In the nginx configuration file(s), change the listen 80 directive to listen 443 ssl. Add stub SSL certificate directives (with a comment pointing to where real certs go). Add an HTTP-to-HTTPS redirect block on port 80. Do not change any upstream proxy_pass or application port settings.

**Safe Guard: **_Does not touch application code, only nginx config._

**Priority 4: ****Collector Token Handling**  ** High **

**Codex Prompt:**

In the Linux agent installer script, after writing the collector token to its config file, add a chmod 600 and chown root:root command on that file. Also find any logging or echo statement that outputs the token value and remove it. Do not change how the token is read or used by the agent.

**Safe Guard: **_Only adds file permission commands and removes token logging. Agent functionality unchanged._

**Priority 5: ****TLS Verification Bypass Option**  ** Medium to High **

**Codex Prompt:**

In the Linux agent installer, find any flag, variable, or condition that sets ssl_verify=false, --insecure, verify=False, or equivalent TLS bypass. Remove the option entirely, or if it is a configurable flag, change the default to true (verify enabled) and add a comment: # SECURITY: TLS verification must not be disabled in production. Do not change the rest of the connection logic.

**Safe Guard: **_Only changes default value or removes the bypass flag; does not alter any other connection logic._

**Priority 6: ****Database Deployment Defaults**  ** Medium to High **

**Codex Prompt:**

In the database connection config and migration scripts, find any hardcoded default PostgreSQL credentials (username/password) and any sslmode=disable setting. Replace the credentials with environment variable references (e.g. os.environ['DB_USER'] / os.environ['DB_PASSWORD']). Change sslmode=disable to sslmode=require. Add a .env.example file listing these variables with empty values. Do not change any query logic or ORM models.

**Safe Guard: **_Only changes config values and adds an example env file; does not touch queries or models._

**Priority 7: ****Build and Update Process**  ** Medium **

**Codex Prompt:**

In the update or deploy shell script, add a confirmation prompt before rebuilding: read -p 'Are you sure you want to redeploy? (yes/no): ' confirm && [ "$confirm" = "yes" ] || exit 1. Also add a git status check at the top that exits with an error if there are uncommitted changes. Do not change the actual build or restart commands.

**Safe Guard: **_Only adds a guard prompt and a git check before existing build steps._

Document Owner: Yashwanta Thakur  |  DRISHTI NOC  |  Martinrea IT / Cyber Security

## Related Documents

- [[192.168.1.1 - wbshocket findings|192.168.1.1 Wbshocket Findings]]
- [[Drishti_Line_Side_Board_Work_Instruction|Drishti Line Side Board Work Instruction]]
- [[DRISHTI-NOC-Audit-Report|DRISHTI NOC Audit Report]]
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
