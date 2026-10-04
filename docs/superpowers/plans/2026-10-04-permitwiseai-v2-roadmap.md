# PermitWiseAI v2 Delivery Roadmap

> **For agentic workers:** this is the roadmap, not a task plan. Each phase gets its own task plan in `docs/superpowers/plans/`, written once the phase before it has shipped. That plan is executed with superpowers:subagent-driven-development or superpowers:executing-plans. The first plan is `2026-10-04-v2-phase-1a-data-security-core.md`.

**Goal:** Deliver PRD v0.4 in the order set by PRD §19. Each phase leaves working, tested software on the demo data. Every requirement ID is assigned to the phase that completes it.

**Architecture:** A fresh build in the existing codebase (D4). Tenant isolation is PostgreSQL row-level security under a transaction-local context. Identity is Keycloak Organizations with the code flow and PKCE. Workflows run on an in-house step engine over versioned definitions. A shared rule checker (in `packages/shared`) gates go-live. A single personal-data service decrypts personal data. The offline store is rebuilt and encrypted. The design system is kept unchanged.

**Tech Stack:** NestJS 11, Next.js (App Router), Expo SDK 52, PostgreSQL 16 with Drizzle, Keycloak 26, Redis and BullMQ, MinIO, OpenBao Transit (pending owner approval), Jest.

**Spec:** `docs/specs/2026-10-04-permitwiseai-v2-prd.md` (v0.4, approved 2026-10-04).

## Why one plan per phase

The PRD spans six phases and 194 requirement IDs. Later phases build on interfaces that earlier phases create: the context runner, the permission service, the engine's step instances, the offline queue. A bite-sized plan for Phase 5 written today would name functions that do not exist yet, and it would be wrong by the time Phase 5 starts. So each phase's plan is written when the phase before it has shipped, against the real code. This roadmap fixes three things in the meantime:
- the scope of each phase;
- the exit criteria of each phase;
- the tests each phase must contain.

Phase 1 is split into 1a and 1b, as PRD §19 allows. No security work moves later: 1a builds the database security core and 1b builds identity and sessions. Both finish before Phase 2 starts.

## Before Phase 1a (owner decisions)

**PRD v0.5 (D31) approved** by the owner on 2026-10-04: the sign-in identity is separate from optional contact details. **Execution:** subagent-driven, approved the same day.

O1 to O4 are settled (owner, 2026-10-04). O5 stays a hard gate: no counsel outcome is recorded yet.

| # | Decision | Status and default |
|---|---|---|
| O1 | v1 baseline | Done 2026-10-04: the UI work is committed as `b34fa03` on `feat/mobile-ui-refresh` and `dev_ram`, tagged `v1-final` and deployed to the dev server. Local `main` (`acaae2a`) is not the v2 base. **v2 starts from `v1-final`.** |
| O2 | Key service for NFR-SEC-003 | Approved: OpenBao Transit, self-hosted. Dev mode is for disposable local data only. Persistent storage, an unseal procedure and an application token limited to `datakey` and `decrypt` are prerequisites of the Phase 3 pilot. Alternative: a cloud KMS, which changes only `KeyService`. |
| O3 | Branch and environment | `v2` branch from `v1-final`, phase branches into `v2`. A separate git worktree with its own Compose project (`ptw-v2`), so v2 has its own volumes and `.env` and never touches the local v1 database. Ports stay the same, because the 8 GB machine cannot run both stacks; stop the v1 stack while working on v2. The dev server stays on v1 until the approved Phase 3 pilot. |
| O4 | Commits during execution | Authorised: small task commits after the task's tests, `/ponytail-review` and the task review, once commits are authorised for the execution session. A commit never implies a merge or a deploy. |
| O5 | Counsel review (R4) | A hard gate. Counsel's accepted outcome on the lawful basis per category, the notice text and the translations is recorded in `findings.md` before Phase 1a Tasks 13 and 14 (consent, notices, health data, personal-data service) start. Tasks 1 to 12 model no health data and proceed meanwhile. If counsel changes the PRD, the PRD is amended first. Counsel also confirms the employment basis of the sign-in identity (D31). |

Open product decisions, which do not block Phase 1:
- **D-3, launch industry libraries:** needed before Phase 2.
- **D-1, prices:** needed before Phase 6.
- **D-2, data residency:** needed before the first customer who requires in-country hosting.

## Rules every phase follows

1. **Isolation and schema tests.** Every new table gets a policy, a row in `createTenantGraph` and a classification in the isolation suite. The schema test and isolation suite must stay green. They are catalogue-driven, so an unclassified table fails CI. Tables holding permit, crew or people data also get the agency-path cases (PRD §19).
2. **Context only.** Every query goes through `ContextDb.run` or `forEachTenant`. Neither the raw connection nor the pool is exported (NFR-SEC-008). Every new policy requires `(SELECT app_context_valid())`, so an incomplete or inconsistent context reads and writes nothing.
3. **Owner credentials stay out of the API.** Migrations run as a separate step or job with the owner role. `MIGRATION_DATABASE_URL` and `PTW_OWNER_PASSWORD` never appear in a compose service, in the root `.env` or in the API's environment, and the API refuses to start if they do (NFR-SEC-001a).
4. **Full-record data.** Every full-record-only column (FR-PRV-005) is withheld from the API role and read only through `PersonalDataService`, which logs the view (FR-PRV-008). Each such column is listed in the schema test.
5. **Audit.** Every permit action and every configuration change writes `AuditWriter.record` in the same transaction (FR-AUD-001, 002).
6. **Server-side permissions.** Every permit action checks permissions on the server through `PermissionService`, and admin roles never act on permits (NFR-SEC-005, FR-ROL-007).
7. **Design system.** New screens use the existing components and tokens (UX-001, UX-003), with all strings in translation files (NFR-L10N-001). They pass an axe-core scan in all four themes, light and dark (NFR-ACC-001, criterion 9). The token lint (criterion 9) is added in Phase 2 with the first new screens.
8. **Time.** Time-based behaviour reads the single clock from Phase 3 onwards (NFR-TST-001), and tests move that clock rather than waiting.
9. **Startup.** Each phase's exit includes the provider-resolution test (`tests/app-module.spec.ts`), because a build alone does not prove that Nest can resolve every provider.
10. **Exit walk.** Each exit is walked on the demo data using only that phase and earlier ones, with no database edits and no skipped checks (PRD §19).
11. **Execution.** Each task gets a fresh implementer and an independent reviewer, in order. Each phase ends with a whole-branch review, because credentials, context, consent and queue behaviour cross task boundaries.

## Phases

| Phase | Plan file | Depends on | Status |
|---|---|---|---|
| 1a Data and security core | `2026-10-04-v2-phase-1a-data-security-core.md` (revision 3) | O2–O5 (O5 gates Tasks 13 and 14) | Approved (revision 4); executing Tasks 1 to 12, Tasks 13 and 14 wait for O5 |
| 1b Identity and sessions | written after 1a | 1a, R2 spike | Not started |
| 2 Setup | written after 1b | 1b, D-3 | Not started |
| 3 Workflow and pilot | written after 2 | 2 | Not started |
| 4 Agencies | written after 3 | 3 | Not started |
| 5 Modules | written after 4 | 4 | Not started |
| 6 Finish | written after 5 | 5, D-1 | Not started |

### Phase 1a: Data and security core

**Scope:**
- **Roles and credentials:** database roles in a separate v2 worktree and Compose project, with Metabase removed. Owner credentials stay out of the API, and the API checks this at startup.
- **Context:**
  - the transaction-local context;
  - `app_context_valid()` in every policy, so an incomplete or inconsistent context denies;
  - no raw pool export.
- **Proof:** the schema test and the catalogue-driven isolation suite, including incomplete contexts set directly in the database.
- **Structure:** organisations, legal entities, departments and plants (minimal columns).
- **People:** accounts and person records, with contact columns withheld from the API role.
- **Roles:** roles as permission sets, plant and admin assignments, and `PermissionService`.
- **Audit:** the audit writer.
- **Keys:** the key service and tenant data keys.
- **Jobs:** tenant-scoped jobs, with failed jobs removed at their final failure.
- **Agencies:** the engagement tables and the agency-coverage predicate (the agency-path skeleton).
- **Consent (behind the O5 gate):**
  - lawful basis and versioned notices;
  - consent bound to the wording version and the decision date;
  - one consent operation, which deletes dependent data on any withdrawing decision.
- **Personal data (behind the O5 gate):** the personal-data service, which provides logged reads of sensitive and contact fields, and the access log.

**Exit criteria:**
- The schema test and isolation suite are green across all 18 tables. The suite is catalogue-driven and does not assert a fixed count.
- The first three clauses of criterion 4 are proven:
  - a client selecting every column of any agency table gets no rows;
  - a reused pooled connection leaks nothing;
  - a job without a tenant reads nothing.
- Every incomplete or inconsistent context reads and writes nothing.
- Consent gating, every withdrawal path, consent attribution and the access log are proven.
- The provider-resolution test passes, and `/ponytail-review` and the whole-branch review have been run.

### Phase 1b: Identity and sessions

The plan starts with the **R2 spike**, a throwaway Keycloak 26 realm. It must prove five things, and each finding is recorded before the plan's remaining tasks are fixed:
1. one account in two organisations;
2. per-organisation branding on Keycloak's login page from the slug hint;
3. the active organisation in the token;
4. the mobile authorisation-code flow with PKCE through the system browser;
5. two tenant sessions held at once on one device.

**Scope:**
- **Realm and accounts:**
  - The realm is rebuilt with Organizations. The web and mobile clients use the code flow with PKCE, and the password grant is off for every client.
  - Admins must use MFA (NFR-SEC-009).
  - A SECURITY DEFINER `app_account_for_subject` creates the account at first sign-in; a membership lookup lists the account's person records.
- **Sessions and permissions:**
  - A server session holds the active tenant, chosen from verified person records (NFR-SEC-006).
  - A permission guard replaces `RolesGuard`, with a Redis permission cache keyed by account and tenant, invalidated on change, with a 5-minute ceiling (NFR-SEC-007).
- **Web sign-in:**
  - Branded sign-in at `/<slug>`, with no account enumeration (FR-ONB-014, 020).
  - A tenant picker and switcher that clears caches on switch (FR-ONB-016; the work-queue counts arrive in Phase 3).
  - "You don't have access to <name>" for slugs the account has no record in.
- **Mobile sign-in:**
  - By email, without a slug, with a tenant choice remembered per device.
  - Per-tenant sessions (FR-ONB-018; offline queue tagging in Phase 4).
- **Logging and seed:**
  - Structured logs carry tenant and account, never personal data (NFR-OBS-001).
  - A new demo seed: one organisation, one legal entity, one plant, people in each default role, one agency with an engagement, and Keycloak users whose subjects match the seeded accounts.

**Exit criteria (PRD §19 Phase 1):**
- A person signs in at a slug on the web and by email on mobile, and sees only their tenant.
- An account with two tenants switches without signing in again.
- The R2 spike items pass.
- The isolation suite and schema test are green.

### Phase 2: Setup

**Scope:**
- **Onboarding:**
  - Access requests with recorded verification; tenant creation with the industry library and the platform default workflow; trial start (FR-ONB-001 to 003).
  - The organisation and legal-entity setup checklists (FR-ONB-005, 006).
  - Go-live checks (FR-ONB-007).
- **Structure:**
  - Organisation and legal-entity details (FR-ORG-001 to 003, FR-LE-001 to 003).
  - The legal-entity reporting parent with cycle refusal (FR-LE-002).
  - Departments, plants with Setting up, Live and Retired status, places and machines, retired rather than deleted (FR-PLC-001 to 003, 005, 006).
- **Lists:**
  - The industry library, then the organisation standard, then a legal-entity copy.
  - "Updates available", with accept or decline per item or by filter, and "Needs workflow change" (FR-LST-001 to 006, criterion 6).
- **Numbering:** patterns and sequences (FR-ONB-011, 012).
- **Email and branding:**
  - Email servers under NFR-SEC-011, with fallback (FR-LE-004).
  - Encrypted credentials through a narrow secret service exported by the privacy module (NFR-SEC-003).
  - Themes and logos (UX-002); file storage under tenant and legal-entity prefixes (NFR-SEC-010).
  - Module switches (FR-WFD-013).
- **People:**
  - People management and spreadsheet import, which rejects consent fields (FR-ONB-009).
  - Plant assignments across legal entities (FR-PPL-002), and the full profile fields (FR-PPL-003).
  - Full-record-only fields (hire details, reporting manager and the like) are withheld from the API role and read through `PersonalDataService`, with logging (FR-PRV-005, 008, roadmap rule 4). Phase 2 completes FR-PRV-005 and 008 for every profile field that exists by then.
  - **Consent on writes:** every writer of a field whose category relies on consent checks `ConsentService.hasConsent` under the person-row lock. This includes contact details when a legal entity bases contact on consent. New stored fields, such as the person photo, are added to `CATEGORY_FIELDS` so that withdrawal deletes them.
  - **Sign-in identity (D31):** the people screens keep the sign-in email (identity, employment basis) apart from optional contact details. Withdrawing contact consent deletes optional contact details only. The person keeps sign-in, tenant access, roles and permit duties.
  - Admins cannot change their own role assignments (FR-ROL-008).
  - Removing the last holder of a role warns, then blocks the plant (FR-ONB-017).
  - Invitations as single-use 7-day links bound to a verified email (FR-ONB-010, 019).
- **Roles:**
  - The five default roles created for each new legal entity.
  - The role editor: rename, change, create and retire, saved as a draft that goes live through the role checks (FR-ROL-002, 004).
- **Privacy screens:**
  - Lawful basis, notice publishing and translations (FR-PRV-001).
  - Consent at first sign-in, and the re-prompt (FR-PRV-002, 011).
  - Telling the admin about a withdrawal.
- **Rule checker** in `packages/shared`, as pure functions over a workflow definition, the lists and the staffing:
  - every role check in §9.2, every workflow check in §9.1 and the warnings in §9.3 (FR-CHK-001, 002).
  - All of them are needed here, not only role checks and check 3. FR-LST-004 and criterion 6 refuse a library update that raises a risk level or an isolation or gas minimum while the active workflow would then fail. That decision needs checks 7 and 9 (and 2), not only the staffing check 3.
  - The platform default workflow is loaded as data, and each new legal entity's first version is active from creation (FR-WFD-001), so plants can go Live.
  - Phase 3 adds the designer, dry run, versioning and activation on top of the same functions.
- **Lint:** the colour, radius and font token lint (criterion 9).

**Exit criteria:**
- A new organisation goes from access request to a legal entity with a Live plant and people, with no database edits (PRD §19).
- Criteria 1 and 6. For criterion 6, the "Needs workflow change" refusal comes from the real workflow checks against the active version, with no mocks and no database edits.

### Phase 3: Workflow and pilot

**Scope:**
- **Clock (NFR-TST-001):**
  - One clock for API, jobs and the database. The database reads `app_now()` through a context setting, so policies and checks move with the test clock. `app_agency_covers_plant` switches from `current_date` to it.
- **Workflow engine** (FR-WFE-001 to 011):
  - Step instances with up to three ordered parts; the fixed safety order; pools.
  - Send back, defer, reject, reassign, condition re-evaluation and scope-edit restarts.
  - Timers in the plant's time zone as BullMQ jobs, with ID-only payloads.
  - Every permit action checks segregation of duties by account (FR-ROL-005), delegation (FR-ROL-006) and required certificates (FR-ROL-009).
- **Designer:**
  - Step list with Move up and Move down buttons and drag; parallel groups; a side panel; an SVG flow drawn from tokens (FR-WFD-002 to 012, 014 to 018).
  - The Phase 2 rule checks run live beside each step; dry run; versions; activation; rollback.
- **Permit lifecycle** on the engine, reusing the v1 wizard, execution and closure screens from `v1-final`:
  - The wizard is split by role (UX-004): coordinator raise, receiver receive, check sheets per part (FR-PTW-001 to 004, 006, 007).
  - Pickers (FR-ROL-003).
  - The new statuses Awaiting receiver and Issued (§10.5).
- **Crew (internal, online):**
  - Briefing acknowledged in the person's own name, check-in and check-out, and inductions (FR-CRW-001, 003, 005, 008, 011, 012).
  - The date of Issue counts as revalidation, and the issue lapses at the end of that date (FR-CRW-006, date of Issue only).
  - One check-in at a time for internal crews, and the end-of-day flag (FR-CRW-007, internal part).
- **Safety actions:**
  - Stop work, making safe, handover, cancel and expiry, with the end time checked on every action in every status (FR-PTW-008 to 014).
  - Gas validity (FR-GAS-001, 002).
  - The outside isolation certificate while LOTOTO is off (FR-LTO-105).
- **Privacy on permits:**
  - The emergency subset on the permit, online, through `PersonalDataService` with purpose `emergency`. This includes the 72-hour post-incident window for people recorded as involved (FR-PRV-006, online part).
  - The assignment card (FR-PRV-005a).
  - Certificate expiry warnings and blocks (FR-PRV-010).
- **Messages and work queue:**
  - The basic incident report: record, notify, stop work (FR-INC-101, basic part).
  - Step messages and CC lists through the legal-entity email server, and notification preferences with forced channels (FR-NOT-101, 102).
  - Notification jobs need recipients' email addresses. They get them through a job-context path added to `app_person_contact` and `PersonalDataService`. The API role still never selects contact columns directly.
  - The work queue as the home page (FR-RPT-001, FR-ONB-015), and tenant-switcher counts (FR-ONB-016).
- **Pilot deployment:**
  - OpenBao with persistent storage and unsealing, and a policy-limited token.
  - The new database roles and secrets in `/opt/ptw/.env`, with values never printed.
  - The role passwords go in the server's `infrastructure/postgres/.env`.
  - Migrations run as a one-off job, with `MIGRATION_DATABASE_URL` set only for that job (`node app/dist/database/migrate.js`).
  - The API image contains no credential: the Phase 1a test scans `app/src`. The running API never receives owner credentials.
  - Check-in photos and location results, when they first rely on consent, are added to `CATEGORY_FIELDS` (Phases 3 and 4).
  - Deployed as `deploy@200.234.45.51`, never as root. No test data on the server.
  - Owner approval is needed before deploying.
- **Pilot gate** (PRD §19): the data processing agreement, grievance contact, breach process and DPIA are in place (FR-PRV-012 to 015).

**Exit criteria (PRD §19):**
- A legal entity edits, tests and activates a workflow.
- An internal-crew permit runs end to end on web and mobile, including check-in, stop work and making safe.
- In-flight permits keep their version.
- Criteria 2 and 11 pass, and criterion 12 passes online (the online half of sign-off scenario 2).

### Phase 4: Agencies

**Scope:**
- **Agencies and engagements:**
  - Agency tenants and onboarding (FR-AGY-001, 002; FR-ONB-004, 008).
  - Engagement invitation by search or verified domain, nominated receivers, the 14-day and 1-day notices, and extension (FR-AGY-003, 004).
  - One queue across clients (FR-AGY-005).
  - The column-limited client view of agency staff through NFR-SEC-002 (b) (FR-AGY-006, FR-PRV-007).
  - Agency roles limited by role check 9.2-3 (FR-AGY-007).
  - Wind-down and End now (FR-AGY-008).
  - Snapshots (FR-AGY-009) and agency attendance (FR-AGY-010).
- **Cross-tenant paths:** all four NFR-SEC-002 paths are built and covered by the isolation suite.
  - (a) Agency read and write on assigned permits.
  - (b) A SECURITY DEFINER view of agency staff for the client.
  - (c) Client check-out of agency workers.
  - (d) Late submissions, which land in "Received after access ended", with function-issued presigned URLs for evidence.
- **Offline store** (§18, NFR-OFF-001):
  - Rebuilt, encrypted with a SecureStore key, and partitioned by account and tenant.
  - Wiped on sign-out and after 7 days without a sync; queued actions are never wiped and are tagged with tenant and account.
- **Offline crew:**
  - Offline check-in with the crew copy and server re-checks on sync, "Refused on sync" and "Late sync" (FR-CRW-002, 009, 010).
  - The offline emergency-subset cache, which expires on the monotonic clock (FR-PRV-006, offline part).
  - The offline headcount (FR-CRW-007).
  - Mobile per-tenant queues (FR-ONB-018, complete).
- **Agency crew work:**
  - Substitutes (FR-CRW-004) and agency insurance blocks (FR-CRW-003, complete).
  - Daily revalidation from the second date (FR-CRW-006, FR-MDP-101).
  - Agency handover (FR-PTW-013, agency part).
  - Offline device-time comparison against the end time (FR-PTW-012, offline part).

**Exit criteria (PRD §19):**
- An agency crew works a client permit for three days, with a substitute on day 2 and an offline check-in on day 3.
- Criteria 3, 4 (all clauses), 5 and 12 (all clauses) pass.
- Sign-off scenarios 3 and 4 pass.

### Phase 5: Modules

**Scope:**
- **LOTOTO:**
  - Procedures per machine (FR-PLC-004, FR-LTO-101).
  - Perform and verify by different accounts, also checked offline (FR-LTO-102).
  - Shared isolation points with server-granted holds and atomic restoration (FR-LTO-103).
  - Personal locks (FR-LTO-104).
- **SIMOPS:**
  - Rules per legal entity with lineage (FR-SIM-101), evaluated within a plant only (FR-SIM-102).
  - Every trigger in FR-PTW-005, including the nightly per-tenant job.
- **Multi-day:** extension and renewal ([v1 FR-MDP-009]).
- **Incidents and notifications:**
  - Full incident investigation ([v1 FR-INC-001 to 011], FR-INC-101, complete).
  - v1 notifications re-scoped.
  - v1 module code is restored from `v1-final` and adapted to legal-entity and plant scope.

**Exit criteria (PRD §19):**
- The v1 acceptance scenarios for each module pass on the new model.
- Criterion 8 passes.
- Sign-off scenario 1 passes.

### Phase 6: Finish

**Scope:**
- **Reporting:**
  - Legal-entity dashboards with step KPIs, parent roll-up and organisation drill-down (FR-RPT-002 to 004).
  - Exports (FR-RPT-005) and agency reports (FR-RPT-006).
  - The live headcount dashboard (FR-CRW-007).
  - Result caches keyed by tenant and viewer scope (NFR-SEC-008).
- **Billing:** per billable plant, with usage per legal entity and plant (FR-BIL-001 to 005).
- **Privacy jobs and rights:**
  - Own-data download (FR-PRV-003), parent admins seeing reports but not people (FR-PRV-005b), and the retention jobs (FR-PRV-009).
  - Rights requests (FR-PRV-013) and the breach register (FR-PRV-014).
  - The access-log reader and its retention (FR-AUD-004, 006).
- **Platform access:**
  - Platform and support access, with grants, break-glass and MFA (FR-RPT-007, 008).
  - Data-key rotation with background re-encryption (NFR-SEC-003).
- **Trial lifecycle:** trial read-only, suspension and deletion, which never strand live work (FR-ONB-013).
- **Operations:**
  - The deletion ledger re-applied after a restore (NFR-AVL-002).
  - Backups and a monthly restore test (NFR-AVL-001).
  - Monitoring of timers and escalations (NFR-OBS-001).
- **Final checks:**
  - The performance run at the NFR-PRF-001 load, as the API role with RLS on.
  - A full sweep with axe-core (NFR-ACC-001) and translation files (NFR-L10N-001).
  - An OWASP ASVS level 2 check (NFR-SEC-005).

**Exit criteria (PRD §19):**
- All of the §21 acceptance criteria pass, in particular 7, 9 and 10.

## The four sign-off scenarios

Each scenario has an owning phase and a test that must exist before that phase can exit.

| # | Scenario | Phase | Test that must exist |
|---|---|---|---|
| 1 | Hold versus restoration race | 5 | Two transactions, one asking for a hold on an isolation point and one asking to restore it, run concurrently against one point. Exactly one succeeds, because both lock the point row (`SELECT … FOR UPDATE`) before checking the other's state. A granted restoration blocks new holds until it is verified or cancelled. A hold recorded offline does not count until the server confirms it (criterion 8). |
| 2 | Action-time expiry | 3 (online), 4 (offline) | With the test clock, a noon-ending Issued permit and a noon-ending Suspended permit refuse first check-in, resume, issue and progress at 14:00, in every status. Issued and Active permits become Expired; Approved and Suspended permits keep their status, marked "Past end time". Check-out, making safe, release of holds, incidents, the extension request and closure keep working (criterion 12, first half). |
| 3 | Delayed offline submission | 4 | A check-in recorded offline at 11:50 is accepted when synced at 12:30. One synced at 14:01 is accepted and marked "Late sync". An action recorded offline on a permit the server had already suspended at that device time is kept, marked and flagged (NFR-OFF-001). A check-in refused on sync notifies the receiver and coordinator and blocks progress (criterion 12, second half). |
| 4 | Revoked-agency evidence | 4 | After End now, an action and an evidence file queued on an agency device reach "Received after access ended" through path (d), using a presigned URL that the function issues. The device sees only "Delivered for review". The agency's ordinary reads and writes on that permit fail. A submission for a permit the account was never assigned to is refused. Each submission is logged in both tenants (criterion 4, last clause). |

## Acceptance criteria (PRD §21) by phase

| Criterion | Phase |
|---|---|
| 1 Onboarding to two legal entities with Live plants | 2 |
| 2 Workflow change, failing checks, dry run, activation, old version kept, escalation by test clock | 3 |
| 3 Agency hot-work permit end to end, offline check-in, substitute, stop work, closure | 4 |
| 4 Isolation proofs | 1a (select every column, pooled reuse, job without tenant); 4 (path c, path d) |
| 5 Emergency subset windows, access log, withdrawal, offline expiry | 1a (withdrawal); 3 (online windows); 4 (engagement end, offline) |
| 6 Library updates accepted, declined and propagated; "Needs workflow change" | 2 |
| 7 Dashboards and invoice breakdown | 6 |
| 8 v1 module scenarios; shared isolation points | 5 |
| 9 axe-core in all themes; token lint; manual keyboard and screen-reader checks | every phase for its screens; 6 full sweep |
| 10 Expired permit after engagement end and trial read-only | 6 (with Phase 4 wind-down) |
| 11 Default workflow passes every check; three-part closure | 3 |
| 12 Expiry in every status; offline device time | 3 (online); 4 (offline) |

## Requirement coverage

Every PRD ID is listed with the phase that completes it. Where work is split, the earlier phase is named first.

| Area | IDs → phase |
|---|---|
| Organisation | FR-ORG-001 to 003 → 2 (slug column in 1a) |
| Legal entity | FR-LE-001 to 004 → 2 |
| Places | FR-PLC-001, 002, 003, 005, 006 → 2; FR-PLC-004 → 5 |
| People | FR-PPL-001, 005 → 1a; FR-PPL-002 → 2 (table in 1a); FR-PPL-003 → 1a sensitive fields, 2 profile, 3 certificates and inductions; FR-PPL-004 → 1a, 1b |
| Agencies | FR-AGY-001 to 010 → 4 (engagement skeleton in 1a) |
| Roles | FR-ROL-001 → 1a; FR-ROL-002, 004, 008 → 2; FR-ROL-003, 005, 006, 009 → 3; FR-ROL-007 → 1a model, 3 enforced on permit actions |
| Onboarding | FR-ONB-001 to 003, 005 to 007, 009 to 012, 017, 019 → 2; FR-ONB-004, 008 → 4; FR-ONB-013 → 6; FR-ONB-014, 020 → 1b; FR-ONB-015, 016 → 1b, 3; FR-ONB-018 → 1b, 4 |
| Lists | FR-LST-001 to 006 → 2 |
| Workflow designer | FR-WFD-001 → 2, 3; FR-WFD-013 → 2; FR-WFD-002 to 012, 014 to 018 → 3 |
| Workflow engine | FR-WFE-001 to 011 → 3 |
| Rule checks | FR-CHK-001 → 2; FR-CHK-002 → 2 (go-live of roles, plants, first legal-entity permit, library updates), 3 (workflow version activation) |
| Permit lifecycle | FR-PTW-001 to 004, 006 to 011, 014 → 3; FR-PTW-005 → 5; FR-PTW-012 → 3, 4; FR-PTW-013 → 3, 4 |
| Crew | FR-CRW-001 → 3, 4; FR-CRW-002, 004, 009, 010 → 4; FR-CRW-003 → 3, 4; FR-CRW-005, 008, 011, 012 → 3; FR-CRW-006 → 3, 4; FR-CRW-007 → 3, 4, 6 |
| LOTOTO | FR-LTO-101 to 104 → 5; FR-LTO-105 → 3 |
| SIMOPS, multi-day, incidents | FR-SIM-101, 102 → 5; FR-MDP-101 → 4; FR-INC-101 → 3 basic, 5 full |
| Notifications, gas | FR-NOT-101, 102 → 3; FR-GAS-001, 002 → 3 |
| Privacy | FR-PRV-001 → 1a, 2; FR-PRV-002 → 1a, 2; FR-PRV-003 → 6; FR-PRV-004 → 1a; FR-PRV-005, 008 → 1a (sensitive and contact fields), 2 (profile fields added then), each later phase for new readers; FR-PRV-005a → 3; FR-PRV-005b → 6; FR-PRV-006 → 3, 4; FR-PRV-007 → 4; FR-PRV-009 → 6; FR-PRV-010 → 3; FR-PRV-011 → 1a, 2; FR-PRV-012, 013, 015 → 3 pilot gate (013 tracking in 6); FR-PRV-014 → 3 process, 6 register |
| Reporting | FR-RPT-001 → 3; FR-RPT-002 to 008 → 6 |
| Billing | FR-BIL-001, 002, 004, 005 → 6; FR-BIL-003 → 2 trial start, 6 expiry |
| Audit | FR-AUD-001, 003, 005 → 1a (used by every phase); FR-AUD-002 → 2; FR-AUD-004, 006 → 6 |
| Security | NFR-SEC-001, 001a, 008 → 1a (extended every phase); NFR-SEC-002 → 1a skeleton, 4; NFR-SEC-003 → 1a, 2 (secrets), 6 (rotation); NFR-SEC-004 → 3 pilot deployment; NFR-SEC-005 → every phase, verified 6; NFR-SEC-006, 007, 009 → 1b; NFR-SEC-010 → 2, 3, 4; NFR-SEC-011 → 2 |
| Other NFRs | NFR-PRF-001 → 6 (budget watched from 3); NFR-AVL-001, 002 → 6; NFR-OFF-001 → 4; NFR-ACC-001, NFR-L10N-001 → every phase, 6 sweep; NFR-OBS-001 → 1b, 6; NFR-TST-001 → 3 |
| UX | UX-001 → every phase; UX-002 → 2; UX-003 → 2 to 4; UX-004 → 3; UX-005 → 3, 4 |

## Risks carried into the plans

| PRD risk | Where it is handled |
|---|---|
| R1 RLS cost and missed policies | 1a schema test and catalogue-driven suite; NFR-PRF-001 run in 6 |
| R2 Keycloak Organizations maturity | 1b starts with the spike; its findings fix the 1b tasks |
| R3 Designer scope creep | 3: fixed step palette, fixed safety order, no free-form diagrams |
| R4 Health data legal exposure | O5: counsel's accepted outcome is recorded before Phase 1a Tasks 13 and 14 build the consent and health-data schema; DPIA before the pilot (3) |
| R5 Customer email servers | 2: NFR-SEC-011 checks, test-send, fallback |
| R6 Spoofed location, back-dated check-ins | 4: flags with receipt time, visible in reports |
| R7 Agency cross-tenant policy branch | 1a predicate and fixture; 4 builds paths a–d as narrow policies and SECURITY DEFINER functions, each in the suite |
