# Phase 1a revision 2 verification

Date: 2026-10-04

**Verdict: four findings remain before approval — three P1 and one P2.** Both independent reviewers completed this round. The coordinating reviewer checked their findings against the proposed code and existing packaging. This is document review, not a run of the future implementation or a correction vote.

## Standards

### R2-STD-01 — P1: the default owner credential still ships inside the API image

[Plan line 537](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:537) embeds the working development owner password in `app/src/database/migrate.ts`. It matches the database initialization default at line 491. The unchanged [Dockerfile line 24](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/app/Dockerfile:24) copies the entire compiled `app/dist`, including `database/migrate.js`, into the running API image.

Removing the variable from the API environment fixes the original compose injection, but the runtime still possesses the owner credential under the proposed local defaults. The startup guard checks environment variables and its current database role; it cannot detect this bundled secret. This does not claim that a separately configured production password is exposed.

**Correction:** require an explicit migration-only connection setting, with no working owner password compiled into application code. Keep the migration credential in the separate process/job. Verify the runtime image and mounts as well as compose environment configuration. The owner connection must be unavailable from the API runtime in the setup used to demonstrate NFR-SEC-001a.

### R2-STD-02 — P2: missing job/platform settings remain valid contexts

[Plan line 1919](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:1919) accepts a raw session setting only `app.tenant_id` and `app.acting_role='job'`. Line 1921 accepts a session setting only `app.acting_role='platform_admin'`. Missing person and scope settings become the same null/empty values as intentionally empty fields. The first context can access tenant rows; the second can access organisation rows. NFR-SEC-008 requires an omitted setting to deny access.

The user-context corrections are substantive: an active person must belong to the tenant, scope must be nonempty and tenant-consistent, and the raw pool is private. The new incomplete-context tests omit fields from user contexts, but omit no required fields from otherwise valid job or platform contexts.

**Correction:** distinguish explicitly empty privileged-context fields from missing fields, and apply the completeness check to all three context types. Test the two partial contexts above on fresh and reused connections, while proving that fully initialized job/platform contexts still work.

## Spec

### R2-SPEC-01 — P1: an older same-day form can reactivate withdrawn consent

[Plan line 3892](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:3892) stores `decided_on` as a date. [Line 4157](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:4157) orders decisions by that date and then by server recording time.

A person signs a grant at 09:00, withdraws in the app at 12:00, and their admin uploads the morning form at 16:00. Both decisions have the same date, so the later upload becomes effective. `hasConsent` becomes true and health-data writes are permitted again, despite the person's later withdrawal. The historical-form test covers a previous week, which avoids this tie.

**Correction:** preserve sufficient decision ordering or conservatively prevent an ambiguous historical grant from overriding a same-day withdrawal. Add this exact scenario and prove that consent remains withdrawn and a subsequent health-data write is refused. Do not use receipt time as evidence that the person made a new decision.

### R2-SPEC-02 — P1: withdrawing contact consent leaves email and phone stored and readable

The lawful-basis operation supports `contact` with a `consent` basis, and the public consent operation accepts withdrawal for it. However, [plan line 4136](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:4136) clears only fields mapped through `SENSITIVE_FIELDS`. That list contains no contact field, so the update is skipped. `people.email` and `people.phone` remain stored, and [readProfile at line 4527](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:4527) continues to return them.

**Correction:** extend the withdrawal contract to every supported field whose basis is consent, including contact fields already present in Phase 1a. Handle the email/account constraint explicitly; do not accidentally revoke unrelated tenant memberships. Test a contact grant, contact storage, withdrawal through the public operation, deletion within the required bound, and subsequent profile reads. Preserve emergency contacts under their non-consent basis.

## Disposition of the original findings

| Original finding | Revision 2 disposition |
|---|---|
| PLAN-STD-01: runtime owner credentials | Compose injection fixed; incomplete overall because the default credential remains in the runtime image. R2-STD-01. |
| PLAN-STD-02: partial/mismatched contexts | User-context and pool-export defects fixed; completeness for jobs/platform remains open. R2-STD-02. |
| PLAN-SPEC-01: wording/date attribution | Original defect closed: explicit notice ID, employer check and separate decision date. A new same-day ordering defect remains. R2-SPEC-01. |
| PLAN-SPEC-02: withdrawal bypass | Alternate path removed, person lock shared, emergency-contact protection added. Cleanup remains incomplete for consent-dependent contact fields. R2-SPEC-02. |
| PLAN-SPEC-03: full-profile read coverage | Closed at plan level: restricted contact-column grants, database eligibility check, service logging and explicit completion split for later profile fields. |
| PLAN-SPEC-04: counsel predecessor | Dependency is explicit before Tasks 13–14. This closes the missing plan gate; it does not establish that counsel review happened. |
| PLAN-SPEC-05: Phase 2 rule-check dependency | Closed: all pure rule checks now precede the Phase 2 exit. |
| PLAN-SPEC-06: failed-job retention | Closed at plan level: removal at final failure and a real-queue test replace lazy age-only retention. |

## Verification and decisions

- Re-expanded the coverage matrix: **194 unique PRD IDs and 194 unique mapped IDs**, with no missing, extra or duplicate mappings. Counted **18 CREATE TABLE statements**.
- Verified the separate `v1-final` worktree/Compose project plan, private pool, real queue test, provider-resolution exit and final branch review.
- Searched the designated `findings.md` for the counsel outcome marker; no match. The gate remains pending. No counsel date or legal approval was inferred.
- Recommend the stated subagent-driven build with a final integration review after these corrections. O2 remains technically reasonable under the previously documented OpenBao constraints. O4 remains an owner execution-session decision. This review grants no commit or deployment authorization and starts no implementation.
- No application tests, database migrations, image builds or infrastructure commands were executed. The only writes in this round are this report and the review-log entry.

Reviewed SHA-256 values: PRD `eadda438a406af669766918a5b03fbd3b183d33280f1a67e8bb0a2d973d82f8a`; roadmap `b24ff771e80b4bcfaef732a254dbd69b3c6c67fcb321c4b01034becedc08d018`; Phase 1a revision 2 `3b6456da75e5bc46b747a5f58c03d1877dddbc446b17c037a86e39672f56e305`.

Review tally: **Standards: one P1, one P2. Spec: two P1.** The two completed reviews are independent assessments, not two-of-three votes on proposed corrections.
