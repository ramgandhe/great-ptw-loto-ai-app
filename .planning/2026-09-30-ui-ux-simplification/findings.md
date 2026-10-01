# Findings: UI/UX Simplification

## Baseline
- Branch: `feat/ui-ux-simplification`, based on `dev_ram` / `ed8c3cc`.
- Initial tracked worktree clean; existing untracked `.agents/` and `srv-brand-login.png` belong to the user.
- Web: Next.js 16.2.12 / React 19 / Tailwind 4; mobile: Expo 52 / React Native 0.76.7. No alternative libraries planned.
- Frontend instructions require reading installed Next.js documentation before writing application code.
- Root scripts expose `dev:web`, `dev:api`, `test`, `lint`, `build`; web and mobile lint scripts are TypeScript checks.
- Four approved themes × two modes × two densities × two visual styles.

## Existing improvements to preserve
`docs/ux-audit.md` records a 27 September audit and subsequent changes: Needs you dashboard, grouped navigation, search palette, contextual approval panel, reusable master-data CRUD, existing setup wizard, copied permit context, linked form templates, historical form snapshots, and readable record cross-links. These require source verification rather than a duplicate redesign.

## Constraints
- UI simplification must preserve backend safety validations, explicit lifecycle transitions, immutable form evidence, tenant-scoped access, and role permissions.
- No application implementation before plan review.
- Separate web/mobile coverage and code evidence from browser-tested behavior.

## Evidence and open findings
To be populated during the route and workflow audit.

## Inventory baseline
- 84 web page routes (12,831 page-source lines) and 47 mobile screen routes (5,355 lines), excluding layouts. Shared components require separate inspection.
- Existing legacy redirects already consolidate incident creation/archive, LOTOTO active/restoration, and SIMOPS conflict/history lists; preserve compatible deep links.
- UI Pro Max error-summary results fit: focus the summary on failed submission, link to invalid fields, retain inline errors and entered values.
- Generic Next.js search suggests Server Actions, but this conflicts with this repository’s established NestJS API ownership; retain existing API service pattern.
- Progressive disclosure query returned unrelated results; retry narrowly before treating as guidance.
- No browser MCP exposed; inspect local browser tooling next.
- `frontend/src/hooks` does not exist; hooks live with existing libraries/components.

## Confirmed form/setup findings
- `frontend/src/components/permit/permit-wizard.tsx` has six screens, role-owned sections, explicit draft saving on Next, existing template prefills, recent-permit copy, and schedule shortcuts. Improve its interaction model rather than duplicating form logic.
- `permit-step-nav.tsx` derives completion from step index (`index < currentStep`), not actual validity; progress can overstate readiness.
- `validation-summary.tsx` announces a string list but does not focus it or link to fields; `form-field.tsx` lacks inline error/description wiring.
- `organisation/setup/page.tsx` offers 19 steps, embeds whole route components, shows Next/Skip regardless of unsaved child form state, and displays readiness claims from nonzero record counts.
- Setup failure handling drops rejected measurements; status then treats unknown counts as zero. Unknown must be represented separately from empty.
- Setup `competencies` step renders `CertificationsPage` while its measure reads competencies; verify and correct the mismatch in the reviewed implementation.
- UI Pro Max progressive-disclosure retry remained off-topic. No verified local match; use the repository implementation strategy §12.3 as the design authority.
- Browser modules are absent from project dependencies; existing gstack/browser cache may support read-only inspection. No dependency installation required yet.

## Persistence and environment evidence
- Web `persistDraft` creates only basic fields on first save and returns without saving the rest of the current form; in a nonsequential editor, create must be followed by saving the complete authorized payload.
- Web `handleSubmit` skips `persistDraft` when a permit ID exists, so edits after the last explicit save can submit stale server data. Include a regression case before redesigning submit.
- Current API role ownership is encoded by step index; the proposed UI must preserve field ownership while moving presentation to named sections.
- Mobile wizard uses many hardcoded colors, lacks web template-prefill imports, and defaults its primary executor to the first returned option. Verify before changing behavior.
- No server listens at localhost:3000. Initial localhost probe was sandbox-blocked; approved retry confirmed connection refused. Runtime audit needs a dev server and backend availability.
- Directory searches for nonexistent `frontend/src/hooks` and `components/forms` failed; corrected scope to existing directories.

## Main workflow screen review
- Permit list already has role-based action ordering, URL filters, status/stage/type toggles; avoid rebuilding it. Simplify default filter density and use saved URLs for former standalone queues.
- Separate drafts, active work, execution, approvals, closure, and archive lists largely slice permits by lifecycle; route consolidation should preserve persona-specific queue semantics and archive endpoint behavior.
- Permit detail, journey, review, execution, multi-day, closure, and history repeat context and navigation. Plan one stable permit workspace with permission-aware section navigation, while retaining discrete safety actions and existing endpoints.
- Execution already includes progress entry, evidence upload, completion declaration, and recent progress; its dedicated progress/evidence pages duplicate context.
- Closure/history use `.catch(() => [])` for evidence and audit reads, masking load failures as empty data. Display explicit unavailable/retry states, especially before verification.
- Critical confirmations currently mix browser `window.confirm`, custom dialogs, and inline panels. Standardize semantics and focus behavior without removing confirmations.
- CI branch filters omit dev_ram/feat branches; validation for this branch cannot assume CI runs automatically.

## Remaining web/module source pass
- Admin CRUD already uses compact list-first layouts, name-to-code suggestions, and Add actions. Consolidate related context with these components rather than a second CRUD layer.
- Workforce directory Manage action opens an entire employee/contractor list, losing selected-person context; people, accounts, competencies, and certificates currently require separate navigation. Preserve distinct account and workforce identities in a unified workspace.
- Template editor already offers live preview, field settings, reorder buttons, publishing, and dirty guard. Retain specialist editing while exposing it contextually from permit types.
- LOTOTO list already groups plans/active/restoration; execution and restoration still display many phase actions together. Focus the current isolation point and preserve sequence, locks, tags, verification, and restoration as explicit actions.
- SIMOPS and incidents already have consolidated list views; their follow-up workflows should disclose current-stage actions and preserve separate permissions.
- Settings repeats organisation navigation; keep personal appearance/profile primary and a single administration entry.
- Analytics and Reports overlap but serve distinct insight and register tasks; do not merge their data semantics. Keep filtered drill-through, error states, and readable chart alternatives.
- Public auth/access pages have visible labels and outcome copy; retain normal Keycloak-backed flows. Legal pages are shared-layout content, outside business-flow redesign.

## Mobile source pass
- 47 screen routes structurally inventoried. Native runtime has not been exercised.
- Home tab presents platform/session details and module links; a separate dashboard shows summary/KPIs. Propose one task-oriented Home within existing navigation.
- Many operational screens use hardcoded colors despite a theme provider; theme consistency needs an explicit mobile pass.
- Mobile incident investigation asks for Investigator ID and Owner ID; replace manual identifiers with existing authorized directory selections and readable labels.
- Mobile approvals display a location ID instead of its name.
- Mobile permits retain a separate wizard and offline queue. Any reduction of steps must preserve unsynced drafts and distinguish queued from server-confirmed actions.
- Mobile SIMOPS offers assessment/mitigation/approve/reject sections; expose actions according to current status and role without changing server transitions.

## Browser evidence: organisation setup
- Docker web login succeeds through documented local credentials. The `orgadmin` demo login displays Tenant Owner; persona labels in the audit must distinguish actual role from account alias.
- Screenshots at 1440×1000 and 390×844 confirm the setup page repeats title, progress card, step navigation, step title, help panel, status, and then its form. On the 390 px screen the first editable field sits below the initial viewport.
- Setup has separate “Save changes”, “Save and exit”, and “Next” actions without explaining which saves entered values versus navigation progress.
- Desktop setup footer overlaps the embedded profile’s save area in the captured viewport. Verify focus clearance while redesigning the footer.
- Large rounded cards, shadows, progress decoration, and persistent page chrome consume more space than the short profile form. Reuse theme tokens with flatter grouping and collapsed optional guidance.
- No horizontal overflow on the first 14 administrator routes at desktop width; this is a measured result, not complete responsive coverage.

## Safety and mobile compatibility constraints
- Backend submission requires type, title, department, location, workstation, time range, executor, hazards, PPE, conditional LOTOTO/gas items, and required template answers (`permit-validation.service.ts`, `permit.service.ts`). These must remain mandatory.
- Six business lifecycle phases are not six form steps: issuer initiation → executor preparation → HOD review → executor pre-work confirmation → issuer verification → HOD final sign-off (`approval/default-workflow.ts`). Consolidate screens without merging actors or attestations.
- Mobile has FIVE wizard steps while web has SIX and persists the same numeric `currentStep`; mobile step 4 is Review while web step 4 is Forms. Introduce a compatible mapping for presentation and avoid trusting stored step number as completion.
- Mobile form types/serialization lack web form responses; required template permits need explicit cross-client support before promising mobile submission parity.
- Mobile `permitDetailToForm` slices stored UTC strings without local conversion; web already uses a local conversion. Prevent edit/save time shifts and test timezone round trips.
- Existing web “All yes” batches unanswered safety checks. Simplification must not add more automatic assertions; proposed revision requires deliberate safety answers and signatures.
- `DailyProgressForm` asks separately for Work completed, Outstanding work, and Daily summary. Investigate summary semantics before removing a server-required field; contextual reuse can propose a summary for user review.
- Existing offline provider/queue can expose pending/syncing/failed states; preserve replay ordering and authority on the server.

## Browser evidence: permits
- Issuer Create permit repeats a draft banner, six-step navigation, and a large recent-work panel before type/title/scope entry. The banner says changes are saved as a draft, although saving is manual; make save state factual.
- Mobile permit list exposes many status/stage/type chips above records. Keep one task filter and search visible, with secondary filters collapsed and a count/clear action.
- Existing screenshots confirm the branch’s core UI patterns are present in the Docker build, but the image was reused, not rebuilt; no assertion that its full source exactly matches HEAD.

## Source refinements
- Setup “Save and exit” persists only `setupProgress`, catches save errors, then navigates away; it does not commit an embedded unsaved entity form. This is a confirmed misleading action contract.
- Workforce creation already provisions/reuses Keycloak identity through the backend and stores `keycloakUserId`; reuse this association for contextual account editing, never join accounts by display name.
- Daily summary is required by DTO, so leave it visible unless its business meaning is explicitly changed.
- Search palette uses a hand-built modal (`aria-modal`) with initial focus, but no focus trap/return in the component. Use the installed accessible dialog primitive for consistent keyboard behavior.
- A query referenced nonexistent tenant-users and isolation-sequence-builder paths; corrected to the actual workforce module and LOTOTO page implementation.
- Web shared button sizes run 24–36 CSS px; native and coarse-pointer field tasks need larger hit areas while compact desktop density can remain available.

## Documentation conflicts for review
- PRD §3.1 forbids administrators participating in live approval/execution, while current role constants permit tenant-owner/admin to create/submit and participate in several actions. Do not silently change policy in a UI task; keep server enforcement and surface this discrepancy for product review.
- PRD §6.1 describes a mandatory Safety Officer gate after HOD acceptance; current default approval workflow contains only HOD initial review and the UI implements a safety veto. The simplified UI must describe actual server state, not claim an unimplemented approval occurred. Any policy change requires a separate approved scope.
- PRD also describes terminal rejection in an approval path, while current permit editing supports rejected/deferred resubmission. Retain existing behavior and call out the conflict.

## Validation baseline
- Web type check passed. Mobile type check failed on four existing TS2339 errors in the wizard’s role-specific payload union.
- Four existing Jest suites passed: permit validation, permit collaboration, template answers, organisation setup progress; 16 tests total. These do not prove browser form persistence or mobile runtime correctness.
- Browser closure/archive pages repeat the permit title twice inside a third page-level heading; consolidate context and keep verification actions near the relevant evidence.
- Browser audit includes draft/detail/edit/preview/journey, execution/progress/evidence/multi-day, closure/archive, incident form/detail, and a SIMOPS conflict. All visited pages responded; native app remains source-only.

## Final review evidence
- Browser audit completed: 93 visits, 70/84 web route patterns, 19 selected phone-width checks. Remaining route and runtime limits are explicit in browser-review.md.
- Phone approval/closure screenshots reinforce compact shared record context; closure repeats the record title before and inside its evidence card. Preserve evidence and role ownership when reducing this duplication.
- Existing native HTML dialog implementations already use showModal and labelled titles; retain working dialogs. Focus-trap/return concerns apply to manual modal implementations such as the search palette, not every confirmation dialog.
- No application implementation started. User review remains the explicit gate from the original request.

## Review-driven verification
- `UpdatePermitDto` makes draft fields optional. `PermitService.update` updates defined scalar fields; deletes/reinserts supplied collections and replaces supplied form responses. Omitted fields remain unchanged, but array/member concurrency is unsafe.
- No expected revision or compare-and-set predicate in the inspected DTO/update path. Existing detail and permissions/status are read before the transaction. Dirty patches alone cannot provide conflict protection.
- `.claude/rules/code-style.md` references AI retrieval directories absent from the current source tree; documentation correction needed.

### Revised entry baseline model
- Existing web pickers already cover permit type, plants/departments/locations, people, hazards and PPE. Site codes are already suggested on name blur. New employee's required typed fields are name and email. Do not count existing automation as new savings.
- Model three fixed journeys: issuer creates/assigns a fresh permit (not full safety submission); setup adds plant, department, location and workstation; directory adds a new employee. Count button/link activations as 1 and open+choose selection as 2; typing/focus/scroll excluded from click count. Screen means main-content replacement, including wizard steps, not each inline form.
- Proposed reductions: permit 2 to 1 typed field via an editable title derived from scope, location path derives plant; hierarchy 4 to 4 necessary names, parent selections 3 to 0; person 2 to 2 required identity fields with fewer hub transitions. These are explicit task models pending control replay; no timing claim.
- Existing All yes is already per section and only fills unanswered checks. Retain it with visible target questions, explicit confirmation, and server-attributed answer change audit; never apply to signatures/readings.
- Physical Android phone with SDK-52-compatible Expo Go replaces emulator acceptance. Official Expo supports selecting an older Android build; physical iOS cannot use an older Expo Go for SDK 52. No framework upgrade included.
- Native acceptance will use physical Android with matching Expo Go, avoiding an emulator on the 8 GB host. Expo SDK is ~52.0.40.
- AuditService.log is optional and best-effort; batch safety-answer attribution requires transactionally persisted audit records rather than that call alone. Included in concurrency-review.md.
- Current wizard and setup already support direct step selection. The redesigned editor must reduce separate content views and repeated context; merely changing tab labels does not satisfy S2/S3.

### Phone authentication constraint
- `mobile/src/providers/auth-provider.tsx` builds a `ptw` callback via AuthSession. Expo's current primary documentation states OAuth/OIDC local testing requires a development build rather than Expo Go. Physical phone remains the plan; full authenticated acceptance cannot be promised in Expo Go alone.
- Actual mobile API/auth config lives in `mobile/src/lib/{api,auth}/config.ts`; default localhost URLs need phone-reachable host addresses. Existing local Keycloak realm lists the mobile scheme and a localhost Expo redirect; exact development redirect and issuer configuration must be verified.
