# Task Plan: Application UI/UX Simplification

## Goal
Simplify web and mobile data entry, onboarding, page flow, and feedback using existing components and approved themes; preserve validated safety workflows, RBAC, tenant isolation, and auditability. Review the complete plan before implementation.

## Next Step
Review S6 and S7 with the user and commit. Remaining: physical-phone acceptance with a development build (S6/S7), and the Metro expo-router/entry-classic resolution issue blocking a local Android export.

## Current Phase
Phase 4 — S0a implementation

## Phases

### Phase 1: Evidence and coverage
- [x] Create `feat/ui-ux-simplification` from local `dev_ram` at `ed8c3cc`.
- [x] Read repository instructions and requested skills.
- [x] Inventory all web/mobile pages and shared UI.
- [x] Review current documentation, API constraints, and relevant tests.
- [x] Inspect key screens in a browser if the local environment permits.
- [x] Record concrete findings, source references, and coverage limitations.
- **Status:** complete

### Phase 2: Proposed experience and implementation plan
- [x] Define navigation, consolidated workspaces, and reduced-entry forms.
- [x] Map every existing route to a proposed disposition.
- [x] Specify retained safety gates, data ownership, and error recovery.
- [x] Define incremental changes, acceptance criteria, and validation.
- **Status:** complete

### Phase 3: Plan review
- [x] Critically review design, safety, feasibility, and scope.
- [x] Revise the plan and record outstanding product decisions.
- [x] Present the concrete plan for user review before implementation.
- [x] Receive user approval or revisions: revisions requested.
- [x] Complete the revised plan against all review points.
- [x] Present revision 2 with baselines, sketches and review response.
- [x] Obtain approval of revision 2 before implementation: superseded by revision 3, approved 2026-10-01.
- **Status:** complete

### Phase 4: Reviewed implementation
- [ ] Implement only the scope cleared by plan review.
  - [x] S0a backend: draft_revision migration, expectedRevision on PATCH and submit, locked-row checks, transactional answer audit, atomic draft delete.
  - [x] S0a web: full first save, save-before-submit at the saved revision, conflict message with explicit re-save, submit blocked during conflict.
  - [x] S0a native: type errors fixed, local-time dates, web/native step mapping, revision on saves/submits including queued ones, 409 stops the sync queue as a failed item.
  - [x] S0a runtime check in the rebuilt Docker stack (browser): s0a-runtime-check.cjs, 3 runs × 10/10.
  - [x] P2 baseline replay before S2: 1 typed, 31 clicks, 5 views; target ≤21 clicks, 2 views.
  - [x] S2 permit editor: one page, P1 1/10/2 and P2 1/19/2 measured; open items listed in progress.md.
  - [x] S3 setup, sites and people: five areas, parent context, People directory; H1 4/9/2 and E1 2/4/1 measured.
- [ ] Reuse existing shared components, tokens, APIs, and business rules.
- **Status:** in_progress

### Phase 5: Validation and delivery
- [ ] Run relevant type checks and business regression tests.
- [ ] Verify main persona journeys, recovery, keyboard/mobile use, and appearance variants.
- [ ] Report changes, test evidence, and remaining limits.
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|---|---|
| Use an isolated named planning directory | Preserve previous project plans. |
| Treat existing UX audit as historical evidence | Several improvements already exist; verify current code before recommending changes. |
| Plan and review before application edits | Explicit user requirement. |
| Base on local dev_ram | Local branch and cached origin/dev_ram match; no remote fetch performed. |

## Errors Encountered
| Error | Resolution |
|---|---|
| Sandbox denied .git/index.lock during branch creation | Re-ran with explicit sandbox approval; branch created. |
| Broad specification search exceeded output budget | Use bounded section reads and focused searches. |

## Baseline failures
- Mobile type check fails on four accesses to issuer-only properties of the role-filtered payload union (permit wizard lines 143/144/145/163). Include a scoped correction with the mobile form work; do not conceal baseline failure.

## Revision errors
- Two initial focused searches used nonexistent template-fill-step and app/src/db paths. Corrected by enumerating actual files; no source files changed.
