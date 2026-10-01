# UI/UX Audit: Priority Findings

Review date: 30 September 2026. Baseline: `dev_ram` / `ed8c3cc`. Branch: `feat/ui-ux-simplification`.

## High priority

| Finding | Evidence | Consequence | Planned treatment |
|---|---|---|---|
| Submit can use previously saved data | `frontend/src/components/permit/permit-wizard.tsx:542`: existing permit ID skips draft persistence before submit | User can review changed values while the server submits older values | S0: save authorized changes before transition; regression for edits made after the last save |
| First draft save stores only initial fields | Same component, `persistDraft` at line 404 | Direct section editing/recent-copy flow could report saved while later fields remain only local | S0: create then persist full authorized draft with recoverable failure |
| Setup save language does not match behavior | `organisation/setup/page.tsx:196`; browser screenshots | “Save and exit” saves navigation progress but can discard unsaved embedded data | S3: one explicit entity save; dirty navigation guard; accurate result |
| Setup progress overstates readiness | `lib/organisation/setup.ts`: record-count measures; screenshots | Nonempty catalogues presented as “permits can be raised and approved” | S3: configuration checks with linked dependencies and unknown states; server gates remain authoritative |
| Web/mobile draft flow is incompatible | Web `lib/permit/form.ts` has six steps; mobile has five, no form responses | A shared step index means different tasks; native cannot complete required web check sheets | S0/S6: explicit mapping and template response parity |
| Native edit can shift planned times | `mobile/src/lib/permit/form.ts:40` slices UTC strings; save parses local time | User can unintentionally alter the work window | S0: local-time round-trip regression and correction |
| Critical read errors become empty data | Closure/archive/evidence and some options use catches returning empty arrays | User can mistake unavailable evidence/configuration for absence | S1/S4: independent loading/error/retry states; safe action availability |
| Draft collaboration can overwrite unrelated fields | Current broad form payload and relation replacement on included fields | One participant’s save can include stale data owned by another participant | S0: partial patches plus required aggregate revision/transaction guard; see concurrency-review.md |

## Interaction and information architecture

| Finding | Evidence | Planned treatment |
|---|---|---|
| Setup first field is below the mobile viewport | 390×844 setup screenshot: title, progress, step picker and help precede the form | S3: five direct work areas, compact status, optional help |
| Completion is inferred from navigation | `permit-step-nav.tsx` uses `index < currentStep` | S2: actual completeness and owner labels |
| Permit creation repeats context above entry | Draft banner + six steps + large repeat-work panel in live screen | S2: compact source action and sectioned editor |
| Permit context is repeated across record pages | Detail, journey, review, execution, closure and separate evidence/progress routes | S4: stable workspace with retained discrete actions |
| Closure/archive repeats record headings | Observed in browser and current page/readonly-viewer composition | S4: one header, evidence and decision hierarchy |
| People management loses selected-person context | Directory Manage links to a list, accounts/certificates live elsewhere | S3: one People entry and contextual forms using existing identity links |
| Filter chips crowd mobile lists | Issuer permit screenshot; multiple status/stage/type toggle groups | S4/S5: one task filter/search, disclose secondary filters with count/clear |
| Validation errors do not lead to the field | String-list summary; FormField lacks error association | S1: inline errors, focused summary, field links |
| Search dialog is manually assembled | `layout/command-palette.tsx`: initial focus but no trap/return mechanism | S1: reuse installed accessible dialog primitives and keyboard checks |
| Generic buttons are small for field touch use | `ui/button.tsx` sizes are 24–36 CSS px | S1/S6: coarse-pointer/native target treatment while retaining compact desktop layout |
| Native home leads with implementation diagnostics | `mobile/app/(app)/(tabs)/index.tsx` | S6: role-relevant tasks; existing Platform page for diagnostics |
| Native operational forms request raw IDs | Incident detail: investigator/owner IDs; approval location ID | S6: existing authorized directory selectors and readable labels |
| Native themes are inconsistently applied | Operational styles contain hardcoded colors alongside theme provider | S6: semantic tokens and all-theme checks |

## Existing behavior worth retaining

Needs you dashboard, search and jump, role-aware next actions, URL-backed list filters, schedule shortcuts, previous-permit factual copy, existing shared CRUD, auto-generated codes, Add and add another, inline incident/LOTOTO creation, template preview and snapshots, approval-next action, readable status badges, and established offline storage/queues.

## Product-policy inconsistencies

The PRD and current code differ on administrator participation, mandatory Safety Officer approval after HOD, and whether rejected permits may be resubmitted. The UX plan preserves existing server behavior and identifies these conflicts explicitly. A policy change needs its own reviewed requirements and tests.

## Baseline validation

- Docker: application and required services started; web HTTP 200; API readiness healthy for database, Redis, MinIO, BullMQ, Keycloak.
- Web TypeScript: pass.
- Mobile TypeScript: four pre-existing TS2339 errors in permit wizard payload handling (lines 143, 144, 145, 163).
- Existing focused Jest suites: 4 passed, 16 tests passed (permit validation, role collaboration, form answers, setup progress).
- Browser scope and screenshots: `browser-review.md`. Native runtime and full 32-variant appearance matrix have not yet been tested.
- No application implementation performed during this planning phase.

## Review revision 2

Entry targets, field-by-field assistance, section-confirmation decision and concrete sketches are in the revised implementation plan. S0→S2 is the first milestone; S1 is built within S2, S3 follows. Native runtime uses a physical phone; Expo Go compatibility does not establish OIDC authentication support.
