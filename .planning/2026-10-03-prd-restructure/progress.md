# Progress: PermitWiseAI v2 PRD

## 2026-10-03
- Converted Notes2 to text (session scratchpad notes/PermitWiseAI.cloud-Notes2.txt).
- Baselined current PRD and architecture; wrote the register of 8 contradictions, 10 ambiguities, 15 gaps to findings.md.
- Phase 2 started: questions one at a time, most structural first.

## 2026-10-04
- Q1-Q15 answered; decisions D1-D15 recorded in findings.md. Phase 2 complete.
- Phase 3 started: architecture approaches.
- Architecture choices D16 (shared DB + RLS + Keycloak Organizations) and D17 (own step-based workflow engine) approved.
- Design sections 1-6 approved (D18-D23). Phase 3 complete. Phase 4: writing the PRD.
- PRD written: docs/specs/2026-10-04-permitwiseai-v2-prd.md (~8.8k words); self-review fixes applied. Phase 4 complete.
- Phase 5: three reviewers launched (product/safety, architecture/security/privacy, UX/delivery).
- Reviewer 3 (UX/delivery) done: 15 findings (4 blocker, 10 major, 1 minor) in reviewer-3.md.
- Reviewer 1 (PTW domain/safety) done: 15 findings (7 blocker, 8 major) in reviewer-1.md. Overlaps with R3: escalation default (R1-05/R3-01), engagement end (R1-07/R3-12), trial expiry (R1-15/R3-13), handover (R1-10/R3-11).
- Reviewer 2 (architecture/security/privacy) done: 15 findings (5 blocker, 8 major, 2 minor) in reviewer-2.md.
- Round 2 started: vote-instructions.md sent to all three; clusters C1-C11 for overlaps, C10 is a direct conflict (agency user tenant context).
- votes-1.md and votes-3.md in: both agree with all 30 of the other reviewers' findings (amendments noted). All 45 findings reach >=2/3. C1 base split (R1: merge on R3-01; R3: R1-05); C10 both R2-03.
- All three vote files in; every finding 3/3. review-log.md written. PRD rewritten as v0.2 (16.4k words, 189 IDs, no duplicates, coverage check passed for all 45 findings). Phase 5 complete; Phase 6 (owner review) in progress.
- Follow-up review (follow-up-review.md, 9 findings: 6 P1, 3 P2) received from the owner; all 9 verified valid against v0.2. Corrections drafted in followup-corrections.md (FX-1..9); round 3 vote sent to the three reviewers.
- Round 3: FX-1..9 all 3/3 (with amendments); reviewers found new conflicts the fixes would create. 31 amendments consolidated in followup-amendments.md (A3, A12 are either/or); final round 4 vote sent.
- Rounds 3-4 complete; PRD v0.3 written (18.1k words, 189 IDs); consistency checks pass. Awaiting owner review.
- Owner decided D-4/NI-04: option A, no admin override. PRD updated (D27). Next: D-5.
- Owner decided D-5: option A. PRD updated (D28). Open: D-1 prices, D-2 residency, D-3 launch libraries (not blocking approval). Awaiting PRD approval.
- v0.3 review (v0.3-review.md): 3 findings (2 P1, 1 P2), all verified valid; D-4/D-5 recommendations match D27/D28. Corrections VC-1..3 in v0.3-corrections.md; vote sent to the three reviewers. ID count corrected: earlier check missed the 5 UX IDs.
- v0.3 corrections VC-1..3 agreed 3/3 with amendments; PRD v0.4 written; 194 unique IDs (169 FR, 20 NFR, 5 UX), no duplicates. Awaiting owner approval.
- v0.4 sign-off review received (v0.4-review.md); two text corrections applied. Awaiting owner's own confirmation of approval before writing-plans.
- Owner approved PRD v0.4. Phase 6 complete. Next: Phase 7, writing-plans. Owner asked about compacting first.
- Phase 7 started: writing-plans invoked; PRD re-read; code baseline recorded in findings.md.
- Phase 7: roadmap (docs/superpowers/plans/2026-10-04-permitwiseai-v2-roadmap.md) and Phase 1a plan (2026-10-04-v2-phase-1a-data-security-core.md, 15 tasks) written; self-review: 194/194 IDs covered, no placeholders, names consistent. Awaiting owner review, O1-O5 and execution method.
- O1 done (owner, 2026-10-04): field-contrast and wizard work committed as b34fa03 after /ponytail-review (6 of 7 cuts applied; <details> fold deferred), dev_ram fast-forwarded, tag v1-final on b34fa03, deploy to the dev server started as deploy@. Owner still reviewing the roadmap and Phase 1a plan.
- Plan review received (8 findings, all valid). Phase 1a plan rewritten as revision 2 (tasks reordered: consent and personal data last behind the counsel gate), roadmap updated (O decisions, Phase 2 rule checks, FR-PRV-005/008 split). Coverage 194/194. Awaiting owner: O2, O4, O5 and the execution method.
- Second plan review received (4 findings, all valid). Phase 1a plan revision 3 and roadmap updated. Coverage 194/194, 18 tables. Awaiting owner: O2, O4, O5 and the execution method.
- Third plan review received (3 findings, valid). PRD v0.5 draft (D31) and Phase 1a plan revision 4 written; coverage 194/194, 18 tables. Awaiting owner: approve PRD v0.5, O2, O4, O5 and the execution method.
- Owner approved PRD v0.5, plan revision 4, OpenBao, per-task commits and subagent-driven execution. Starting Phase 1a Tasks 1-12.
