# Phase 1a revision 3 verification

Date: 2026-10-04

**The four revision 2 defects are addressed. Revision 3 still needs one product/specification decision and two implementation-plan corrections before approval as written.** Both independent reviewers completed this targeted review; the coordinating reviewer checked their findings and ran the consent-function probe described below. No correction votes are implied.

## Standards

### R3-STD-01 — P2: Task 5 queries a table that Task 6 creates

The new fresh/reused-connection test includes `select ... from legal_entities` at [plan line 1488](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:1488). Task 5 requires that suite to pass while only `organisations` exists. `legal_entities` is introduced in Task 6. The proposed Task 5 run would fail with `42P01: relation "legal_entities" does not exist`.

Build those queries from the existing catalogue-derived `tables` collection, or introduce the additional query in Task 6. Keep the fresh and reused connection cases. Verify Task 5 before applying Task 6's migration, then verify the expanded suite afterwards.

## Spec

### R3-SPEC-01 — P1: deleting optional contact data also removes access needed for permit duties

[Plan line 4398](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:4398) clears `accountId` when deleting consent-dependent contact email. The [roadmap at line 156](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-permitwiseai-v2-roadmap.md:156) deliberately warns that the person loses sign-in to the organisation.

This follows the current FR-PPL-005 coupling between email and crew-only status, but conflicts with [FR-PRV-002 at line 481](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/specs/2026-10-04-permitwiseai-v2-prd.md:481): “Without consent, everything else needed for permits still works.” An active receiver, approver or coordinator cannot perform their duties after losing the verified membership required by NFR-SEC-006. Removing the link also affects the identity used for account-based segregation of duties and the ability to authenticate queued tenant actions. Keeping the account's other tenants intact does not resolve this tenant's loss of access.

**Recommendation: take the identity/contact split offered in the user's message and amend the PRD first.** Keep required Keycloak sign-in identity and verified tenant membership separate from optional contact email/phone. Consent withdrawal deletes the optional contact data, while preserving the account link, tenant access and identity used for permit duties. Counsel must review the purpose and lawful basis of the required identity data; this recommendation is not a legal determination.

Revise FR-PPL-005 so that deleting optional contact details does not convert an existing account holder into a crew-only person. Align FR-PRV-001/002 and the onboarding wording, then update Task 7's email/account constraint, Task 13's cleanup and the roadmap warning. This affects the people schema before Task 13, so “Tasks 1–12 can proceed unchanged” is too broad.

Acceptance checks should cover an active permit-duty holder withdrawing contact consent: optional contact fields disappear; authentication, verified tenant membership, role identity and necessary permit actions remain available; another tenant is unaffected; emergency contacts remain under their separate basis. Later offline acceptance should preserve the existing account/tenant identity of queued actions. Do not weaken RBAC or permit checks to make that scenario pass.

### R3-SPEC-02 — P2: equal in-app timestamps produce an ambiguous consent state

[Plan line 4212](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:4212) uses a strict `>` comparison and keeps the first row when timestamps match. In-app timestamps come from JavaScript `Date`, with millisecond precision. The database permits ties, and [line 4372](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/superpowers/plans/2026-10-04-v2-phase-1a-data-security-core.md:4372) orders only by decision date. The person-row lock serializes writes but does not persist an order for equal timestamps.

Executing the exact `decisionInForce` function extracted from the plan, with grant and withdrawal both at `2026-10-04T12:00:00.123Z`, produced:

| Input order | Result |
|---|---|
| Grant, withdrawal | `given: true` |
| Withdrawal, grant | `given: false` |
| Withdrawal, later-uploaded untimed form | `given: false` — intended behavior |
| Withdrawal, in-app grant one millisecond later | `given: true` — intended behavior |

Give equal-time decisions a deterministic rule: either persist their serialized order or conservatively deny an ambiguous tie containing a withdrawal/withholding. Test both row permutations. Keep the user's intentionally conservative policy for days containing signed forms; that policy is not being reopened by this finding.

## Closure of revision 2 findings

| Finding | Disposition |
|---|---|
| R2-STD-01: owner password in runtime code | Closed at plan level. Migration credentials are mandatory command-specific input, runtime database defaults are removed, production rejects development passwords, and the source scanner is included. |
| R2-STD-02: partial job/platform contexts | Closed at plan level. All four settings are required, `none` represents intentional emptiness, and the completeness check survives both later policy-function replacements. Fresh/reused connection cases are present, subject to R3-STD-01's sequencing fix. |
| R2-SPEC-01: same-day paper-form revival | Closed. The untimed-form branch cannot override a same-day withdrawal. The separate equal-time in-app case is R3-SPEC-02. |
| R2-SPEC-02: contact fields retained after withdrawal | Closed as a deletion defect. Email and phone are now deleted and the profile test checks nulls. The associated account unlink introduces R3-SPEC-01 and should change with the proposed PRD amendment. |

## Verification and owner decisions

- Re-expanded the roadmap coverage: **194 unique PRD IDs, 194 unique mapped IDs**, with no omissions, extras or duplicate mappings. Counted **18 table definitions**.
- Ran only the extracted pure consent function, transpiled with the installed TypeScript compiler and evaluated in a VM. No application tests, migrations, builds or infrastructure operations ran.
- **O2:** recommend OpenBao under the stated disposable-development and persistent-pilot constraints. No component was installed or approved on the owner's behalf by this review.
- **O4 and execution:** recommend reviewed task commits and a fresh implementer/reviewer per task, with a final integrated branch review. Execution-session authorization remains an owner decision; no commits were made.
- **O5:** retain the recorded-counsel-outcome gate before Tasks 13–14. No counsel outcome marker was found in the designated findings file. No review date was invented and no counsel was contacted. The identity/contact amendment should be included in that review.

Reviewed SHA-256 values: PRD `eadda438a406af669766918a5b03fbd3b183d33280f1a67e8bb0a2d973d82f8a`; roadmap `1f4edae6c4f63184dd61b1c375fd79b9585285b0658ae8bd1a6da921df0ffc89`; Phase 1a revision 3 `07f281096cbf3ad163c321d64fc140735a7d12792ba3297b57f77755147bb639`.

Review tally: **Standards: one P2. Spec: one P1 product/specification conflict and one P2 ordering defect.** Only this report and the review log were written; the PRD and implementation plans remain unchanged by this review.
