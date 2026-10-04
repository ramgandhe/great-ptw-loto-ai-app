# v2 roadmap and Phase 1a plan review

Date: 2026-10-04

**Verdict: changes required before implementation approval.** The roadmap covers every PRD requirement ID, but the planned security and consent contracts do not yet meet their stated requirements. Keep the phase structure and task-by-task approach; correct the findings below before executing the plan.

Reviewed the roadmap and Phase 1a code examples against PRD v0.4 and the repository instructions. These are findings in proposed code, not claims about deployed vulnerabilities. The two delegated reviewers both stopped with usage-limit errors; this report is the coordinating review only. No reviewer votes or independent approvals are claimed.

## Standards

### PLAN-STD-01 — P1: migration credentials reach the runtime API

[Phase 1a, line 399](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:399) injects both `DATABASE_URL` and `MIGRATION_DATABASE_URL` into the API, including the deployment compose file. The latter authenticates as `ptw_owner`, which has BYPASSRLS. The API can therefore open an owner connection despite its normal connection using `ptw_api`. The schema-role test checks the normal connection and cannot detect this second credential.

This contradicts NFR-SEC-001a and the plan's own comment at line 413: the owner must never be available to the running API. Give owner credentials only to a separate migration command/job. Exclude them from runtime environment files, mounts and workers. Add a runtime-configuration check alongside the database-role test.

### PLAN-STD-02 — P1: partial or inconsistent contexts still grant tenant access

[Phase 1a, line 834](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:834) makes the common policy depend solely on `tenant_id = app_tenant_id()`. Setting only `app.tenant_id` therefore satisfies it even when person, legal-entity scope and acting role are absent. `assertValidContext` also accepts a well-formed foreign person's UUID with another tenant; ordinary tenant-table reads still succeed. Checking that this foreign person holds no permit permission does not prove that the context reads no rows.

NFR-SEC-008 requires missing context to deny access; Review Focus 2 also promises mismatched IDs grant nothing. Define and enforce valid user, job and platform contexts explicitly, without accidentally disabling the intentional person-less job context. Test each omitted setting separately, an empty user scope and a tenant/person mismatch against actual table reads and writes. The current no-tenant tests cover only one missing component. Keep the pool private or expose a narrow health-check operation: line 803 currently exports the raw pool despite the roadmap's context-only rule.

## Spec

### PLAN-SPEC-01 — P2: consent is attributed to wording the person may never have accepted

[Phase 1a, line 3150](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:3150) accepts a category, decision and form key, then unconditionally attaches the latest privacy notice. It cannot record the actual wording version or signature date from an employer-recorded form, as FR-PRV-002 requires. A version-1 form entered after version 2 is published is recorded as consent to version 2. The same mismatch occurs if wording changes between displaying and submitting an in-app consent screen.

Bind the decision to the notice/version actually presented or signed, validate its employer and category, and distinguish the decision date from the server recording timestamp. Test an older signed form entered after publication of new wording and a publication race during in-app consent.

### PLAN-SPEC-02 — P1: the exported consent API can bypass withdrawal cleanup

[Phase 1a, line 3147](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:3147) exposes `ConsentService.record(... decision: 'withdrawn')`. This appends the decision but neither locks the person nor deletes their data. `PrivacyModule` exports that service. After blood group is stored, calling this public method leaves it stored and readable indefinitely; only the separate `PersonalDataService.withdrawConsent` path performs cleanup. No 24-hour cleanup backstop is planned here. This violates the FR-PRV-002 invariant and bypasses the concurrency protection claimed by Review Focus 5.

Use one public withdrawal operation that performs the consent transition and cleanup together; keep the lower-level record append internal. Also validate the applicable basis before deleting: the current cleanup accepts `emergency_contacts` and erases them even though they never depend on consent. Test every exposed withdrawal path, retention of non-consent data, and the concurrent write using assertions on both operation outcomes rather than silently discarding both promise results.

### PLAN-SPEC-03 — P2: full-record privacy is marked complete after testing only encrypted fields

[Phase 1a, line 3283](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:3283) limits the personal-data read API to five encrypted fields. The `people` table already holds plaintext email, phone and other profile fields, with tenant-wide SELECT access. There is no planned authorized, logged full-profile read operation. The test called “shows the full record” reads only `emergency_contacts`.

FR-PRV-005 covers all FR-PPL-003 fields, and FR-PRV-008 covers every personal-data view. Nevertheless, the roadmap marks both complete in 1a. Add the protected, logged profile-read contract, or explicitly split completion into the phase that introduces those readers and make it a prerequisite for exposing profile data. Include same-tenant, different-employer cases and distinguish assignment-card fields from full-profile fields. This finding concerns missing coverage and an overstated completion claim; Phase 1a does not yet expose a profile endpoint.

### PLAN-SPEC-04 — P1: counsel review is not an enforced predecessor to the privacy schema

[Roadmap O5, line 30](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-permitwiseai-v2-roadmap.md:30) schedules counsel “during Phase 1a” while directing implementation of the current defaults. The Phase 1a preamble acknowledges R4 but Task 11 has no explicit counsel completion gate. R4 requires the basis, notice text and translations to be reviewed **before the schema is built**.

Record that review and its accepted outcome as a dependency before implementing the affected schema, at latest before Task 11. If R4 is intended to gate all schema work, keep it before Task 1a starts; do not silently narrow the PRD gate. Remove the unsupported promise that counsel changes can only affect one constant and one CHECK constraint. This is verification of the PRD's gate, not a legal opinion.

### PLAN-SPEC-05 — P2: Phase 2's library-update exit needs checks scheduled for Phase 3

[Roadmap, line 148](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-permitwiseai-v2-roadmap.md:148) gives Phase 2 only the role checks and workflow check 3. All remaining workflow checks arrive in Phase 3. Yet Phase 2 completes FR-LST-004 and acceptance criterion 6, including refusal of unsafe risk/minimum changes as “Needs workflow change”. Those decisions require the active-workflow safety checks, including §9.1 check 9; staffing check 3 cannot detect a missing Safety check or Gas test step.

Move the necessary pure workflow validation into Phase 2, while leaving the designer and execution engine in Phase 3. Prove criterion 6 without substituting mocks for the missing validation or manually editing the database. Alternatively, revise the completion mapping and exit criteria together; an ID appearing in the matrix is not proof that its dependencies exist.

### PLAN-SPEC-06 — P2: failed-job retention is not bounded by seven days

[Phase 1a, line 3832](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:3832) relies on `removeOnFail: { age: 604800 }`. BullMQ performs this cleanup lazily when another job finalizes. A quiet queue can retain the last failed job beyond seven days, contrary to NFR-SEC-008. The proposed test checks only the options object. [BullMQ documentation](https://docs.bullmq.io/guide/queues/auto-removal-of-jobs).

Choose an active cleanup policy that meets the retention bound, or immediate removal if failed-job retention is unnecessary. Test an idle queue across the deadline. Reuse the existing queue infrastructure.

## Verification

- Expanded the roadmap's ID ranges and compared them with explicit PRD definitions: **194 unique mapped IDs, 194 unique PRD IDs, no omissions, extras or duplicate mappings**.
- All 12 acceptance criteria and four requested sign-off scenarios have phase assignments. The corrected 12:30/14:01 offline cases are present. PLAN-SPEC-05 is a dependency problem, not a missing mapping.
- The plan creates **18 tables**, not 17. Its exit list itself contains 18. Correct the roadmap and Task 15 count; retain catalogue-driven checks rather than a fixed count assertion.
- No application, migration, database or OpenBao tests were executed: the proposed implementation is not built. No Docker services, database volumes, git references or application code were changed during this review.
- Reviewed file SHA-256 values: PRD `eadda438a406af669766918a5b03fbd3b183d33280f1a67e8bb0a2d973d82f8a`; roadmap `4bc14210a59b18cce959438fdaa748e59d5f82de207501fdb8138b3144077621`; Phase 1a plan `a4c16cfd5f997f55826367f393fdd396d1543c18b795bce43f854a35ac902b86`.

## Execution and O1–O5 recommendations

Use a fresh implementer and independent reviewer for each task, sequentially. Require a final review of the integrated branch as well: credentials, context, consent and queue behavior cross task boundaries. Keep the final clean-database integration run. A compile-only Nest build does not prove dependency injection or startup; add a module bootstrap check to that exit. Use accurate author/coauthor attribution rather than the plan's hard-coded model name.

| Decision | Recommendation |
|---|---|
| O1: v1 baseline | Refresh this decision against current git state. During review, the UI work appeared committed at `b34fa03`, and `v1-final` points there. Local `main` remains at `acaae2a`; the current branch is `feat/mobile-ui-refresh`. Do not retag or merge automatically. Name the intended v2 starting commit explicitly instead of following the stale “uncommitted work” instructions. |
| O2: OpenBao | Suitable candidate for the envelope-encryption design, subject to the owner's required stack approval. Confine `-dev` to disposable test data. Keep persistent storage, unseal procedures and a narrowly scoped application token as prerequisites for the pilot. OpenBao documents datakey wrapping and dev-mode data loss on restart. [Transit](https://openbao.org/docs/secrets/transit/), [dev mode](https://openbao.org/docs/concepts/dev-server/). The RAM saving is unverified: the current local override already makes Metabase an optional `analytics` profile. |
| O3: branch and environment | Keep phase branches feeding `v2`, and keep the remote dev server on v1 until the approved pilot. Recommend a separate worktree and Compose project, with distinct ports, volumes and environment files. Tasks 1 and 15 explicitly reset the existing local v1 Postgres volume. D4 authorizes a fresh v2 database, but an isolated new volume avoids sacrificing the local v1 setup. These local commands do not themselves reset the remote dev server. |
| O4: commits | Recommend small task commits after the relevant tests and review, once the owner grants execution-session commit authorization. No merge or deployment is implied. Confirm the named `/ponytail-review` capability is available before promising it ran; this review did not run that command. |
| O5: counsel | Make completion of R4 an explicit dependency for the affected schema, as PLAN-SPEC-04 specifies. Scheduling it sometime during implementation does not satisfy that gate. No legal outreach or scheduling was performed. |

Review tally: **Standards 2 P1; Spec 2 P1 and 4 P2.** Eight findings total. The most immediate issue is supplying the API with a credential that bypasses RLS. PRD v0.4 remains the approved planning basis; this report does not approve execution of the current plan or alter earlier vote records.
