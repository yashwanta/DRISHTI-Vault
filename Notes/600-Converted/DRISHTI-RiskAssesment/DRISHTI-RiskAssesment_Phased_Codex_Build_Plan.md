---
title: "DRISHTI Riskassesment Phased Codex Build Plan"
source: "DRISHTI-RiskAssesment_Phased_Codex_Build_Plan.docx"
created: 2026-07-15
tags:
  - "docx"
  - "security"
  - "project"
  - "documentation"
---

**DRISHTI**

**Risk Assessment Platform**

**Phased Codex Build Plan**

**Standalone repository:  DRISHTI-RiskAssesment**

Purpose: Build a separate vulnerability and cyber-risk management application that imports scanner results, calculates business risk, tracks remediation, and produces executive and technical reports.

Build one phase at a time. Test it. Commit it. Then move forward.

**Prepared for Yash Thakur**

Version 1.0 | July 2026

# Document purpose and build rules

**This document is a step-by-step implementation plan for a new standalone application. It is not a module inside Drishti NOC and must not modify the Drishti NOC repository, database, services, or deployment.**

- Use the exact repository and project name `DRISHTI-RiskAssesment` unless the owner later approves a rename.

- Recommended Windows development path: `C:\DRISHTI\DRISHTI-RiskAssesment`.

- Recommended Linux production path: `/opt/drishti-riskassessment`.

- Every phase must be completed in a separate Git branch and merged only after acceptance testing.

- Codex must inspect the current repository before changing files and must preserve all working features.

- No active vulnerability scan may run against production, OT, AMR, network, or third-party systems without explicit authorization and an approved scope.

- Never store scanner, domain, database, or API credentials in source code, configuration committed to Git, logs, screenshots, or generated reports.

- Do not proceed to the next phase when tests fail, migrations are incomplete, rollback is missing, or acceptance criteria are not met.

Important: The application manages highly sensitive vulnerability evidence. Treat the platform itself as a Tier-1 security system.

# Contents

1. Target product and design principles

2. Recommended technology stack

3. High-level architecture

4. Repository structure

5. Global data model

6. Severity and business-risk methodology

7. Branch, commit, test, and handoff process

8. Master Codex instruction

9. Phase 0 - Repository bootstrap and engineering controls

10. Phase 1 - Authentication, users, plants, and RBAC

11. Phase 2 - Asset inventory and ownership

12. Phase 3 - Core finding model and manual assessment

13. Phase 4 - Import framework and Trivy connector

14. Phase 5 - Risk scoring and prioritization engine

15. Phase 6 - Dashboards, search, and technical finding views

16. Phase 7 - Remediation workflow, SLA, and exceptions

17. Phase 8 - Nuclei, OWASP ZAP, and Greenbone connectors

18. Phase 9 - CISA KEV and EPSS threat enrichment

19. Phase 10 - Control questionnaires and assessment campaigns

20. Phase 11 - Reports and exports

21. Phase 12 - Security hardening, audit, and secrets

22. Phase 13 - Testing, performance, accessibility, and quality

23. Phase 14 - Deployment, backup, restore, and operations

24. Phase 15 - Production pilot and final acceptance

25. Definition of done and future roadmap

# 1. Target product and design principles

DRISHTI-RiskAssesment will be a centralized vulnerability and cyber-risk management platform. It will not replace established scanners. It will collect results from approved tools, normalize and deduplicate findings, add business context, track remediation, preserve evidence, and report risk by plant, owner, asset, and application.

**Standalone by design: **Separate repository, services, database, authentication configuration, deployment, and release lifecycle.

**Scanner-agnostic: **Use adapters so additional scanners can be integrated without changing the core finding model.

**Technical severity is not business risk: **Preserve original scanner severity and calculate a separate explainable business-risk score.

**Evidence first: **Every finding must retain source, affected location, proof, import history, and status history.

**Safe for manufacturing: **Default to passive/import-only behavior. Production, OT, AMR, and network scans require explicit authorization.

**Audit-ready: **Changes to status, ownership, due dates, exceptions, risk, and approvals must be immutable and attributable.

**Phased delivery: **Each phase must create a usable, testable increment and include rollback instructions.

# 2. Recommended technology stack

| **Layer** | **Recommended choice** | **Reason** |
| --- | --- | --- |
| Frontend | React + TypeScript | Strong component model, filtering, dashboards, and maintainable UI. |
| Backend API | Go | Single deployable binary, predictable performance, strong typing, and good operational fit. |
| Database | PostgreSQL | Relational integrity, JSON support, reporting, transactions, and mature backup tooling. |
| Background work | Separate Go worker using PostgreSQL-backed jobs | Avoids adding Redis during the MVP while preserving asynchronous imports and reports. |
| Reverse proxy | Nginx | TLS termination, security headers, rate limiting, and routing. |
| Authentication | Local bootstrap admin, then OIDC/Active Directory-ready | Allows initial setup without blocking enterprise identity integration. |
| Evidence storage | Local encrypted volume for MVP; S3-compatible option later | Separates large evidence files from database records. |
| Packaging | Docker Compose for development; systemd or containers for production | Repeatable builds and flexible operations. |
| Testing | Go tests, frontend tests, Playwright, and integration tests | Covers logic, API behavior, UI flows, and regressions. |

# 3. High-level architecture

| **Users and assessors** |
| --- |
| **React web application** |
| **Nginx / TLS / security headers / rate limits** |
| **Go API service  +  Go worker service** |
| **PostgreSQL  +  encrypted evidence storage** |
| **Scanner adapters: Trivy \| Nuclei \| ZAP \| Greenbone \| Manual** |
| **Authorized assets, repositories, images, applications, and imported reports** |

# 4. Repository structure

**Target repository layout**

| DRISHTI-RiskAssesment/ ├── README.md ├── SECURITY.md ├── LICENSE ├── CHANGELOG.md ├── .env.example ├── docker-compose.yml ├── Makefile ├── docs/ │   ├── architecture/ │   ├── deployment/ │   ├── operations/ │   ├── security/ │   └── api/ ├── backend/ │   ├── cmd/api/ │   ├── cmd/worker/ │   ├── internal/auth/ │   ├── internal/assets/ │   ├── internal/findings/ │   ├── internal/imports/ │   ├── internal/risk/ │   ├── internal/reports/ │   ├── internal/audit/ │   ├── internal/storage/ │   └── migrations/ ├── frontend/ │   ├── src/components/ │   ├── src/features/ │   ├── src/pages/ │   ├── src/services/ │   └── src/types/ ├── scanner-connectors/ │   ├── trivy/ │   ├── nuclei/ │   ├── zap/ │   └── greenbone/ ├── testdata/ │   ├── trivy/ │   ├── nuclei/ │   ├── zap/ │   └── greenbone/ ├── scripts/ ├── deploy/ │   ├── nginx/ │   ├── systemd/ │   └── backup/ └── tests/ |
| --- |

# 5. Global data model

| **Domain** | **Primary tables** |
| --- | --- |
| Identity and scope | users, roles, permissions, user_roles, plants, user_plant_access |
| Assets | assets, asset_groups, asset_group_members, asset_owners, asset_tags, asset_services |
| Scans and imports | scanner_types, scanner_connections, scan_profiles, scan_jobs, scan_targets, import_batches, raw_scan_results |
| Findings | findings, finding_instances, finding_assets, finding_evidence, finding_references, finding_comments |
| Risk and intelligence | risk_calculations, risk_factors, cve_intelligence, exploit_intelligence, control_adjustments |
| Remediation | remediation_tasks, status_history, assignments, due_date_changes, exceptions, risk_acceptances, retests |
| Assessments | control_frameworks, controls, questionnaires, campaigns, responses, assessment_evidence |
| Reporting and audit | reports, report_jobs, notifications, audit_events, system_settings, job_queue |

# 6. Severity and business-risk methodology

The platform must show two ratings side by side. The technical severity remains the scanner or CVSS classification. The business-risk rating is calculated from organizational context and must always show the factors that affected the result.

| **CVSS score** | **Technical severity** | **Default remediation target** |
| --- | --- | --- |
| 9.0-10.0 | Critical | 24 hours to 3 days, depending on exposure |
| 7.0-8.9 | High | 14 days |
| 4.0-6.9 | Medium | 30 days |
| 0.1-3.9 | Low | 90 days |
| 0.0 | Informational | Track as needed |

**Default business-risk formula**

| raw_score = 100 × (   0.35 × technical_severity_normalized + 0.20 × asset_criticality_normalized + 0.15 × network_exposure_normalized + 0.15 × exploit_intelligence_normalized + 0.15 × business_impact_normalized )  final_score = raw_score × approved_control_reduction_factor |
| --- |

- Critical business risk: 85-100

- High business risk: 70-84

- Medium business risk: 40-69

- Low business risk: 1-39

- Compensating controls may lower business risk only after evidence and approval; they never change the original technical severity.

- CISA KEV plus internet exposure or mission-critical production impact must force Critical business risk.

# 7. Branch, commit, test, and handoff process

- Create a phase branch, for example `phase/04-trivy-import`.

- Ask Codex to inspect the repository and provide a change plan before editing.

- Have Codex implement only the current phase scope.

- Run formatting, linting, unit tests, integration tests, and database migration checks.

- Start the application and manually execute the acceptance checklist.

- Require Codex to produce a changed-files summary, test results, security notes, migration notes, and rollback instructions.

- Commit with a meaningful message, tag stable milestones, and merge only after review.

- Create a database backup before every migration in shared or production environments.

# 8. Master Codex instruction

**Copy into Codex**

| You are working on a new standalone project named DRISHTI-RiskAssesment.  Repository location on Windows: C:\DRISHTI\DRISHTI-RiskAssesment  This project is separate from Drishti NOC. Do not edit, import, move, merge, or depend on the Drishti NOC repository unless I explicitly approve an integration later.  Before changing code: 1. Inspect the repository, README, architecture documents, current branch, migrations, configuration, tests, and open TODOs. 2. Summarize the current state and identify any conflict with the requested phase. 3. Produce a concise implementation plan and list the files you expect to create or modify.  Engineering rules: - Implement only the requested phase. - Preserve all working features. - Use secure defaults and least privilege. - Never hard-code credentials, tokens, passwords, encryption keys, or connection strings. - Add .env.example entries with safe placeholder values. - Validate all input and use parameterized database queries. - Record security-sensitive changes in an immutable audit log. - Do not run active scans against any target. - Use sample scanner files in testdata for development and tests. - Add or update tests for every behavior changed. - Add database migrations with reversible down migrations or documented rollback steps. - Update README, API documentation, architecture notes, and CHANGELOG. - Run formatting, linting, unit tests, integration tests, frontend tests, and build checks.  At the end, provide: - Summary of completed work - Files created and modified - Database migrations - Commands to build, run, and test - Test results - Security review notes - Known limitations - Rollback instructions - Acceptance checklist status  Stop after this phase. Do not begin the next phase. |
| --- |

# Phase 0: Repository bootstrap and engineering controls

**Objective. **Create a clean, reproducible standalone repository and establish the engineering guardrails that every later phase will follow.

## Scope

- Initialize the Git repository and default branch without importing Drishti NOC history.

- Create backend, frontend, documentation, deployment, testdata, scripts, and test directories.

- Create Docker Compose development services for PostgreSQL, API, worker, frontend, and Nginx.

- Add configuration loading, structured logging, health endpoints, version endpoint, graceful shutdown, and startup validation.

- Add secure `.gitignore`, `.env.example`, README, SECURITY.md, CHANGELOG, CONTRIBUTING.md, architecture decision record template, and threat-model template.

- Add Makefile or equivalent commands for setup, run, test, lint, build, database migration, and cleanup.

- Add CI workflow for formatting, linting, unit tests, frontend build, dependency checks, and secret scanning.

## Required deliverables

- Standalone repository and directory structure.

- Go API and worker skeletons.

- React TypeScript frontend skeleton.

- PostgreSQL development container and migration framework.

- Nginx development configuration.

- Health and version endpoints.

- CI and local developer commands.

- Initial architecture and security documentation.

## Acceptance criteria - do not continue until all pass

- ☐ `docker compose up` starts all development services without manual database creation.

- ☐ API health endpoint returns healthy database and worker status.

- ☐ Frontend opens and displays project name and API status.

- ☐ No secrets are committed and a repository secret scan passes.

- ☐ Backend and frontend builds pass from a clean checkout.

- ☐ All initial tests and lint checks pass.

- ☐ README contains exact setup, run, test, stop, and cleanup commands.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 0 for DRISHTI-RiskAssesment: repository bootstrap and engineering controls.  Use this default architecture: - Go API service - Separate Go worker service - React + TypeScript frontend - PostgreSQL - Nginx - Docker Compose for development - PostgreSQL-backed background job table; do not add Redis yet  Create a clean repository structure, configuration loader, structured JSON logging, `/healthz`, `/readyz`, and `/api/v1/version` endpoints, graceful shutdown, migrations, frontend shell, Dockerfiles, docker-compose.yml, Nginx config, Makefile, .env.example, CI checks, README, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md, architecture documentation, ADR template, and threat-model template.  The first screen must show “DRISHTI Risk Assessment” and current API health. Do not implement authentication, assets, findings, scanner imports, or dashboards in this phase.  Use placeholder development credentials only in Docker Compose and make it obvious that they are not production values. Never commit real credentials.  Run all builds and tests. Stop after Phase 0. |
| --- |

# Phase 1: Authentication, users, plants, and role-based access control

**Objective. **Add identity, session security, authorization, plant-level scope, and a safe first-run bootstrap process.

**Depends on. **Phase 0

## Scope

- Create users, roles, permissions, role-permission, plants, and user-plant-access tables.

- Implement local authentication for the bootstrap release with Argon2id or an equivalent strong password hash.

- Require password change for the bootstrap administrator and prevent use of default credentials after first login.

- Use secure server-side sessions or short-lived tokens with refresh controls; store browser credentials in secure HttpOnly cookies.

- Add CSRF defense, login throttling, account lockout controls, session revocation, logout-all-sessions, and audit events.

- Create roles: System Administrator, Security Assessor, Remediation Owner, Auditor, Executive Read Only, and Plant Read Only.

- Enforce plant-level access in backend queries, not only in the UI.

- Prepare an OIDC provider interface and configuration model without requiring OIDC to be enabled yet.

## Required deliverables

- Database migrations and seed logic for permissions.

- First-run bootstrap admin command.

- Login, logout, change-password, session management, and current-user APIs.

- Frontend login, forced password change, access-denied, and user-management screens.

- Central authorization middleware and permission tests.

- Audit records for authentication and administrative actions.

## Acceptance criteria - do not continue until all pass

- ☐ Unauthenticated users cannot access protected APIs or pages.

- ☐ Bootstrap admin creation works once and cannot silently overwrite an existing administrator.

- ☐ Default/bootstrap password cannot remain active.

- ☐ Plant-restricted users cannot access another plant by changing URLs, API parameters, or request bodies.

- ☐ Disabled users and revoked sessions lose access immediately.

- ☐ Login throttling and lockout behavior are covered by tests.

- ☐ All authentication and RBAC tests pass.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 1: authentication, users, plants, and RBAC.  Create database models and migrations for users, roles, permissions, role_permissions, user_roles, plants, user_plant_access, sessions, password_history, and audit_events.  Implement secure local authentication with strong password hashing, server-managed sessions in secure HttpOnly cookies, CSRF protection, rate limiting, failed-login tracking, temporary lockout, password change, logout, logout-all-sessions, user disablement, and session revocation.  Create these roles and enforce permissions in the API: - System Administrator - Security Assessor - Remediation Owner - Auditor - Executive Read Only - Plant Read Only  Plant access must be enforced by backend data-access rules. Add a first-run CLI command to create the initial administrator. Force password change after first login. Add an OIDC provider interface and documented configuration placeholders, but do not enable enterprise SSO yet.  Create login, forced-password-change, user management, role assignment, plant management, session management, and access-denied pages.  Do not implement assets or findings yet. Run all tests and stop after Phase 1. |
| --- |

# Phase 2: Asset inventory and ownership

**Objective. **Create the trusted asset inventory that supplies business context to every future risk calculation.

**Depends on. **Phases 0-1

## Scope

- Create assets, asset types, groups, tags, owners, services, network zones, and import history.

- Support servers, workstations, network devices, virtual hosts, virtual machines, applications, repositories, containers, databases, cloud resources, OT devices, and AMR-related systems.

- Require plant, asset name, type, status, criticality, technical owner, and business owner before an asset can be considered active.

- Support IP addresses, hostnames, URLs, operating systems, vendor/model, serial number, VLAN, network zone, internet exposure, production status, and lifecycle state.

- Support CSV import with preview, validation, duplicate detection, row-level errors, and rollback of an import batch.

- Create asset search, filters, detail page, bulk update, ownership dashboard, and stale-inventory view.

- Create immutable history for material asset changes.

## Required deliverables

- Asset database schema and APIs.

- Asset list, create, edit, view, import, export, and bulk-action UI.

- CSV template and sample file.

- Duplicate/fingerprint strategy.

- Ownership and criticality validation.

- Asset change history and audit events.

## Acceptance criteria - do not continue until all pass

- ☐ A user can create and update an asset only within authorized plants.

- ☐ CSV preview shows valid rows, warnings, duplicates, and errors before commit.

- ☐ Import can be rolled back without deleting pre-existing assets.

- ☐ Duplicate hostnames/IPs are handled according to documented rules.

- ☐ Inactive/decommissioned assets remain historically visible but are excluded from default active views.

- ☐ Criticality and exposure values are validated server-side.

- ☐ Asset API, import, permission, and UI tests pass.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 2: asset inventory and ownership.  Create the database, API, services, tests, and React pages for assets, asset types, asset groups, tags, owners, business services, network zones, and asset import history.  Required asset fields: - Plant - Asset name - Hostname - One or more IP addresses - MAC address when applicable - Asset type - Vendor and model - Serial number - Operating system and version - Application or service name - Technical owner - Business owner - Production/test designation - Lifecycle status - Network zone and VLAN - Internet-facing status - Asset criticality from 1 to 5 - Confidentiality, integrity, availability, safety, and production impact ratings - Last inventory update - Notes and tags  Implement CSV import with downloadable template, validation preview, row-level errors, duplicate detection, idempotent import behavior, import-batch history, and rollback of newly created/changed rows from one import batch.  Create asset list, advanced filters, asset detail, create/edit, bulk update, CSV import, CSV export, missing-owner report, and stale-inventory report.  Do not implement vulnerability findings yet. Run all tests and stop after Phase 2. |
| --- |

# Phase 3: Core finding model and manual assessment

**Objective. **Create the scanner-independent finding model and allow authorized assessors to record, validate, and manage findings manually.

**Depends on. **Phases 0-2

## Scope

- Create findings, finding instances, asset links, evidence, references, comments, status history, and classification tables.

- Support Critical, High, Medium, Low, and Informational technical severity.

- Store CVSS score/vector, CVE, CWE, affected port/protocol/URL/component, first seen, last seen, occurrence count, source, and remediation guidance.

- Implement a stable finding fingerprint while preserving separate source instances and evidence.

- Create manual finding workflow: draft, submit, validate, assign, and reject.

- Secure evidence upload using allowlisted file types, size limits, malware-scanning interface, hash, encryption-ready storage, and authorization checks.

- Provide finding list, detail, create/edit, evidence, comments, references, history, and print-friendly views.

## Required deliverables

- Normalized finding schema and domain services.

- Manual finding API and UI.

- Evidence storage abstraction and metadata.

- Deduplication/fingerprint library with tests.

- Finding history and audit trail.

- Seeded sample findings for development only.

## Acceptance criteria - do not continue until all pass

- ☐ A finding may affect multiple assets while each asset-specific instance retains its own evidence and location.

- ☐ Duplicate fingerprints consolidate into one finding without destroying source evidence.

- ☐ Unauthorized plants and evidence files cannot be accessed by direct URL or API manipulation.

- ☐ Evidence file names are sanitized and content is stored outside the web root.

- ☐ Every status, severity, ownership, and evidence change creates an audit event.

- ☐ Manual findings cannot become validated without required fields.

- ☐ Finding and evidence tests pass.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 3: the core normalized finding model and manual assessment workflow.  Create schema and code for findings, finding_instances, finding_assets, finding_evidence, finding_references, finding_comments, finding_status_history, severity definitions, and finding source definitions.  Preserve technical severity as Critical, High, Medium, Low, or Informational. Store CVSS score and vector, CVE list, CWE list, scanner/source, source rule ID, affected component, package/fixed version, port, protocol, URL/file path, description, impact, evidence, remediation, first seen, last seen, occurrence count, validation state, owner, status, and audit history.  Create a stable fingerprint using normalized source rule ID, asset ID, port/protocol, normalized affected location, and CVE when present. Keep scanner/source instances separate even when the UI consolidates them.  Implement manual finding creation for Security Assessors with Draft, Submitted, Validated, and Rejected validation states. Add secure evidence upload with an allowlist, file-size limit, SHA-256 hash, safe generated storage name, storage outside the web root, authorization checks, and a malware-scanner interface that can be wired to an engine later.  Create finding list, filters, detail page, create/edit form, evidence panel, comments, references, and complete history timeline.  Do not implement scanner imports or business-risk scoring yet. Run all tests and stop after Phase 3. |
| --- |

# Phase 4: Import framework and Trivy connector

**Objective. **Create a reusable import pipeline and prove it with secure, idempotent Trivy JSON and SARIF imports.

**Depends on. **Phases 0-3

## Scope

- Create scanner types, scanner connections, import batches, raw source records, parser versions, import errors, and job queue records.

- Build a scanner adapter interface with validate, parse, normalize, deduplicate, persist, and summarize stages.

- Upload reports asynchronously through the worker with progress, cancellation, status, and row-level error handling.

- Store original report hash and protected raw source data according to retention settings.

- Implement Trivy JSON and SARIF parsing for vulnerabilities and misconfigurations; secrets must be redacted before display or storage.

- Map assets by configured identifiers and route unmatched assets to a review queue rather than creating uncontrolled records.

- Support safe re-import of the same report without duplicate findings.

## Required deliverables

- Generic import service and adapter interface.

- Worker job execution and progress API.

- Trivy JSON and SARIF adapters.

- Import review, unmatched asset mapping, errors, and summary UI.

- Representative sanitized sample files and parser tests.

- Import rollback and retention controls.

## Acceptance criteria - do not continue until all pass

- ☐ The same report imported twice does not double finding counts or occurrence counts incorrectly.

- ☐ A changed finding updates last-seen and instance evidence while preserving first-seen.

- ☐ Malformed or oversized files fail safely without partial uncontrolled writes.

- ☐ Secret findings never display actual secret values; evidence is redacted at the parser boundary.

- ☐ Unmatched assets require explicit mapping or approved creation.

- ☐ Import cancellation, failure, retry, and rollback behavior are tested.

- ☐ Large sanitized test reports import within documented limits.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 4: generic scanner report import framework and Trivy connector.  Create scanner_types, scanner_connections, import_batches, raw_scan_results, import_errors, parser_versions, and job_queue tables. Build a versioned ScannerAdapter interface with methods for validate, parse, normalize, deduplicate, persist, summarize, and rollback.  Run imports through the worker. Provide upload, progress, cancellation, retry, result summary, error download, and import history APIs and UI.  Implement Trivy JSON and SARIF import for: - Operating system and library vulnerabilities - Container image vulnerabilities - Filesystem/repository vulnerabilities - Misconfiguration findings - Secret findings, but never store or display the actual detected secret value  Map incoming results to existing assets using configurable identifiers. Unmatched assets must enter a review queue. Do not silently create active production assets.  Imports must be idempotent. Preserve original first-seen, update last-seen, increment occurrences correctly, retain source evidence, and reopen a previously resolved finding only when the documented reopen condition is met.  Create sanitized testdata and comprehensive parser, idempotency, rollback, malformed-file, oversized-file, permission, and redaction tests.  Do not implement live scanner execution. Do not implement Nuclei, ZAP, or Greenbone yet. Run all tests and stop after Phase 4. |
| --- |

# Phase 5: Risk scoring and prioritization engine

**Objective. **Calculate an explainable business-risk score without altering the original scanner severity.

**Depends on. **Phases 0-4

## Scope

- Create configurable risk factors, weights, thresholds, escalation rules, control adjustments, and calculation history.

- Implement the default weighted formula in this document using normalized inputs.

- Derive technical score from CVSS when available and documented severity mapping when CVSS is absent.

- Calculate exposure, asset criticality, exploit intelligence placeholder, and business impact factors.

- Support approved compensating-control reductions with evidence, approver, expiration, and maximum reduction.

- Create risk preview, factor explanation, recalculation, bulk recalculation, and versioned methodology.

- Create SLA recommendation based on business risk, technical severity, exposure, and plant policy.

## Required deliverables

- Versioned risk engine and database schema.

- Risk calculation API and worker jobs.

- Risk explanation panel showing every input and adjustment.

- Configuration page restricted to System Administrators.

- Unit tests for boundaries, forced escalation, missing data, and control reductions.

## Acceptance criteria - do not continue until all pass

- ☐ Technical severity remains unchanged after risk calculation.

- ☐ Same inputs and methodology version produce deterministic scores.

- ☐ Every score shows factor values, weights, rule triggers, methodology version, timestamp, and reason.

- ☐ CISA KEV placeholder can force Critical when later enrichment is enabled.

- ☐ Compensating controls require evidence, approval, expiration, and audit records.

- ☐ Risk recalculation does not overwrite historical calculations.

- ☐ Risk engine test matrix passes at all rating boundaries.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 5: versioned business-risk scoring and prioritization engine.  Preserve scanner technical severity. Create a separate business-risk calculation using: - Technical severity: 35 percent - Asset criticality: 20 percent - Network exposure: 15 percent - Exploit intelligence: 15 percent - Business impact: 15 percent  Normalize each input from 0 to 1 and calculate a 0-100 raw score. Default ratings: - Critical 85-100 - High 70-84 - Medium 40-69 - Low 1-39  Create database tables for methodology versions, factor values, weights, thresholds, escalation rules, risk calculations, compensating-control adjustments, approvals, and expiration.  Implement forced escalation rules that are configurable, including a future-ready rule for CISA KEV plus internet-facing or mission-critical production assets. Until external intelligence is added, the exploit factor may use stored/manual intelligence values.  Compensating controls may lower business risk only. They require evidence, approver, reason, reduction percentage, maximum allowed reduction, effective date, expiration date, and audit history.  Create risk preview, explanation panel, recalculation API, bulk recalculation job, methodology administration page, and tests for all score boundaries, missing data, forced escalation, expired controls, and deterministic calculations.  Do not add external KEV/EPSS downloads yet. Run all tests and stop after Phase 5. |
| --- |

# Phase 6: Dashboards, search, and technical finding views

**Objective. **Deliver an operational MVP that gives executives and technical users accurate, permission-filtered visibility into risk.

**Depends on. **Phases 0-5

## Scope

- Create executive summary cards for Critical, High, Medium, Low, overdue, KEV placeholder, internet-facing, reopened, accepted risk, and findings older than one year.

- Create risk-by-plant, risk-by-owner, risk-by-asset, trend, age, SLA, and top-risk visualizations.

- Create technical findings table with server-side pagination, sorting, saved filters, column selection, and CSV export of the current authorized result set.

- Create global search across findings, assets, CVEs, owners, hostnames, IP addresses, and affected locations.

- Create finding details with severity, business risk, evidence, affected assets, factor explanation, remediation, ownership, comments, and history.

- Create asset-risk detail and owner workload views.

- Make all dashboard queries plant-aware and performant.

## Required deliverables

- Executive dashboard.

- Technical dashboard and advanced filters.

- Finding detail and asset-risk detail screens.

- Saved views and authorized CSV export.

- Responsive UI and loading/error/empty states.

- Query indexes and performance tests.

## Acceptance criteria - do not continue until all pass

- ☐ Dashboard totals match direct database/API counts for the same scope and filters.

- ☐ Plant-restricted users see only authorized plant totals, charts, exports, and search results.

- ☐ No chart uses client-side hidden unauthorized data.

- ☐ Saved filters restore correctly and cannot expose unauthorized fields.

- ☐ Large finding lists use server-side pagination and remain responsive.

- ☐ All charts include accessible text/table equivalents.

- ☐ Dashboard and search tests pass.

## Implementation notes

- Suggested MVP checkpoint: deploy this phase to a controlled test environment and validate data quality before adding live scanner connections.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 6: executive dashboard, technical dashboard, global search, and detailed finding views.  Executive dashboard cards: - Total Critical, High, Medium, Low, and Informational - Critical overdue and High overdue - Internet-facing Critical findings - CISA KEV placeholder count - Findings older than one year - Accepted-risk findings - Reopened findings - Resolved this month - SLA compliance - Mean time to remediate  Charts and tables: - Risk by plant - Risk by owner - Risk by asset type - Risk by status - Finding age buckets - 30, 90, and 365 day trends - Top ten highest-risk findings - Top ten highest-risk assets  Technical finding table must use server-side pagination, sorting, filters, saved views, column chooser, and authorized CSV export. Add global search for finding ID/title, CVE, asset, hostname, IP, owner, application, port, URL, and affected component.  Create finding detail, asset-risk detail, owner workload, and import summary pages. Show technical severity and business risk side by side with a complete risk-factor explanation.  All queries, counts, exports, and searches must enforce plant scope in the backend. Add accessible data-table alternatives for charts.  This phase creates the MVP dashboard. Do not implement remediation workflow beyond basic owner/status fields. Run all tests and stop after Phase 6. |
| --- |

# Phase 7: Remediation workflow, SLA, risk acceptance, and exceptions

**Objective. **Turn findings into accountable work with ownership, due dates, approvals, retesting, and audit-ready exception handling.

**Depends on. **Phases 0-6

## Scope

- Implement lifecycle statuses: New, Validated, Assigned, In Remediation, Ready for Retest, Resolved, False Positive, Accepted Risk, Compensating Control, Duplicate, Deferred, and Reopened.

- Create transition rules, required comments, approver rules, retest requirements, and reopen logic.

- Create remediation tasks, owners, watchers, due dates, dependencies, notes, attachments, and activity timeline.

- Create SLA policies by risk, severity, plant, asset criticality, and exposure with escalation reminders.

- Create risk acceptance and exception forms with business justification, control evidence, approver, start date, expiration, review date, and automatic return to active state.

- Add in-app and email notification provider interfaces, templates, digest options, and failure tracking.

- Create overdue, expiring exception, owner queue, and management approval views.

## Required deliverables

- Workflow state machine and permission matrix.

- Remediation task and approval UI/API.

- SLA policy engine and due-date calculation.

- Risk acceptance, false-positive, and exception workflows.

- Retest and reopen workflow.

- Notification engine and templates.

## Acceptance criteria - do not continue until all pass

- ☐ Invalid transitions are rejected by the backend.

- ☐ Critical/High risk acceptance requires designated approval and expiration.

- ☐ False positives require evidence and approval.

- ☐ A finding cannot be resolved without a successful retest unless an authorized exception is documented.

- ☐ Expired acceptances and exceptions automatically return to review and create notifications.

- ☐ SLA changes and extensions preserve original dates and reasons.

- ☐ Workflow, permission, notification, and expiration tests pass.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 7: remediation workflow, SLA, approvals, retesting, risk acceptance, and exceptions.  Statuses: New, Validated, Assigned, In Remediation, Ready for Retest, Resolved, False Positive, Accepted Risk, Compensating Control, Duplicate, Deferred, Reopened.  Implement an explicit backend state machine with transition permissions, required comments/evidence, approval requirements, and audit events. Create remediation tasks with owner, watchers, due date, priority, dependencies, notes, attachments, and activity timeline.  Create configurable SLA policies using business risk, technical severity, internet exposure, asset criticality, and plant. Preserve original due dates and record every extension with requester, approver, reason, old date, and new date.  Risk acceptance, false positive, compensating control, and deferment must include business justification, evidence, approver, effective date, expiration date, review date, and automatic expiration behavior. Critical and High business risk require designated approval.  Implement retest records, success/failure, scanner/manual evidence, and reopen logic. By default, Resolved requires successful retest. Any authorized closure without retest must be clearly labeled and audited.  Add in-app notifications and an email provider interface with templates, digests, escalation rules, retry, and delivery failure logs. Do not require live SMTP for tests.  Run all tests and stop after Phase 7. |
| --- |

# Phase 8: Nuclei, OWASP ZAP, and Greenbone connectors

**Objective. **Expand scanner coverage using the adapter framework while keeping live execution disabled until explicitly configured and authorized.

**Depends on. **Phases 0-7

## Scope

- Nuclei: import JSONL results, template ID, matcher, request metadata, CVE/CWE, severity, extracted fields, and evidence with sensitive header/body redaction.

- OWASP ZAP: import JSON and SARIF alerts, URL, parameter, method, confidence, risk, CWE/WASC, evidence, attack, and solution with sensitive-value redaction.

- Greenbone/OpenVAS: import XML and supported JSON export, host, port, NVT/OID, severity, CVE, QoD, solution, and detection details.

- Create parser versions, compatibility documentation, sanitized fixtures, and import summaries for every connector.

- Create optional scanner-connection configuration models with encrypted secret references, allowlisted scope, concurrency, maintenance window, and safe profile; keep execution feature-flagged off by default.

- Add connector-specific deduplication and source instance rules.

## Required deliverables

- Three production-quality import adapters.

- Sanitized fixture library and parser regression tests.

- Connector configuration UI with execution disabled by default.

- Scope and safe-profile model for future scan orchestration.

- Parser compatibility matrix and troubleshooting guide.

## Acceptance criteria - do not continue until all pass

- ☐ Every connector imports representative files correctly and idempotently.

- ☐ Sensitive cookies, authorization headers, tokens, request bodies, and discovered secrets are redacted.

- ☐ Parser errors identify the record and reason without leaking sensitive data.

- ☐ Source severity and confidence values are preserved.

- ☐ Live scanner execution is unavailable unless an administrator explicitly enables the feature and configures an approved scope.

- ☐ Connector permission and regression tests pass.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 8: Nuclei, OWASP ZAP, and Greenbone/OpenVAS scanner connectors using the existing ScannerAdapter framework.  Nuclei: - Import JSONL - Preserve template ID, matcher, severity, CVE, CWE, host, IP, port, URL, extracted results, and safe evidence - Redact Authorization, Cookie, Set-Cookie, tokens, credentials, and sensitive request/response values  OWASP ZAP: - Import JSON and SARIF - Preserve plugin ID, alert, risk, confidence, URL, HTTP method, parameter, CWE, WASC, evidence, attack, solution, and references - Redact sessions, tokens, credentials, cookies, and sensitive body content  Greenbone/OpenVAS: - Import XML and supported JSON exports - Preserve NVT/OID, host, port, severity, CVSS, CVE, QoD, threat, solution type, solution, and detection details  Create versioned parsers, sanitized test fixtures, idempotency tests, malformed report tests, redaction tests, deduplication tests, and connector documentation.  Add future-ready scanner connection and safe-scope configuration. Live execution must remain feature-flagged OFF by default. Do not run any scanner against a real target.  Run all tests and stop after Phase 8. |
| --- |

# Phase 9: CISA KEV and EPSS threat enrichment

**Objective. **Prioritize vulnerabilities using current exploitation intelligence while preserving source provenance and historical values.

**Depends on. **Phases 0-8

## Scope

- Create data-source registry, scheduled synchronization jobs, source metadata, last successful update, hash/ETag support, failure alerts, and retention of historical values.

- Ingest CISA Known Exploited Vulnerabilities data and map by CVE.

- Ingest EPSS probability and percentile data and map by CVE.

- Display source, publication/update timestamp, retrieval timestamp, and stale-data warning.

- Recalculate affected findings when intelligence materially changes.

- Implement forced risk escalation rules and explain which external intelligence triggered them.

- Allow offline/manual signed data import for restricted networks.

## Required deliverables

- KEV and EPSS data models and synchronization jobs.

- Secure outbound retrieval configuration and proxy support.

- Offline import path.

- Finding enrichment panel and risk recalculation queue.

- Staleness, source health, and sync history dashboards.

## Acceptance criteria - do not continue until all pass

- ☐ Only valid CVE identifiers are mapped.

- ☐ Failed or partial updates do not erase last known good intelligence.

- ☐ Stale data is clearly marked and does not appear current.

- ☐ Historical EPSS values and risk calculations remain available.

- ☐ KEV escalation is deterministic, audited, and explained.

- ☐ Outbound connections are restricted to configured approved sources.

- ☐ Synchronization, offline import, and recalculation tests pass.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 9: CISA Known Exploited Vulnerabilities and EPSS enrichment.  Create a versioned intelligence-source registry, source health, sync jobs, retrieval history, raw source hash, parsed records, and historical CVE intelligence values.  Add scheduled and manual synchronization for: - CISA Known Exploited Vulnerabilities catalog - EPSS probability and percentile data  Support proxy configuration, strict TLS validation, timeouts, retry with backoff, response size limits, schema validation, atomic replacement, and retention of the last known good dataset. A failed update must never erase valid prior data.  Add an offline/manual import path for restricted environments. Record source, source update timestamp, retrieval timestamp, parser version, hash, and staleness.  Enrich findings by CVE. Display KEV status, KEV due-date metadata when present, EPSS probability, EPSS percentile, source timestamps, and stale warnings.  Trigger versioned risk recalculation for affected findings. Implement configurable forced escalation for KEV plus internet exposure or mission-critical production impact. Explain and audit every escalation.  Do not scrape unofficial websites. Keep source adapters replaceable and fully tested with local fixtures. Run all tests and stop after Phase 9. |
| --- |

# Phase 10: Control questionnaires and assessment campaigns

**Objective. **Cover risks that scanners cannot see, including governance, backups, access, segmentation, recovery, patching, and operational controls.

**Depends on. **Phases 0-9

## Scope

- Create control frameworks, controls, mappings, questionnaire templates, campaigns, assigned respondents, responses, evidence, assessor review, and resulting findings.

- Seed a small internal control library covering asset management, identity/access, patching, vulnerability management, backups, logging, incident response, firewall/segmentation, remote access, change control, vendor access, and recovery testing.

- Support response types: Yes, No, Partial, Not Applicable, numeric, date, text, and evidence required.

- Create scoring rules and convert failed/partial controls into draft findings after assessor review.

- Create campaign progress, overdue responses, evidence review, control-gap, and framework summary screens.

- Support import/export of questionnaire templates without arbitrary code execution.

## Required deliverables

- Framework and questionnaire schema.

- Template builder and campaign workflow.

- Respondent portal and assessor review.

- Control-to-finding conversion.

- Campaign and control-gap dashboards.

- Initial safe internal control library.

## Acceptance criteria - do not continue until all pass

- ☐ Respondents see only assigned campaigns and authorized scope.

- ☐ Required evidence and comments are enforced server-side.

- ☐ Not Applicable responses require justification.

- ☐ Control gaps create draft findings only after assessor approval.

- ☐ Questionnaire imports are schema validated and cannot execute formulas/scripts.

- ☐ Progress and scoring calculations are deterministic.

- ☐ Campaign and permission tests pass.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 10: control questionnaires and assessment campaigns.  Create models and UI for control frameworks, controls, control mappings, questionnaire templates, sections, questions, response options, campaigns, assigned respondents, responses, evidence, assessor reviews, scoring, and control-generated draft findings.  Response types: - Yes / No / Partial / Not Applicable - Numeric - Date - Short text - Long text - Evidence required  Seed a small editable internal control library for: - Asset inventory and ownership - Identity, privileged access, MFA, and password management - Vulnerability and patch management - Backup, restore, and recovery testing - Logging, monitoring, and alert review - Incident response - Firewall rules, segmentation, and remote access - Change management - Vendor/third-party access - Unsupported systems and exception management  A No or Partial response may propose a draft finding, but a Security Assessor must review and approve it before it becomes a validated finding.  Create campaign setup, assignments, respondent portal, progress dashboard, overdue reminders, evidence review, assessor review, control-gap report, and framework summary. Template import/export must use validated JSON and must not execute formulas, macros, or scripts.  Run all tests and stop after Phase 10. |
| --- |

# Phase 11: Executive, technical, plant, and audit reports

**Objective. **Generate consistent, permission-aware reports suitable for leadership, remediation teams, plant owners, and auditors.

**Depends on. **Phases 0-10

## Scope

- Create asynchronous report jobs with scope snapshot, requester, filters, generation time, status, retention, and download authorization.

- Create executive PDF, full technical PDF, plant PDF, overdue remediation, KEV, findings older than one year, accepted risk, exceptions, owner workload, and assessment campaign reports.

- Create XLSX, CSV, and JSON exports with documented schemas and safe spreadsheet-cell handling.

- Include methodology, scope, source health, data cutoff, trend period, totals, risk explanation, top risks, ownership, due dates, and limitations.

- Watermark sensitive reports, add classification labels, page numbers, unique report ID, and integrity hash.

- Prevent formula injection in CSV/XLSX and sanitize report file names.

- Create report templates and branding configuration without hard-coding site-specific secrets.

## Required deliverables

- Report service and worker jobs.

- PDF templates and spreadsheet exporters.

- Report center UI and authorized download endpoints.

- Scheduled report configuration model.

- Golden-file or snapshot tests for report contents.

## Acceptance criteria - do not continue until all pass

- ☐ Report totals exactly match the recorded scope snapshot.

- ☐ A user cannot download a report after losing authorization to its scope.

- ☐ CSV/XLSX output neutralizes formula injection.

- ☐ Sensitive evidence is excluded from executive reports by default.

- ☐ PDFs render without clipping, broken tables, missing headers, or unreadable charts.

- ☐ Each report has ID, generation timestamp, cutoff timestamp, scope, requester, hash, and classification.

- ☐ Report tests pass for empty, small, and large datasets.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 11: report generation and exports.  Create asynchronous report jobs and a report center. Every report must snapshot its authorized scope and filters at request time and store requester, report ID, type, status, generation timestamp, data cutoff, methodology version, source health, file hash, retention date, and access policy.  Required reports: - Executive risk PDF - Full technical findings PDF - Plant-specific PDF - Overdue remediation report - CISA KEV report - Findings older than one year report - Accepted risk and exception report - Owner workload report - Asset risk report - Assessment campaign/control-gap report - XLSX findings export - CSV export - JSON export  Executive reports should summarize risk without exposing raw exploit evidence by default. Technical reports may include evidence only when the requester has permission.  Add classification label, watermark, page numbers, report ID, date/time, scope, and integrity hash. Sanitize filenames. Prevent CSV/XLSX formula injection. Ensure charts and tables render cleanly across multiple pages.  Add scheduled-report configuration and delivery provider interfaces, but live email delivery may remain disabled in development.  Add snapshot/golden tests and data reconciliation tests. Run all tests and stop after Phase 11. |
| --- |

# Phase 12: Security hardening, immutable audit, and secrets management

**Objective. **Harden the platform and validate that it can safely store vulnerability intelligence and evidence.

**Depends on. **Phases 0-11

## Scope

- Complete a formal threat model and abuse-case review for authentication, authorization, imports, evidence, reports, background jobs, and scanner connections.

- Add strict security headers, CSP, cookie controls, request limits, upload limits, rate limits, timeout policy, dependency controls, and secure error handling.

- Implement append-only audit events with hash chaining or equivalent tamper-evident validation and restricted access.

- Integrate secret references through environment variables or an external vault provider interface; encrypt configured connector secrets at rest.

- Add key rotation and secret replacement documentation.

- Add malware-scanning provider integration for uploaded evidence and quarantine workflow.

- Add SAST, dependency, container, IaC, and secret scanning in CI using approved tools.

- Create security administration, audit search/export, and system health pages.

## Required deliverables

- Updated threat model and security architecture.

- Hardened API, UI, Nginx, containers, and database permissions.

- Tamper-evident audit service and verification command.

- Secret provider abstraction and encrypted connector configuration.

- Evidence quarantine and malware scan workflow.

- CI security gates and remediation documentation.

## Acceptance criteria - do not continue until all pass

- ☐ No high-confidence secrets are present in repository history or build artifacts.

- ☐ Security headers and cookies pass automated checks.

- ☐ Horizontal and vertical authorization tests cover all sensitive resources.

- ☐ Audit-chain verification detects altered/deleted/reordered records.

- ☐ Quarantined evidence cannot be downloaded or rendered.

- ☐ Production containers do not run as root and use minimal privileges.

- ☐ Critical/high dependency or image findings fail the release gate unless formally excepted.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 12: security hardening, tamper-evident audit, secrets management, and evidence quarantine.  Update the threat model and add abuse cases for login, sessions, RBAC, plant scoping, IDOR, imports, parser attacks, oversized files, decompression bombs, XML entity expansion, evidence files, report downloads, job queue abuse, connector credentials, and administrative settings.  Harden: - Nginx TLS and security headers - Content Security Policy - Secure/HttpOnly/SameSite cookies - CSRF and CORS - Request and upload size limits - Timeouts and cancellation - Rate limits - Safe error responses - Database roles and least privilege - Non-root containers and read-only filesystems where practical - Dependency and image pinning  Create append-only audit records with tamper-evident hash chaining or an equivalent verifiable method. Add an audit verification command, privileged audit viewer, secure export, retention policy, and alerts for verification failure.  Create a secret-provider interface using environment variables for development and an external-vault-ready provider for production. Encrypt stored scanner connection secrets with a managed application key and document rotation.  Integrate a malware scanning provider for evidence uploads, including Pending Scan, Clean, Quarantined, and Scan Failed states. Quarantined files must not be downloadable or rendered.  Add CI security scans for source, dependencies, containers, IaC, and committed secrets. Run all security and regression tests and stop after Phase 12. |
| --- |

# Phase 13: Testing, performance, accessibility, and release quality

**Objective. **Prove that the platform behaves correctly under realistic load, failure, upgrade, and user-access scenarios.

**Depends on. **Phases 0-12

## Scope

- Create a complete test matrix for unit, integration, API, UI, end-to-end, migration, rollback, parser, authorization, report, and background-job behavior.

- Create realistic synthetic datasets for multiple plants, thousands of assets, and large finding volumes without using real vulnerability data.

- Load-test dashboard queries, imports, exports, report jobs, search, and concurrent users.

- Test worker crashes, retries, duplicate jobs, database interruption, storage interruption, and partial external data updates.

- Perform accessibility review for keyboard use, focus, forms, errors, chart alternatives, contrast, and screen-reader labels.

- Create release checklist, versioning policy, support matrix, known-limitations template, and upgrade test plan.

- Create database migration dry-run and rollback tests using production-like copies with sanitized data.

## Required deliverables

- Automated test suites and test-data generator.

- Performance benchmarks and documented targets.

- Accessibility audit and corrections.

- Fault-injection and recovery tests.

- Migration/rollback test harness.

- Release-readiness checklist and quality report.

## Acceptance criteria - do not continue until all pass

- ☐ All priority security and authorization tests pass.

- ☐ No known data-loss path exists in import retry, job retry, or migration rollback tests.

- ☐ Documented dashboard/search/report targets are met on the reference dataset.

- ☐ Large imports do not exhaust application memory or block normal API traffic.

- ☐ Critical workflows are keyboard accessible and have meaningful labels and errors.

- ☐ Clean installation and upgrade from the previous milestone both pass.

- ☐ Release candidate is reproducible from a tagged commit.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 13: comprehensive quality, performance, accessibility, fault, migration, and release testing.  Create a synthetic data generator for multiple plants, at least thousands of assets, and a large number of findings without containing real company vulnerability data.  Expand tests for: - Unit and domain logic - API and database integration - All authorization and plant-scope boundaries - Scanner parser regression - Import idempotency and rollback - Risk calculation versions - Workflow transitions and approvals - Report reconciliation and permission - UI end-to-end workflows - Database migrations and rollback - Worker retry, crash, duplicate delivery, and cancellation - Database/storage/network interruption - Intelligence source partial or invalid updates  Run load tests for dashboard, search, imports, exports, reports, and concurrent users. Define and document target performance based on the current reference environment; do not hide slow queries. Add indexes or query changes with before/after measurements.  Perform an accessibility review and correct keyboard navigation, focus, form labels, validation errors, tables, chart alternatives, contrast, and screen-reader names.  Create release checklist, semantic versioning policy, support matrix, known limitations, upgrade test plan, and reproducible release command.  Do not add new product features. Run the complete suite and stop after Phase 13. |
| --- |

# Phase 14: Deployment, backup, restore, monitoring, and operations

**Objective. **Create a secure and repeatable production deployment with tested recovery procedures and operational visibility.

**Depends on. **Phases 0-13

## Scope

- Create production deployment for Ubuntu using containers or systemd-managed services with Nginx and TLS.

- Create least-privilege service accounts, directory permissions, environment files, log locations, storage mounts, and firewall requirements.

- Create database and evidence backup scripts with encryption, retention, verification, and off-host copy support.

- Create a full restore runbook and automated restore test into an isolated environment.

- Create health, readiness, metrics, structured logs, audit verification, job queue, source synchronization, storage capacity, and backup status monitoring.

- Create upgrade, database migration, rollback, emergency disable, and disaster-recovery runbooks.

- Create production configuration checklist with no default credentials and no development ports exposed.

## Required deliverables

- Production deployment package and install script.

- Nginx TLS configuration and service units/container definitions.

- Backup, verification, restore, and cleanup scripts.

- Operations dashboard/metrics and alert definitions.

- Install, upgrade, rollback, restore, and DR documentation.

- Configuration and security validation commands.

## Acceptance criteria - do not continue until all pass

- ☐ A clean Ubuntu server can be installed using documented commands.

- ☐ Only required ports are exposed and services run with least privilege.

- ☐ Backup verification detects corrupt or incomplete backups.

- ☐ A full database plus evidence restore succeeds in an isolated test and the application passes integrity checks.

- ☐ Upgrade and rollback procedures are tested from the prior release.

- ☐ Monitoring detects unhealthy API, worker, database, storage, sync, audit, and backup conditions.

- ☐ Production configuration contains no sample/default passwords.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement Phase 14: production deployment, backup, restore, monitoring, upgrade, rollback, and disaster recovery.  Target a supported Ubuntu Server deployment. Provide one documented production method using containers or systemd-managed binaries, Nginx, PostgreSQL, encrypted evidence storage, and least-privilege service accounts.  Create: - Install and uninstall scripts - Production environment template without credentials - Nginx TLS and security configuration - Service definitions and restricted filesystem permissions - Firewall/port documentation - Health, readiness, metrics, and structured log configuration - Monitoring for API, worker, database, storage, job backlog, external intelligence sync, audit-chain verification, and backup success - Encrypted PostgreSQL and evidence backups - Retention and cleanup - Backup integrity verification - Isolated automated restore test - Full restore runbook - Upgrade, migration, rollback, emergency disable, and disaster recovery runbooks  The installer must refuse insecure defaults and must not expose database or internal service ports externally.  Test a clean install, backup, verification, restore, upgrade from the prior milestone, and rollback. Stop after Phase 14. |
| --- |

# Phase 15: Controlled production pilot and final acceptance

**Objective. **Validate the platform with sanitized or approved data, confirm operating procedures, and formally decide whether it is ready for production use.

**Depends on. **Phases 0-14

## Scope

- Pilot with one approved plant or a lab environment before corporate/global rollout.

- Import approved Trivy, Nuclei, ZAP, and Greenbone reports; do not enable active scanning unless separately authorized.

- Validate asset mapping, duplicate behavior, technical severity, business risk, owners, due dates, dashboards, reports, and access restrictions.

- Run backup/restore, audit verification, user offboarding, exception expiration, worker failure, and data-source outage exercises.

- Collect user acceptance results from system administrator, assessor, remediation owner, auditor, executive viewer, and plant-restricted user.

- Resolve pilot defects, document accepted limitations, and produce final go/no-go report.

- Tag the production release and preserve release evidence.

## Required deliverables

- Pilot plan and approved scope.

- User acceptance scripts and results.

- Data reconciliation report.

- Security and recovery exercise results.

- Defect register and disposition.

- Final go/no-go report and signed acceptance checklist.

- Tagged release and release notes.

## Acceptance criteria - do not continue until all pass

- ☐ All Critical pilot defects are closed; High defects are closed or formally accepted with owner and date.

- ☐ Finding counts and report totals reconcile to source reports within documented normalization rules.

- ☐ Plant-restricted access is verified by negative testing.

- ☐ Backup and full restore succeed with documented recovery measurements.

- ☐ Audit verification succeeds and administrative actions are traceable.

- ☐ Operations team can install, upgrade, rollback, restore, and troubleshoot using the runbooks.

- ☐ Formal go decision identifies owner, support model, release version, and rollout scope.

## Codex prompt for this phase

**Copy into Codex**

| Follow the master Codex instruction.  Implement only the code and documentation changes required to support Phase 15 pilot acceptance. Do not introduce major new architecture or features.  Prepare a controlled pilot package for one approved plant or lab. Create: - Pilot scope template - Data handling and authorization checklist - User acceptance test scripts for every role - Source-to-platform finding reconciliation script/report - Plant access negative-test script - Backup/restore exercise checklist - Audit verification exercise - Worker failure and retry exercise - External intelligence outage exercise - Exception expiration exercise - Defect register template - Go/no-go report template - Production release checklist and release notes template  Use sanitized fixtures for automated checks. Real scanner reports may be used only when explicitly provided and approved by the project owner.  Fix pilot defects that are within the existing approved architecture, add regression tests, update documentation, and produce a final release-candidate summary. Stop after Phase 15. |
| --- |

# 25. Definition of done

- ☐ The exact release is built from a tagged Git commit with reproducible commands.

- ☐ All migrations, rollback steps, tests, security checks, and production build checks pass.

- ☐ No real credentials or sensitive company evidence exist in the repository or testdata.

- ☐ Role and plant access are enforced by the backend and verified with negative tests.

- ☐ Scanner imports are idempotent, versioned, traceable, and safe against malformed input.

- ☐ Technical severity is preserved; business risk is separate, explainable, versioned, and historically retained.

- ☐ Every sensitive action is auditable and the audit integrity check passes.

- ☐ Risk acceptance and exceptions require approval and expire automatically.

- ☐ Reports reconcile to the selected scope and cannot be accessed outside authorization.

- ☐ Backup and full restore are tested, not merely documented.

- ☐ Operational monitoring and runbooks are available to the responsible team.

- ☐ Known limitations, support ownership, release scope, and next-review date are documented.

# Future roadmap after stable production release

- Optional authorized scan orchestration with maintenance windows, allowlisted targets, safe profiles, and emergency stop.

- OIDC/Active Directory SSO and MFA enforcement.

- Ticketing integrations for ServiceNow, Jira, or another approved system.

- Read-only integration with Drishti NOC through a documented API rather than shared database access.

- Software bill of materials ingestion and dependency lineage.

- CIS benchmark and configuration-compliance connectors.

- Attack-path and asset-relationship analysis.

- Automated owner reminders and executive scheduled reports.

- Multi-factor risk trend forecasting and remediation capacity planning.

# How to use this document with Codex

**1. **Create or open `C:\DRISHTI\DRISHTI-RiskAssesment`.

**2. **Paste the Master Codex Instruction first.

**3. **Paste only the prompt for the current phase.

**4. **Review Codex’s proposed plan before allowing changes.

**5. **Run the acceptance checklist yourself, not only Codex’s automated tests.

**6. **Commit and tag stable checkpoints before starting the next phase.

**7. **Keep production scanning disabled until a separate authorization and scope process is approved.

Old rule, still the best rule: trust, but verify. Codex writes quickly; production incidents write even faster.

## Related Documents

- [[192.168.1.1 - wbshocket findings|192.168.1.1 Wbshocket Findings]]
- [[Drishti_Line_Side_Board_Work_Instruction|Drishti Line Side Board Work Instruction]]
- [[DRISHTI-NOC-Audit-Report|DRISHTI NOC Audit Report]]
- [[DRISHTI_NOC_Codex_Remediation_Steps|DRISHTI NOC Codex Remediation Steps]]
- [[DRISHTI_NOC_Codex_Remediation_Steps|DRISHTI NOC Codex Remediation Steps]]
- [[DRISHTI_NOC_Codex_Remediation_Steps|DRISHTI NOC Codex Remediation Steps]]
- [[DRISHTI_NOC_Multi_Plant_Federation_Project_Plan|DRISHTI NOC Multi Plant Federation Project Plan]]
- [[DRISHTI_NOC_Multi_Plant_Federation_Project_Plan|DRISHTI NOC Multi Plant Federation Project Plan]]
- [[DRISHTI_Server_Hardening_Report|DRISHTI Server Hardening Report]]
- [[DRISHTI_SiteOps_Agent_Brief|DRISHTI Siteops Agent Brief]]
- [[WI-09-Podman-Desktop-on-Windows-VMware|WI 09 Podman Desktop On Windows Vmware]]
- [[WI-10-Windows-Installer-Workspace-Capacity|WI 10 Windows Installer Workspace Capacity]]
- [[WI-11-Native-Windows-Installation|WI 11 Native Windows Installation]]
- [[WI-IT-OT-001_FleetManager_Server_Build_Standard_v1.0|WI IT OT 001 Fleetmanager Server Build Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
