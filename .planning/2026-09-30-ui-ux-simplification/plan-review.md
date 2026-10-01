# Plan Review — Revision 2

## Recorded decision

**User review received: revise before approval.** The earlier “review pending” entry is superseded by the detailed feedback received in this conversation. Revision 2 addresses that feedback; approval of the revised implementation scope has not been received. No independent reviewer approval is claimed.

Application implementation has not started. The first milestone is now S0→S2, with S1 patterns implemented only when consumed by S2. S3 is milestone two; S4–S7 retain the full remaining objective.

## Response to each review point

| Review point | Revision and evidence |
|---|---|
| 1. No baseline or field-level reduction | Added `journey-baselines.md`, completed `journey-baseline-replay.json`, and `field-assistance.md`. P1: 2→1 typed, 13→10 clicks, 3→2 views. H1: 4→4, 18→9, 5→2. E1: 2→2, 6→4, 3→1. Actions normalized explicitly; all replay writes simulated. Necessary new names/emails stay typed. |
| 2. “Smart” undefined | Deterministic assistance selected: derived editable title, location→plant, retained parent context, configured factual prefills, exact duplicate warnings. Generative AI is explicitly outside S0–S7; no AI behavior claimed or hidden provider dependency added. |
| 3. Abstract layout | Added responsive `ux-sketches.html` with before/after permit, setup and People layouts plus selected interactions. Main plan now specifies visible regions, actions and states for the record workspace and each supporting module. |
| 4. First milestone too broad | S0 then S2. Shared interaction work is delivered inside the real permit editor. Setup/People follow in S3. No independent generic-patterns project. |
| 5. Untestable criteria | Exact task targets; 44×44 CSS px web hit areas, 8 px spacing; 48 dp Android/44 pt iOS; 390×844 and 1440×900 checks; 200% zoom; first-milestone Hazard/Control Room smoke; full 32-combination matrix deferred to S7. |
| 6. All yes efficiency | Keep existing section scope, add a confirmation listing the unanswered target questions and actor declaration. Two activations instead of one for batch confirmation, explicitly counted. Preserve No/N/A and signatures. Record answer diffs with server identity/time/revision transactionally. |
| 7. Partial update/concurrency | Verified optional top-level PATCH, whole included-array replacement, no version guard. `concurrency-review.md` requires a bounded revision migration/API change and atomic current-state validation before S2; includes save/submit/evidence races and offline conflicts. Removed “no contract change assumed.” |
| 8. Resource-constrained native testing | Physical phone only; no emulator on the 8 GB Docker host. Matching SDK-52 Android Expo Go for compatible checks. Existing custom-scheme Keycloak flow requires physical-device development-build acceptance per Expo guidance; no auth bypass or major SDK upgrade. |
| Stale AI code-style rule | Corrected `.claude/rules/code-style.md` to reflect feature-local services and absence of the claimed AI directories. |
| Review record still pending | This document now records the actual review and requested revisions separately from final approval. |

## Author critique of revision 2

- Current step navigation already permits jumping. Success is measured by combining related entry into one view and carrying context, not rebranding the wizard.
- Counts are intentionally narrow, reproducible scenarios, not user timing or population-wide savings. The permit scenario ends at issuer handoff; safety preparation and submission remain required and tested separately.
- Hierarchy/person typing does not drop for genuinely new records. Claiming otherwise would require invented data or changed business requirements.
- Concurrency is a real backend prerequisite. Collection replacement and submission races are covered; a UI-only patch is insufficient.
- Safety-answer audit cannot rely solely on the current optional/best-effort logger. Transactional audit is explicitly part of the proposed contract.
- Physical phone testing is feasible without emulation, but Expo Go alone cannot substantiate the existing OIDC login flow. Build/device availability remains a stated validation dependency.
- The sketch is a review artifact. Its counts are design targets, and its interactions are illustrative. It does not prove application behavior.
- Full web/native, theme and role coverage remains required for the full goal; the permit-first milestone does not redefine completion.

## Second review (2026-10-01) and revision 3

Review of revision 2: direction approvable; three must-fix items and four tightening items. The user asked for all of them to be applied.

| Review point | Revision 3 change |
|---|---|
| Must 1. Baseline misses where typing happens | Added **P2 executor preparation** scenario to `journey-baselines.md` (steps 2–4). Baseline is not yet measured and is not invented; replay must be extended before S2. Target: views 3→1, no new typed fields, ≥30% fewer clicks, exact number fixed after baseline. Milestone 1 no longer completes on P1 alone. |
| Must 2. S0 larger than S2, unstated | Split into **S0a** (milestone 1: revision migration, PATCH/submit checks, races, transactional answer audit, both clients) and **S0b** (attachments/MinIO, full offline reconciliation, before S6 closes). Plan states milestone 1 is roughly half backend. |
| Must 3. Required revision breaks older mobile builds | Added rollout section. No EAS/store config in the repo, so default is deploy together with an “Update the app” error. **Open user decision** if any installed build exists outside development: compatibility window with logged missing revisions. |
| Tighten: conflict screen scope | First version shows saved value beside changed fields and re-saves; full compare view deferred. Added to S2 exit cases and concurrency tests. |
| Tighten: audit coverage | One transactional audit path for every answer change, single or batch. Test added. |
| Tighten: title from first sentence | Boilerplate-scope case documented and added to S2 tests. |
| Tighten: repository housekeeping | `.agents/` (locally installed design skills) and `srv-brand-login.png` (screenshot) added to `.git/info/exclude`; nothing deleted. `.claude/rules/code-style.md` correction remains uncommitted pending the user's commit decision. |

## Approval record

- Reviewer feedback: received twice; revisions requested both times.
- Revision: 3, completed against the second review.
- Author recommendation: approve revision 3 with S0a→S2 as the first milestone; S0b, S3 and S4–S7 follow.
- Rollout decision: user approved without naming an installed build outside development, so the default applies (deploy server, web and native together; older clients get an update error). Revisit if one turns up.
- User approval of revision 3: **approved 2026-10-01** ("approved, lets get started").
- Application implementation: S0a started 2026-10-01.
