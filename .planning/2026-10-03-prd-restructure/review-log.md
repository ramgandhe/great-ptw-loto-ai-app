# Review log: PermitWiseAI v2 PRD v0.1 → v0.2

Rule (owner): apply a change when at least 2 of 3 reviewers agree.
Reviewers: R1 PTW domain and process safety; R2 architecture, security and privacy; R3 UX, operations and delivery.
Round 1: reviewer-1.md, reviewer-2.md, reviewer-3.md. Round 2: votes-1.md, votes-2.md, votes-3.md.

## Findings (45)
Each reviewer's own findings count as agree.

| Finding | Severity | R1 | R2 | R3 | Result |
|---|---|---|---|---|---|
| R1-01 Safety steps before Issue; first-response groups | blocker | own | agree | agree | Applied |
| R1-02 Crew side cannot clear needs; scope edits invalidate | blocker | own | agree | agree (amend) | Applied |
| R1-03 Making safe; expiry; closure; headcount | blocker | own | agree (amend) | agree | Applied |
| R1-04 Shared isolation points; personal locks | blocker | own | agree | agree | Applied |
| R1-05 Escalation default; admins hold no permit permissions; NI-04 | blocker | own | agree | agree | Applied (C1 base) |
| R1-06 Segregation of duties gaps | blocker | own | agree (amend) | agree | Applied |
| R1-07 Engagement end strands crew | blocker | own | agree (amend) | agree (amend) | Applied (C2 base) |
| R1-08 Stop work; resume re-checks | major | own | agree | agree | Applied |
| R1-09 Gas validity; revalidation before check-in | major | own | agree | agree | Applied |
| R1-10 Handover of duties | major | own | agree | agree (amend) | Applied (C4 base) |
| R1-11 Role competence; induction; own-name briefing | major | own | agree (amend) | agree (amend) | Applied |
| R1-12 SIMOPS triggers | major | own | agree (amend) | agree | Applied |
| R1-13 Missing permissions; cancel | major | own | agree | agree | Applied |
| R1-14 Emergency subset timing and receiver | major | own | agree (amend) | agree | Applied |
| R1-15 Trial expiry keeps safe close-out; export | major | own | agree (amend) | agree | Applied (C3 base) |
| R2-01 DB roles bypass RLS | blocker | agree | own | agree | Applied |
| R2-02 Transaction-local context; cache; jobs | blocker | agree | own | agree | Applied |
| R2-03 Agency data paths; column-limited view | blocker | agree (amend) | own | agree (amend) | Applied (C10) |
| R2-04 Lawful basis; consent; withdrawal; translations | blocker | agree (amend) | own | agree (amend) | Applied (C5 base) |
| R2-05 Retention vs audit; backups; deletion export | blocker | agree (amend) | own | agree | Applied |
| R2-06 Account vs person; invitations; PKCE; MFA | major | agree | own | agree (amend) | Applied |
| R2-07 Key management; encrypted field list; files | major | agree | own | agree | Applied |
| R2-08 Who sees personal data; support access | major | agree | own | agree | Applied |
| R2-09 Snapshots for client safety records | major | agree | own | agree | Applied |
| R2-10 Offline store rebuilt | major | agree (amend) | own | agree (amend) | Applied |
| R2-11 Controller/processor; rights; breach; transfer | major | agree | own | agree (amend) | Applied |
| R2-12 SMTP SSRF; outside CC content | major | agree | own | agree | Applied |
| R2-13 Security foundations into Phase 1 | major | agree | own | agree (amend) | Applied (C6) |
| R2-14 Performance load model | minor | agree | own | agree (amend) | Applied (C8) |
| R2-15 §18/§23 factual corrections | minor | agree | own | agree | Applied |
| R3-01 Escalation semantics; reassign | blocker | agree (amend) | agree (amend) | own | Applied (merged into C1) |
| R3-02 Plant status; removal never refused; department | blocker | agree | agree (amend) | own | Applied |
| R3-03 Consent before data; crew-only records | blocker | agree (amend) | agree (amend) | own | Applied (merged into C5) |
| R3-04 Phase order; pilot | blocker | agree (amend) | agree (amend) | own | Applied (C6 base) |
| R3-05 Offline check-in behaviour | major | agree (amend) | agree (amend) | own | Applied (C7) |
| R3-06 Tenant switching; deep links; mobile sign-in | major | agree (amend) | agree (amend) | own | Applied without the client-theme sentence (C10) |
| R3-07 Pickers vs pools | major | agree (amend) | agree | own | Applied |
| R3-08 Step needs; default permissions; fixed admin roles | major | agree (amend) | agree | own | Applied (C9 base) |
| R3-09 Updates across levels | major | agree (amend) | agree | own | Applied |
| R3-10 Conditional step evaluation; wizard split | major | agree (amend) | agree | own | Applied |
| R3-11 Substitutes; extra crew | major | agree | agree | own | Applied (merged into C4) |
| R3-12 Engagement lifecycle | major | agree (amend) | agree (amend) | own | Applied (merged into C2) |
| R3-13 Trial expiry mid-job | major | agree (amend) | agree | own | Applied (merged into C3) |
| R3-14 Verifiable criteria; test clock; flag | major | agree | agree | own | Applied |
| R3-15 Designer accessibility; concurrent drafts | minor | agree | agree | own | Applied |

## Clusters
| Cluster | R1 | R2 | R3 | Result |
|---|---|---|---|---|
| C1 Escalation | merge, base R3-01 | merge, base R1-05 | base R1-05 | Base R1-05 (2/3) plus R3-01's offer, barred-escalation, agency-notify and reassign rules; admins only reassign |
| C2 Engagement end | merge, base R3-12 | merge, base R1-07 | merge, base R1-07 | Base R1-07 (2/3) plus R3-12's de-duplication (verified domains only), nomination changes, notices, extension, End now |
| C3 Trial expiry | merge, base R3-13 | base R1-15 | base R1-15 | Base R1-15 (2/3) plus R3-13 banner and cancel-only, R2-05 export, audit wording, backups and deletion ledger; stop work stays available |
| C4 Handover and substitutes | merge | merge, base R1-10 | merge | R1-10 for handover, R3-11 for substitutes and extra crew, R1-11 own-name briefing; handover is administrative |
| C5 Consent | merge, base R2-04 | merge, base R2-04 | base R2-04 | Base R2-04 plus R3-03 crew-only records, paper consent, re-consent, mobile; deletion within 24 h (R2, R3); emergency contacts never depend on consent (R1) |
| C6 Phases | merge, base R3-04 | merge, base R3-04 | merge | R3-04 table plus R2-13 Phase 1 security; pilot includes stop work, making safe, basic incident report (R1); DPA and breach process before pilot (R2); split Phase 1 if needed (R3) |
| C7 Offline | merge | merge | merge | R2-10 store, R3-05 flow, R1-08 flags; unsynced actions never discarded (R3); device and server receipt times (R2) |
| C8 Performance | merge | merge | base R2-14 | R2-14 load model plus R3-14 device and network profile |
| C9 Permissions | merge, base R3-08 | merge, base R3-08 | merge, base R3-08 | R3-08 tables plus R1-13 permissions; R1-06 agency-forbidden list consistent; defaults checked against FR-ROL-005 |
| C10 Agency tenant context | R2-03 | R3-06 | R2-03 | R2-03 (2/3). R2 dissent recorded as risk R7 with mitigation |
| C11 Emergency subset | R1-14 + R2-08 split | merge | R1-14 + R2-08 | R2-08 FR-PRV-005/005a/005b; R1-14 as FR-PRV-006 (receiver for crew checked in that day); offline encrypted copy wiped at close |

## Minority positions kept on record
- C10: R2 preferred one tenant per session (agency users enter the client tenant through an engagement) because every policy then keeps a single tenant conjunct the schema test can assert. Majority chose R2-03 (agency users stay in their tenant, one queue across clients). Recorded in PRD §22 as R7 with mitigation: the agency path is a separate, narrowly written policy set with its own isolation tests.
- C2: R1 asked that "End now" still go through making safe; R2 asked that it cut agency access at once. Both kept: End now cuts agency access and suspends the permits; the coordinator takes the receiver part and completes making safe (FR-PTW-011).

## Follow-up review — 2026-10-04

Verdict: changes needed before approval. [Follow-up review](follow-up-review.md) records nine open findings: six P1 and three P2, split into Standards (two) and Spec (seven). Two independent reviewers and the coordinating reviewer checked the merged v0.2 requirements against the original findings and votes.

The Applied results above remain the historical v0.1 → v0.2 record. The follow-up identifies contradictory interactions in those changes, including default closure permissions, shared isolation close-out, first-day revalidation, expired-permit protections, End now duties, emergency access, offline data and replay rules, and delivery dependencies. No PRD requirements have been changed, and no new cross-vote or approval is implied. See each follow-up finding for the earlier outcomes it affects.

## Follow-up corrections — votes (rounds 3 and 4) — 2026-10-04

Corrections: followup-corrections.md (FX-1..9). Amendments: followup-amendments.md (A1..A31). Votes: votes-followup-1/2/3.md, votes-final-1/2/3.md.

| Item | R1 | R2 | R3 | Result |
|---|---|---|---|---|
| FX-1..FX-9 | agree (7 with amendments) | agree (7 with amendments) | agree (7 with amendments) | All applied (3/3) |
| A1, A2, A4–A11, A13–A19, A21–A31 | agree | agree | agree | Applied (3/3) |
| A3 daily revalidation | a | a | a | A3a applied: check-in follows the step, checked per action (3/0) |
| A12 unissued agency permit | a | a | a | A12a applied: returns to Raise keeping its holds (3/0) |
| A20 post-incident window | disagree (wants "people recorded as involved") | own | agree | Applied (2/3); dissent recorded as PRD D-5 |
| A27 first version active | agree, with exception stated | agree, with exception stated | own | Applied with the exception written into FR-WFD-001, FR-WFD-016, FR-CHK-002 |

Consequential edits flagged as contradictions in the final round and applied: NFR-OFF-001 "isolation steps except restoration"; NFR-SEC-002 "three paths" with path (c) named in §18, R7 and criterion 4; FR-AGY-006 and NFR-SEC-002(b) refer to FR-PRV-006's conditions instead of restating them; A31 consistent with A3a. R2's note on offline holds recorded as PRD risk R8.

Result: PRD v0.3. Checks: 189 requirement IDs, no duplicates or undefined references; default roles pass rule check 11 for every part and every FR-ROL-005 pair; agency-holdable roles hold no forbidden permission.

## Independent v0.3 verification — 2026-10-04

[v0.3 review](v0.3-review.md): the nine original contradictions are addressed. Three findings remain open: two P1 (R8's offline-hold/restoration race and expiry gates for Issued/Suspended permits) and one P2 (authority to receive queued evidence after End now). The report includes D-4/D-5 recommendations and acceptance scenarios; no PRD requirements were changed or newly approved.

The nine-fix and 31-amendment vote tally is verified, including the sole A20 dissent. All 16 default step-part permission checks and the static default-role segregation checks pass. Counting explicit FR, NFR and UX definitions yields 193 unique IDs (169 FR, 19 NFR, 5 UX), with no duplicate IDs or unresolved explicit references including carried-over v1 requirements; the earlier total of 189 is not reproduced by that counting convention. These are document checks, not a run of the future workflow engine.

## v0.3 corrections — votes — 2026-10-04

Corrections: v0.3-corrections.md (VC-1..3). Votes: votes-v03-1/2/3.md.

| Item | R1 | R2 | R3 | Result |
|---|---|---|---|---|
| VC-1 server-granted holds | agree | agree | agree | Applied (3/3); risk R8 removed as resolved |
| VC-2 end time in every status | agree (amend) | agree (amend) | agree (amend) | Applied (3/3) |
| VC-2 amendment: offline actions judged by device time | — | proposed | proposed | Applied (2/3) |
| VC-3 late agency submissions, path (d) | agree (amend) | agree (amend) | agree (amend) | Applied (3/3) |
| VC-3 amendment: list renamed "Received after access ended" | proposed | proposed | proposed | Applied (3/3) |
| VC-3 amendment: path (d) is one SECURITY DEFINER function checked in the database | proposed | proposed | — | Applied (2/3) |

Single-reviewer amendments applied as consistency edits (each restates an existing requirement so the correction does not contradict it): pre-Issue end-time change is a scope edit under FR-WFE-006 (R1); the issue lapse applies only to a permit still Issued (R1, FR-CRW-006); path (d) evidence uploads use presigned URLs under NFR-SEC-010 (R2).

Result: PRD v0.4. ID count convention: explicitly defined FR, NFR and UX requirements, lettered variants counted separately (FR-PRV-005a/b, NFR-SEC-001a): 194 unique (169 FR, 20 NFR, 5 UX); no duplicates or unresolved references. The v0.3 entry's 189 missed the UX IDs; the v0.3 review's 193 missed NFR-L10N-001 (corrected by the v0.4 sign-off).

## Independent v0.4 sign-off — 2026-10-04

[v0.4 review](v0.4-review.md): approved as the implementation-plan basis. All three v0.3 findings are closed. Two nonblocking text corrections remain: criterion 12's 40-minute delay does not meet the more-than-two-hour Late sync threshold, and §23.2 should describe four cross-tenant paths rather than two. D-1, D-2 and D-3 remain open with their existing deadlines.

Verified all three correction votes and 194 unique FR/NFR/UX definitions, without duplicate IDs or unresolved explicit references including carried-over v1 requirements. Correction to the counting explanation above: the earlier review parser omitted NFR-L10N-001, not NFR-SEC-001a. This is a document-review sign-off; implementation tests remain to be built and run. No PRD edits or commits were made during this review.

## v0.4 sign-off review — 2026-10-04

[v0.4 sign-off](v0.4-review.md): approved as the basis for the implementation plan; VC-1..3 closed. Two text corrections applied to v0.4: criterion 12 now tests "Late sync" with a 14:01 receipt (the 2-hour threshold in FR-CRW-002), and §23.2 says four cross-tenant paths. Plan must carry tests for the hold/restoration race, action-time expiry, delayed offline submission and revoked-agency evidence.

## Roadmap and Phase 1a plan review — 2026-10-04

[Plan review](phase-1a-plan-review.md): changes required before implementation approval. Eight findings: Standards has two P1 (runtime migration credentials and incomplete context denial); Spec has two P1 (withdrawal cleanup bypass and the counsel predecessor gate) and four P2 (consent wording/date attribution, full-profile privacy coverage, Phase 2 workflow-check dependencies and failed-job retention).

Expanded and verified all 194 requirement mappings: no omissions, extras or duplicates. All 12 acceptance criteria and four sign-off scenarios are assigned. The Phase 1a SQL defines 18 tables, not the stated 17. These are document/static checks; implementation tests have not been run.

Both delegated reviewers stopped with usage-limit errors. The report is the coordinating review, with no new votes or independent approvals. PRD v0.4 approval remains unchanged. Recommendations cover task-by-task implementation plus final integration review and O1–O5. Only review documentation was written; no implementation, infrastructure changes or commits were made by this review.

## Plan revision 2 — 2026-10-04

All eight findings in [phase-1a-plan-review.md](phase-1a-plan-review.md) were checked against the plan text and found valid; each is fixed. There was no panel vote: the two delegated reviewers stopped at usage limits, so the owner passed on the coordinating review and every finding was applied on its merits.

| Finding | Fix in the Phase 1a plan (revision 2) or roadmap |
|---|---|
| STD-01 owner credentials reach the API | Role passwords only in `infrastructure/postgres/.env` (read by postgres alone); no `MIGRATION_DATABASE_URL` in any compose service or root `.env`; `assertRuntimeDatabaseRole` makes the API refuse to start with an owner credential or an unsafe role; compose-file test (Task 2) |
| STD-02 partial or mismatched context | `app_context_valid()` in every policy (user: tenant, active person of the tenant, legal entities of the tenant; job: tenant, no person; platform admin: none); incomplete contexts set directly in the database and tested on every table (Tasks 3, 5, 6, 7); pool no longer exported, `ContextDb.ping()` for health |
| SPEC-01 consent wording attribution | `record` takes the notice shown or signed, checks it belongs to the employer, stores `decided_on` (signature date for forms) apart from `recorded_at`; tests for an old form entered after new wording and a stale in-app screen (Task 13) |
| SPEC-02 withdrawal bypass | One consent operation: any decision leaving consent not in force deletes the dependent data in the same transaction, under the person-row lock; categories that do not rely on consent are refused; race test asserts both outcomes (Tasks 13, 14) |
| SPEC-03 full-record privacy | `people.email` and `people.phone` not granted to the API role; `PersonalDataService.readProfile` via `app_person_contact` (checks person or employer admin) with logging; lint keeps the function inside the service; schema test lists full-record columns; roadmap splits FR-PRV-005/008 completion with Phase 2 (Tasks 7, 14) |
| SPEC-04 counsel gate | Consent and personal-data tasks moved last (13, 14) behind a recorded counsel outcome; unsupported "one constant and one CHECK" claim removed |
| SPEC-05 Phase 2 workflow checks | Roadmap: all §9.1/§9.2/§9.3 checks as pure functions in Phase 2; criterion 6 proven with the real checks; FR-CHK mapping updated |
| SPEC-06 failed-job retention | `removeOnFail: true` (removed at final failure; failure logged); real-queue test (Task 11) |
| Table count | 18, catalogue-driven, no fixed-count assertion |
| Other review points | Separate worktree and Compose project for v2 (local v1 volumes untouched); provider-resolution test at every exit; whole-branch review; commit trailer follows the session's attribution |

Requirement coverage re-checked: 194/194. No implementation, infrastructure change or commit was made.

## Independent revision 2 verification — 2026-10-04

[Revision 2 review](phase-1a-plan-review-r2.md): four findings remain before implementation approval, three P1 and one P2. Both independent reviewers completed this round, and the coordinating reviewer verified their evidence. These are review findings, not correction votes.

- Standards: the default owner password is still compiled into the runtime API image (P1); omitted settings still pass job/platform context validation (P2). The compose credential injection, ordinary user-context mismatch and pool-export defects are corrected.
- Spec: an older form uploaded later on the same day can override a withdrawal (P1); withdrawing contact consent leaves email and phone stored and readable (P1). Notice attribution, the single withdrawal entry point, emergency-contact protection, contact-read access controls, the counsel gate, Phase 2 rule-check dependencies and failed-job removal are improved as detailed in the report.

Coverage reverified: 194 unique requirement mappings, no omissions, extras or duplicates; 18 table definitions. No counsel outcome marker was found in the designated findings file. Only review documentation was written. No implementation tests, infrastructure changes, builds, deployments or commits were performed.

## Plan revision 3 — 2026-10-04

All four findings in [phase-1a-plan-review-r2.md](phase-1a-plan-review-r2.md) were checked against revision 2 and found valid; each is fixed. As with revision 2, the findings were applied on their merits (two independent reviews, not a correction vote).

| Finding | Fix in revision 3 |
|---|---|
| R2-STD-01 owner credential in the API image | `migrate.ts` requires `MIGRATION_DATABASE_URL` (no default); `DATABASE_URL` default removed from `configuration.ts`; production check refuses `_dev_password`; new test scans `app/src` for any embedded database credential (Task 2). Local migrations set the variable for the one command; test helpers keep their local default (not in the image). |
| R2-STD-02 partial job/platform contexts | `runInContext` always sets all four settings, using `none` for an explicitly empty value; `app_context_complete()` rejects any missing setting for every acting role; isolation suite builds each case from a complete context with one defect, checks that complete user/job/platform contexts still work, and runs the two partial contexts on fresh and reused connections (Tasks 3, 5, 6, 7). |
| R2-SPEC-01 same-day form overrides a withdrawal | In-app decisions store `decided_at`; forms have only `decided_on`. `decisionInForce`: on the latest decision date, the last timed decision counts; a day with a form counts as consent only if every decision that day is "given". Receipt time is never used. Unit test of the exact scenario, a database test, and a refused health-data write (Tasks 13, 14). |
| R2-SPEC-02 contact withdrawal leaves email/phone | `CATEGORY_FIELDS` lists every stored field per data category (compile-time complete); withdrawal clears contact email and phone and unlinks only that tenant record from the account (FR-PPL-005); test checks the other tenant's record and the account stay, emergency contacts stay, and `readProfile` then returns nulls (Tasks 13, 14). Roadmap: consent check on every Phase 2 writer, admin warning, new stored fields join `CATEGORY_FIELDS`. |

Requirement coverage 194/194; 18 tables. No implementation, infrastructure change or commit was made.

## Independent revision 3 verification — 2026-10-04

[Revision 3 review](phase-1a-plan-review-r3.md): all four revision 2 defects are addressed at plan level. Three findings remain: Task 5 queries a table created only in Task 6 (P2); contact withdrawal's account unlink conflicts with FR-PRV-002's permit-continuity requirement (P1 product/specification decision); equal-time in-app consent decisions depend on row order (P2).

Both independent reviewers completed this round. The coordinating reviewer verified their evidence and executed the exact extracted `decisionInForce` function: the same-day paper-form case remains denied, but equal-timestamp grant/withdrawal permutations produce different results. This was a pure-function probe, not an application or database test run. No correction votes are implied.

Recommendation: adopt the offered identity/contact split through a PRD amendment before changing the affected people schema; preserve tenant membership and permit-duty identity when optional contact consent is withdrawn. O2, O4 and subagent-driven execution remain recommended, subject to owner authorization and the recorded counsel gate. Coverage reverified: 194 unique mappings, no omissions, extras or duplicates, and 18 table definitions. Only review documentation was changed; nothing built, deployed or committed.

## Plan revision 4 and PRD v0.5 draft — 2026-10-04

All three findings in [phase-1a-plan-review-r3.md](phase-1a-plan-review-r3.md) were checked and found valid.

| Finding | Fix |
|---|---|
| R3-STD-01 Task 5 reads `legal_entities` before Task 6 creates it | The fresh/reused-connection test builds its reads from the catalogue `tables` list, so Task 5 runs with only `organisations` and the check grows with each table. |
| R3-SPEC-01 contact withdrawal removed tenant access and permit duties | PRD v0.5 draft (D31, awaiting owner approval): the sign-in identity is separate from optional contact details, relies on employment and never on consent (FR-PPL-003, FR-PPL-005, FR-ONB-010, FR-PRV-001, FR-PRV-002, criterion 5, R4). Plan: `sign_in` data category with a CHECK that it never relies on consent; contact consent covers `phone` only; no account unlink; test of a coordinator who withdraws contact consent and keeps sign-in, membership and role duties, with another tenant and emergency contacts untouched; profile read keeps the sign-in email. Roadmap: PRD v0.5 approval before Phase 1a; counsel confirms the sign-in identity basis. |
| R3-SPEC-02 equal-millisecond decisions depend on row order | `decisionInForce` decides from the decisions that cannot be ordered (a day with a form: all; otherwise those at the latest instant) and requires all to be "given"; tests both row orders. |

No new requirement IDs (194). 18 tables. The PRD amendment is a draft: it needs the owner's approval before execution. No implementation, infrastructure change or commit was made.
