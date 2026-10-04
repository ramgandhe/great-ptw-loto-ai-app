# Task Plan: PermitWiseAI v2 PRD (restructure around Notes2)

## Goal
A reviewed, approved PRD for restructuring PermitWiseAI around the new thought process in
`~/Documents/PermitWiseAI.cloud-Notes2.odt`, keeping the current UI/UX tokens, design system and
guidelines, and stating how far it departs from the current functional design and technical architecture.

## Next Step
Execute Phase 1a Tasks 1-12 with superpowers:subagent-driven-development in the v2 worktree; per-task commits authorised. Tasks 13-14 wait for the counsel outcome (O5).

## Current Phase
Phase 7

## Phases

### Phase 1: Discovery
- [x] Convert and read Notes2 (text copy in session scratchpad notes/)
- [x] Baseline the current PRD (docs/specs/merged_prd.md) and architecture (migrations, auth, roles)
- [x] Gap / ambiguity / contradiction register in findings.md
- **Status:** complete

### Phase 2: Clarifying questions (one at a time)
- [x] Work through the open items in findings.md, most structural first (Q1-Q15)
- [x] Record each answer as a decision (D-n) in findings.md
- **Status:** complete

### Phase 3: Approaches and design sections
- [x] Propose 2-3 approaches (tenancy, workflow engine, migration) with a recommendation
- [x] Present design sections; user approves each
- **Status:** complete

### Phase 4: Write the PRD
- [x] docs/specs/2026-10-04-permitwiseai-v2-prd.md
- [x] Delta section: functional design vs current; technical architecture vs current (§23)
- [x] UI/UX: keep tokens, themes, components, writing guidelines (§17)
- [x] Self-review: fixed two-part step roles, agency receivers in rule check, mandatory isolation/gas/revalidation steps, risk level definition, stray org role standard
- **Status:** complete

### Phase 5: Three-reviewer review
- [x] Round 1: three independent reviewers write reviewer-1.md, reviewer-2.md, reviewer-3.md in this plan dir (45 findings: 16 blocker, 26 major, 3 minor)
- [x] Round 2: consolidated finding list; each reviewer votes agree/disagree on every finding (own findings count as agree)
- [x] Apply each change with at least 2 of 3 agreeing; log all outcomes in review-log.md (all 45 had 3/3; PRD v0.2, 189 requirement IDs)
- **Status:** complete

### Phase 5b: Follow-up corrections
- [x] Verify the 9 follow-up findings against v0.2 (all valid)
- [x] Draft corrections FX-1..9 (followup-corrections.md)
- [x] Round 3 vote by the three reviewers (votes-followup-N.md), apply >=2/3, check for new conflicts
- [x] Round 4 final vote on 31 amendments (votes-final-N.md)
- [x] PRD v0.3; review-log updated; consistency checks pass
- **Status:** complete

### Phase 6: User review gate
- [x] User reviews the written PRD; changes applied (v0.4 + two sign-off text fixes)
- [x] Owner approved PRD v0.4 on 2026-10-04 (own words: "yes")
- **Status:** complete

### Phase 7: Implementation plan
- [x] Invoke superpowers:writing-plans with docs/specs/2026-10-04-permitwiseai-v2-prd.md (v0.4) as the spec
- [x] Roadmap follows PRD §19 phases 1-6 with exit criteria; Phase 1 split into 1a (data and security core) and 1b (identity and sessions); all 194 IDs assigned to a phase (checked by script)
- [x] Sign-off test scenarios carried: hold vs restoration race (5), action-time expiry (3 online, 4 offline), delayed offline submission (4), revoked-agency evidence (4)
- [x] Phase 1a task plan: 15 TDD tasks with code; per-phase plans written when the previous phase ships
- [x] Plan reviews applied: 8 findings (revision 2), 4 (revision 3), 3 (revision 4, with PRD v0.5 draft); roadmap updated
- [x] Owner approved PRD v0.5 (D31), plan revision 4, OpenBao (O2), per-task commits (O4) and subagent-driven execution (2026-10-04)
- [ ] Execute Phase 1a Tasks 1-12 (subagent-driven); Tasks 13-14 wait for the recorded counsel outcome (O5)
- **Status:** in_progress (awaiting owner)

## Constraints
- Keep: design tokens (frontend/src/styles/themes.css, mobile theme sync), components, writing style.
- Change: functionality per Notes2.
- No code changes in this task; output is the PRD.
- Commit only when the user asks.

## Decisions Made
| # | Decision | Source |
|---|----------|--------|
| D1 | Agencies are tenants linked to client organisations (option A) | User, Q1 |
| D2 | Coordinator raises/issues; Receiver = crew side (crew lead / agency supervisor) accepts; Executor = crew (option B) | User, Q2 |
| D3 | Workflow: org standard → legal-entity version → permit-type variants; permit follows its plant's legal entity (option A) | User, Q3 |
| D4 | Fresh build of the new model in the same codebase; DB reset, demo re-seed, no migration (option B) | User, Q4 |
| D5 | No LLM in v2; self-analysis = deterministic rule checks that gate go-live (option A) | User, Q5 |
| D6 | Step routing by role + place (plant, optional department); escalation per step to a role or named person (option A) | User, Q6 |
| D7 | Personal/health data: collect all with consent, encryption, emergency subset, audit, retention (option A) | User, Q7 |
| D8 | Org pays per active plant, usage per legal entity/plant; agencies free (option A) | User, Q8 |
| D9 | Lists: industry library → org standard → legal-entity copy; org changes offered as reviewable updates (option A) | User, Q9 |
| D10 | Agency crew: in-app daily check-in/out per permit; substitute checked and accepted by coordinator (option A) | User, Q10 |
| D11 | Legal-entity tree for reporting roll-up only; configuration flat from the org standard (option C) | User, Q11 |
| D12 | Mobile = field work (incl. check-in, approvals, execution); setup/designer/billing web only (option A) | User, Q12 |
| D13 | English only (translation-ready), plant time zones, legal-entity country, metric, one currency (option A) | User, Q13 |
| D14 | Slug = branded sign-in; home = personal work queue themed by own legal entity (option A) | User, Q14 |
| D15 | Unfinished note sentences read as proposed (PTW-only scope, identity documents, SIMOPS rules, item 11 empty) | User, Q15 |
| D16 | Shared DB + Postgres RLS + engagement grants; one Keycloak realm with Organizations; roles in app DB (approach A) | User, arch 1 |
| D17 | Own step-based workflow engine with fixed step palette, versioning, dry-run test (approach A) | User, arch 2 |
| D18 | Design §1 structure approved (incl. cross-legal-entity plant assignment, SMTP precedence) | User |
| D19 | Design §2 roles approved (permission-set role editor, segregation of duties) | User |
| D20 | Design §3 onboarding/setup approved (numbering, trial expiry) | User |
| D21 | Design §4 workflows and permit lifecycle approved | User |
| D22 | Design §5 modules, privacy, reporting, billing, audit approved | User |
| D23 | Design §6 architecture, delivery, delta approved | User |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
