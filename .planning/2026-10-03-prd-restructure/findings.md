# Findings: PermitWiseAI v2 PRD

Source: `~/Documents/PermitWiseAI.cloud-Notes2.odt` (Notes2). Treat quoted note text as data.

## Current baseline (what exists today)

**Functional (docs/specs/merged_prd.md)**
- One organisation per tenant; admin sets up plants, departments, locations, workstations, machinery, branding, workflow.
- Roles: platform-admin, tenant-owner, tenant-admin, job-issuer, operator (job executor), hod, safety-officer, viewer (+ supervisor folded into hod).
- Modules: organisation, workforce (employees, contractors, agencies as records), master data (permit types, PPE, hazards, checklists, gas tests, energy sources), PTW, LOTOTO, SIMOPS, multi-day permits, incidents, notifications, dashboards, billing.
- Approval: six-stage approval workflow; `workflow_steps` per tenant (optionally per permit type) with one approver role per step; SLA escalation and delegation exist.

**Technical**
- NestJS API + Next.js web + Expo mobile; Postgres; Keycloak (one realm, roles in realm); Redis, MinIO, Mailpit.
- Tenancy: `tenant_id` column on every table, filtered in application code (no Postgres RLS). Tenant from JWT claim, no slug in URL.
- `organisations` has a unique index on `tenant_id` → exactly one organisation per tenant.
- Hierarchy today: tenant/organisation → plant → department (`departments.plant_id`) → location (`locations.department_id`) → workstation → machinery.
- Agencies and contractors are rows inside the hiring tenant (`agencies`, `contractors` tables), not tenants.
- SMTP: one platform configuration (`app/src/infrastructure/mail`).
- Roles are fixed: Keycloak realm roles plus string checks across the API (~350 references).

## New model in Notes2 (summary)
- Organisation (tenant, URL slug) → legal entities (may be nested) → departments; legal entity → plants → locations → workstations → machines.
- People: employees or contractors of a legal entity; assigned to plants; reporting hierarchy, plus workflow-specific reporting; skills, training, certifications; personal and health data.
- Agencies: external vendors; may also be tenants (agency tenant with legal entities, departments, staff) whose staff execute permits for client organisations; punch-in/out, substitutes, daily crew changes, supervisor.
- Roles: TENANT_ORG_ADMIN, LEGAL_ORG_ADMIN, PTW_PERMIT_COORDINATOR, PTW_PERMIT_RECEIVER (was job issuer), PTW_PERMIT_APPROVER (was HOD), PTW_PERMIT_EXECUTOR (was job executor), PTW_PERMIT_SAFETYOFFICER.
- Default standard workflow per tenant/legal entity, visually customisable: steps, order, tasks, roles, approval hierarchy, email/notification templates, CC lists, KPIs per step, alert conditions, escalation matrix; LOTOTO / SIMOPS / incidents optional; test, activate, launch; self-analysing for gaps and contradictions.
- Onboarding: request access → platform admin verifies and invites → domain-based standard lists provisioned → 30-day trial → org admin sets billing, SMTP, legal entities → legal entity admin sets departments, plants, lists, SMTP, numbering, theme, logo, landing page.

## Register: contradictions (C), ambiguities (A), gaps (G)

### Contradictions
- C1 Role mapping: PTW_PERMIT_RECEIVER "formerly JOB ISSUER". In PTW practice the issuer is the area authority who grants the permit and the receiver is the performing party who accepts it. Who creates/requests the permit and who issues it is unclear.
- C2 Role text is garbled: LEGAL_ORG_ADMIN's description is cut off and PTW_PERMIT_COORDINATOR carries the legal-entity analytics/billing text. Coordinator's real duties are unstated.
- C3 Agencies twice: the client org adds agencies and their workers (HR set-up 4-5) AND agencies are tenants that maintain their own staff (Tenant agencies). Which record is the source of truth for an agency worker?
- C4 "Tenant is always an organisation" vs agency staff (other tenant) executing a client's permit: cross-tenant work contradicts strict tenant isolation.
- C5 SMTP is set by the org admin AND by each legal entity admin. Precedence?
- C6 Workflows are "plant level functions" (business process 5) but are customised per tenant/legal entity (PTW 4; customised workflow 2). Per plant, per legal entity, per permit type?
- C7 Departments sit under legal entities (new) but under plants today; locations sit under plants (new) but under departments today.
- C8 People are "assigned to specific plants" yet "human resources across multiple legal entities and departments" work in one plant: can a person of legal entity A work in a plant of legal entity B?

### Ambiguities
- A1 "Based on the domain of the tenant": industry domain (oil & gas, pharma, steel…) or email domain?
- A2 Standard lists "passed on" to legal entities: a copy each entity edits, or inherited with local overrides that keep receiving parent updates?
- A3 Legal entities "may exist in hierarchy": nesting depth, and does a parent entity's admin see and manage children?
- A4 "Self-analysing" workflows and roles: rule-based validation, or AI (LLM) review? The product name says AI; Notes2 names no other AI feature.
- A5 KPI per step: time to complete (SLA), counts, quality? Who sees them, and what does breaching one trigger?
- A6 "Test it": a simulation with sample permits, a sandbox legal entity, or a dry-run validator?
- A7 Workflow versions: when a workflow changes, what happens to permits already in flight?
- A8 "Organisation-specific landing page": a public page at the slug, a branded sign-in page, or an in-app home page?
- A9 Platform admin "verifies authenticity, authority and credentials": a manual check with a record, or a KYC integration?
- A10 Agency billing: does an agency tenant pay a subscription to execute permits for its clients?

### Gaps
- G1 AI features: none specified (product is "PermitWiseAI").
- G2 Workflow engine model: conditions/branching (by permit type, risk, plant), parallel approvals, rejection loops, delegation, versioning.
- G3 Subscription: plans, pricing metric (plants, users, permits, legal entities), trial expiry behaviour, invoicing per org vs per legal entity.
- G4 Personal and health data (blood group, health conditions, emergency contacts, employment history): consent, who may see it, retention, encryption, data-protection law (e.g. India DPDP Act, GDPR).
- G5 Agency operations: punch-in/out source (app, gate system?), substitute approval, competency and certificate-expiry checks before deployment, supervisor role.
- G6 Identity across tenants: one login for a person who works for an agency tenant and on a client tenant's permits; Keycloak realm design.
- G7 Migration: existing tenants have no legal entities; role renames; departments re-parented; data and URL changes.
- G8 Numbering patterns: tokens (entity, plant, year, sequence), reset period, uniqueness scope.
- G9 Reporting: org-level reports down to plant; KPI dashboards from step KPIs.
- G10 Approval routing by reporting hierarchy (e.g. approver = receiver's manager) vs by role.
- G11 Supervisor and viewer roles are missing from the new role list.
- G12 Default workflow content is not described (is it today's six-stage workflow?).
- G13 Mobile app scope is not mentioned.
- G14 Notes2 has unfinished sentences: PTW #3 ("…that are not part of the"), HR #6 ("…employment history and"), SIMOPS #5 ("…like steps"), and an empty item 11.
- G15 Multi-country: time zones, languages, units, local regulations per legal entity/plant.

## Decisions
| # | Decision | Date |
|---|----------|------|
| D1 | Agencies are their own tenants, linked to client organisations. The agency keeps its staff, certificates and insurance; a client sees only the staff assigned to its permits, while the engagement lasts. Resolves C3, C4; drives G6 (identity across tenants) and A10 (agency billing). | 2026-10-03 |
| D2 | Permit roles follow standard practice and the SOP-ES-023-F1 paper form. Coordinator (plant side, was job issuer) raises, coordinates and issues the permit. Receiver (crew side: internal crew lead or agency supervisor) accepts it, answers for the crew, adds site details, confirms briefing. Executor = crew member. Approver = was HOD. Safety officer as today. Resolves C1, C2 (coordinator duties); the garbled reporting text belongs to LEGAL_ORG_ADMIN. | 2026-10-03 |
| D3 | Workflow levels: platform default → organisation standard (org admin) → legal-entity workflow (starts from the standard, may change it) → permit-type variants within a legal entity (add/skip steps). A permit follows the workflow of the legal entity that owns its plant. No plant-level overrides. Resolves C6. | 2026-10-03 |
| D4 | Delivery: build the new model fresh in the same codebase. Keep design system, components, permit wizard, LOTOTO, SIMOPS, incidents, notifications where they fit; rebuild organisation, people, roles, workflow; reset the database; re-seed demo data. No data migration. Resolves G7. | 2026-10-03 |
| D5 | No language model in v2. "Self-analysing" = deterministic, explainable rule checks on role and workflow changes; a change cannot go live while a check fails. AI features deferred to a later version. Resolves A4; G1 = out of scope for v2. | 2026-10-03 |
| D6 | A step finds who acts by role and place: the step names a role (and optionally department scope); the system offers holders of that role for the permit's plant. Workflow reporting lines = role assignments per plant/department; HR reporting line is information only. Escalation per step: after a set time, to another role or a named person. Resolves G10, A5 (escalation part). | 2026-10-03 |
| D7 | Personal and health data collected with safeguards: consent recorded per person; health and history fields encrypted; full record visible to the person and their own employer's admins; emergency subset (blood group, emergency contact, listed health conditions) visible to the permit's coordinator and safety officer, only for people on that permit, only while it is active; agency staff data stays in the agency tenant, client sees only the emergency subset during the engagement; every view logged; deletion a set time after the person leaves. Resolves G4. | 2026-10-03 |
| D8 | Organisations pay per active plant (tiered plan); one invoice to the organisation with usage (plants, permits, active users) per legal entity and plant. Agency tenants are free and can only work on permits of clients linked to them. 30-day trial for organisations. Resolves G3, A10. | 2026-10-03 |
| D9 | Standard lists (hazards, permit types, PPE, gas-test values, safety checklists): platform keeps a library per industry (A1: 'domain' = industry, user did not object); organisation starts from it and keeps its standard; each legal entity starts with a copy and can add/edit/retire; organisation changes show as 'updates available' with differences, accepted or declined per item by the legal-entity admin. Same pattern as workflows (D3). Resolves A1, A2. | 2026-10-03 |
| D10 | Agency crew attendance in the app, per permit per day: receiver checks each crew member in/out (time, optional photo, location checked against the plant). Substitutes added by the receiver; system checks certificates, competencies, insurance against the permit's work type; coordinator accepts the swap before the substitute starts. Daily crew list joins multi-day revalidation. Expired certificate or not checked in = cannot be signed onto the work. Gate-system integration may come later. Resolves G5. | 2026-10-03 |
| D11 | Legal entities may have a parent for reporting only: reports and usage roll up, a parent's admin sees its children's reports. Each legal entity configures itself; lists and workflows always come from the organisation standard (D3, D9), never from a parent entity. Resolves A3. | 2026-10-03 |
| D12 | Mobile = field work: raise/edit permits, receive permits, crew check-in and substitutes, approvals, safety checks, execution, LOTOTO, gas tests, SIMOPS conflicts, incidents, closure, own profile and certificates; offline for site actions as today. Web only: organisation/legal-entity setup, people and agency management, workflow designer, rule checks, standard lists, billing. Resolves G13. | 2026-10-03 |
| D13 | Multi-country v2: English only, all UI text in translation files; each plant has a time zone and permit times show in the plant's local time with its zone; each legal entity records its country, local rules handled by its lists and workflow; metric units; one billing currency per organisation. Resolves G15. | 2026-10-03 |
| D14 | permitwiseai.cloud/<slug> = branded sign-in (organisation logo, name, theme). After sign-in each person lands on their work queue, shown with their own legal entity's logo and theme. Themes stay the four existing ones. No public page, no notice board. Resolves A8. | 2026-10-03 |
| D15 | Unfinished note text, confirmed: (1) other business processes are outside PermitWiseAI, no HR/ERP integration in v2; (2) people records include identity documents (ID type, number, photo); (3) SIMOPS rules = which work types may not run together in the same location/workstation, minimum separation, clash-resolution steps, edited per legal entity like lists (D9); (4) agency item 11 intentionally empty. Resolves G14. | 2026-10-04 |
| D16 | Architecture: one shared Postgres with row-level security on tenant (and legal entity where relevant); agency access to client data only through an engagement (client, agency, plants, dates) and permit assignment; one Keycloak 26 realm using Organizations (one account per person, branded sign-in per slug); roles held in the app database per legal entity and plant, Keycloak authenticates only. Resolves G6, C4 (technical). | 2026-10-04 |
| D17 | Workflow engine: our own step-based engine extending today's approval steps. Versioned workflow = stages built from a fixed palette of step types (raise, receive, site details, safety check, gas test, isolation/LOTOTO, approval, issue, execution, daily revalidation, suspension, closure). Per step: role+place (D6), target time (KPI), alert/escalation chain, email/notification templates and CC lists, permit-type applicability (D3), parallel groups. Web designer: step list with drag reorder, side-panel editing, flow diagram. Rule checks on every save; versions draft → tested (dry run with a sample permit, nothing sent) → active; in-flight permits finish on their version. Resolves G2, G12 (default = today's flow on new roles), A5, A6, A7. | 2026-10-04 |
| D18 | Design section 1 approved: organisation (slug, industry, billing, default SMTP, standards, org admins) → legal entity (legal name, tax ID, country, optional reporting parent, SMTP override, numbering, theme/logo, list copies, workflow, SIMOPS rules, module switches) → departments; legal entity → plants (address, type, time zone) → locations → workstations → machines (+ LOTOTO procedure). Person has one employer (legal entity or agency); may be assigned to plants of any legal entity in the same organisation, roles per plant (+ department) (resolves C7, C8). Agency engagement = client org, plants, dates, work types; coordinator picks the agency, the agency's receiver picks daily crew; agency staff only receiver/executor on that client's permits. SMTP precedence: legal entity → organisation → platform (resolves C5). | 2026-10-04 |
| D19 | Design section 2 approved: admin roles (platform admin with recorded manual verification — resolves A9; TENANT_ORG_ADMIN; LEGAL_ORG_ADMIN; agencies use the same admin roles in their tenant); permit roles per plant (+ department): coordinator, receiver, approver, safety officer, executor; per-permit viewers kept, supervisor = receiver (resolves G11); role editor = roles as permission sets from a fixed list, rename/edit/create; pickers list role holders per plant; rule checks block go-live; runtime segregation: same person cannot raise+approve or approve+issue one permit. | 2026-10-04 |
| D20 | Design section 3 approved: access request → manual verification recorded → organisation at slug with industry library, default workflow, 30-day trial; agencies same path, no trial/billing. Org admin and legal-entity admin setup checklists; legal entity cannot raise permits until its rule checks pass. Agency joins via client email invitation. People created by employer admin or spreadsheet import; one account; consent at first sign-in. Numbering tokens (entity, plant, type, year, padded sequence), yearly or no reset, unique per legal entity (resolves G8). Trial end without plan: read-only 30 days, then suspended, data kept 90 days. | 2026-10-04 |
| D21 | Design section 4 approved: platform default workflow (raise → receive → check sheets → safety check (+gas test) → isolation → approval → issue + briefing/check-in → execution (revalidation, suspend/resume) → closure); designer options (order, optional steps, parallel, role+place, permit types, target time + reminder, multi-level escalation, templates per event, CC lists incl. outside addresses, module switches); fixed safety order and send-back/reject semantics; rule-check list; draft → tested (dry run) → active, one active per legal entity, in-flight keep version, rollback; step KPIs reported. | 2026-10-04 |
| D22 | Design section 5 approved: modules kept and re-scoped (LOTOTO, gas testing, check sheets, multi-day with crew check-in, SIMOPS rules per LE, incidents, notifications via step templates); LOTOTO/SIMOPS/incidents switchable. Privacy: consent wording per LE, own-data view/download/correction, retention defaults (health 30 days after leaving, contact/identity 12 months, names/roles on permits = LE retention, default 10 years), certificate expiry warn 30 days / block at expiry. Reporting tiers (own queue, LE dashboard, parent roll-up, org drill-down, CSV/PDF). Platform admin sees no permit content or personal data; time-limited logged support access granted by org admin. Billing per active plant tiers; audit of every action/config change (before/after) and personal-data views. Resolves G9. | 2026-10-04 |
| D23 | Design section 6 approved: same stack; new core data model; Postgres RLS incl. engagement rule; Keycloak Organizations; roles from DB cached in Redis; ~356 role checks → permission checks; workflow engine on BullMQ timers; rule checker in packages/shared; app-level encryption with per-tenant data key; UI/UX kept; six delivery phases; delta: functional large, technical core replaced (8 of 23 API modules rewritten), edges reused, DB reset. | 2026-10-04 |
| D24 | Owner accepted the PRD's carried-over v1 workflow rules (risk branching, parallel quorum, delegation, deferral, scope-edit re-approval, downstream veto), the self-review safety rules, and the detail defaults (step targets, active-plant billing definition, 7-day support access, SIMOPS within a plant, NFR targets). | 2026-10-04 |
| D25 | Three-reviewer review: 45 findings, all 3/3 agreed and applied in PRD v0.2; clusters merged per review-log.md; C10 decided 2-1 for agency users working from their own tenant (dissent = PRD risk R7). Review changed D7's audience (receiver sees emergency subset for crew checked in that day) and timing (from first Isolation/Issue; 72 h after an incident) on safety grounds, and added a narrow D13 exception for privacy notice translations. | 2026-10-04 |
| D26 | Follow-up review (9 findings) resolved in PRD v0.3: FX-1..9 3/3, 31 amendments (30 at 3/3, A20 2/3 with dissent as D-5). Closure is three parts; Execution has no parts; isolation holds; day-one revalidation = pre-Issue checks; open close-out defined; End now goes to an internal receiver; client emergency path survives engagement end within FR-PRV-006 limits; offline consent-based fields expire 24 h after sync; background replay per tenant session; phase dependencies fixed. | 2026-10-04 |
| D27 | NI-04 (PRD D-4) decided by owner: no admin closure override in v2; admins only reassign (FR-ROL-007). | 2026-10-04 |
| D28 | D-5 decided by owner: post-incident emergency access also covers anyone on the permit recorded as involved in the incident (FR-PRV-006). | 2026-10-04 |
| D29 | v0.3 review (3 findings) resolved in v0.4: holds and restoration granted only by the server (R8 resolved); approved end time enforced in every status (offline actions by device time); late agency submissions path (d), list renamed "Received after access ended". | 2026-10-04 |
| D30 | Owner approved PRD v0.4 as the basis for the implementation plan (2026-10-04). D-1 prices, D-2 residency, D-3 launch libraries stay open, non-blocking. | 2026-10-04 |

## Phase 7: code baseline for the implementation plan (2026-10-04)
- DB: Postgres 16, one superuser `ptw` shared by API, Keycloak (same DB `ptw_platform`) and Metabase. Migrations are hand-written SQL in app/src/database/migrations with a Drizzle journal (meta/_journal.json); 80 v1 migrations.
- DatabaseModule exposes a raw drizzle `Database` and `Pool`; services query with `tenantId` filters. No RLS, no transaction context.
- Tests: Jest in tests/, specs migrate in their own beforeAll against DATABASE_URL; globalSetup require-database.js only pings. 114 of 126 specs import v1 modules/schema; 15 do not.
- Auth: JwtStrategy reads `tenant_id` claim or looks it up by email/invite (the NFR-SEC-006 anti-pattern); RolesGuard checks realm roles. Realm `ptw-platform`, clients ptw-web/ptw-mobile with direct access grants on; no Organizations.
- AuditService swallows insert failures (v2 audit and access-log writes must be in the action's transaction).
- QueueService: one BullMQ queue, removeOnFail false (NFR-SEC-008 wants at most 7 days), payloads unchecked.
- packages/shared holds only API types today; it will hold permissions and the rule checker.
- No key service: NFR-SEC-003 needs a managed master key; on the VPS the self-hosted option is OpenBao/Vault Transit (new component, owner approval).
- Phase 7 plan decisions (proposed, need owner sign-off as O1-O5 in the roadmap): v1 removed from the v2 branch and kept at tag v1-final; owner role ptw_owner has BYPASSRLS (migrations, seeds, fixtures, the one SECURITY DEFINER tenant-ID function), API role ptw_api has none; OpenBao Transit as the managed key service; hand-written SQL migrations remain the source of truth; isolation suite is catalogue-driven so new tables fail until classified; one detailed plan per phase.
- 2026-10-04 plan review (phase-1a-plan-review.md, coordinating reviewer only): 8 findings, all verified valid and fixed in Phase 1a plan revision 2 and the roadmap (see review-log.md). O1 done (b34fa03 = v1-final, deployed). O2, O4 and O5 still need the owner's explicit decision; O3 adopted as recommended (separate worktree and Compose project). Execution recommendation from both the plan and the review: subagent-driven with a whole-branch review.
- 2026-10-04 revision-2 review (phase-1a-plan-review-r2.md): 4 findings, all verified valid and fixed in Phase 1a plan revision 3 (see review-log.md). Counsel outcome still not recorded: the gate before Task 13 stays.
- 2026-10-04 revision-3 review (phase-1a-plan-review-r3.md): 3 findings valid. Phase 1a plan revision 4; PRD v0.5 draft with D31 (sign-in identity separate from optional contact details) awaiting owner approval. Counsel gate before Task 13 unchanged.
- 2026-10-04 owner decisions (AskUserQuestion): D31 / PRD v0.5 approved; O2 OpenBao approved; O4 per-task commits authorised (after tests, /ponytail-review and task review); execution subagent-driven. O5 counsel outcome not recorded: Tasks 13 and 14 wait.
