# UI/UX Simplification — Closure Review

Date: 2026-10-01. Reviewed `feat/ui-ux-simplification` at `22e84ca` against `dev_ram` at `ed8c3cc`, using approved implementation-plan revision 3 and its route/field/concurrency requirements.

**Decision: not ready to close.** Substantial implementation and passing regressions do not satisfy the full approved scope. Safety defects below block closure independently of the outstanding UX and device acceptance.

## Standards

1. **P1 — Required stage checks depend on the mutable template catalogue.** [`PermitService.saveStageAnswers`](../../app/src/modules/permit/permit.service.ts) (731–759) derives mandatory checks only from currently published/applicable templates. Archiving, unpublishing or removing applicability after submission excludes required approval/closure fields still present in the stored permit snapshot. Organisation template updates/archive support these changes. Final approval/closure use this result as their required-answer gate. This violates AGENTS.md's prohibition on skipping mandatory safety validation. Validate the captured requirements independently of the live catalogue.

2. **P1 — Draft participants can prefill later-stage attestations.** [`PermitService.update`](../../app/src/modules/permit/permit.service.ts) (311–332) accepts all form answers; assigned executors may edit `formResponses`. [`sanitizeAnswers`](../../app/src/modules/permit/permit-forms.ts) (56–61) accepts an arbitrary signature name. Web template inputs (245–261) and native inputs (183–194) expose approval/closure fields during draft preparation. The eventual stage check accepts existing answers without requiring that stage's decision-maker to attest. Actor-attributed draft audit does not establish the named HOD/authoriser/closer as signatory. Enforce stage ownership on the server and in the clients.

3. **P2 — New native form controls ignore semantic themes.** [`template-form-fill.tsx`](../../mobile/src/components/permit/template-form-fill.tsx) (15–17, 236–259) hardcodes control, text and status colours instead of consuming existing theme tokens. Native `stage-answers.tsx` (48, 77) repeats this pattern. This violates AGENTS.md's semantic-token and supported-theme rules.

## Spec

1. **P1 — Wrong-actor stage attestation remains possible.** Revision 3 says “Never … sign for another person” and places stage fields with “the person taking the decision.” Draft-prefilled signatures are accepted at the later stage, as documented in Standards finding 2.

2. **P1 — Historical requirements are not preserved at decision time.** The plan preserves template snapshots/evidence. Required stage fields disappear from validation following catalogue changes, as documented in Standards finding 1.

3. **P1 — Conflict recovery permits blind replacement of another participant's work.** The plan requires the saved value beside each changed field. [`permit-wizard.tsx`](../../frontend/src/components/permit/permit-wizard.tsx) (454–456, 491–495, 718–724) instead adopts the latest revision, retains the old full form, and offers a separate-tab link followed by re-save. Included collections and form answers are replaced on retry, including values the person did not change. Native (208–215) similarly advises saving again to replace the saved version. Show field-level saved/local differences and retain unrelated remote edits.

4. **P2 — S6 is materially incomplete.** The native route plan requires a sectioned permit editor and named investigator/owner selections. Native [`permit-wizard.tsx`](../../mobile/src/components/permit/permit-wizard.tsx) (341–364, 749–768) remains a six-step Next/Back wizard. [`incidents/[id].tsx`](../../mobile/app/incidents/[id].tsx) (103, 118) still requests raw IDs. Organisation/workforce, LOTOTO, SIMOPS, execution and multi-day redesigns remain explicitly deferred in progress.md.

5. **P2 — Required validation and navigation recovery are missing.** The plan requires associated inline errors, summary links focusing inputs, and dirty-navigation protection. Web submit (574–576) links sections; `ValidationSummary` neither identifies nor focuses invalid inputs. The editor's guard (542–548) handles unload only; in-app links can discard edits. Setup's Back link (273) is unguarded. These are implementation gaps, not merely unavailable test evidence.

6. **P2 — Person context, account reuse and target sizes remain partial.** Directory Manage (95–106) switches lists without retaining the selected person; the authorised existing-account selector/prefill is absent. People submit/cancel buttons use the shared default `h-8` (32 px), below the required 44 px. New native form controls use 44 units (247–257), below the required Android 48 dp. Native semantic-theme coverage also fails as described above.

## Validation evidence

Fresh checks against the reviewed HEAD:

- API, web and mobile `tsc --noEmit` all passed, run sequentially.
- Full Jest: **124 suites / 547 tests passed**, zero failures/pending, using an isolated local database and `--runInBand` (126 seconds).
- Database connection and all **53 migrations** were verified before Jest. Afterwards the database contained 171 permit fixtures, including six revision-test fixtures, establishing that DB tests actually executed. Application database data was not used for these regressions.
- A focused probe invoked the real `saveStageAnswers` and `assertStageAnswered` methods with mocked locked-detail/catalogue reads. An empty captured HOD signature correctly blocked while the template was applicable, then produced **no missing-answer errors** after the catalogue returned no applicable template. Approval and closure also produced no errors for signatures prefilled under another name. This isolates the two defects; it is not an end-to-end HTTP approval/closure test.

Existing evidence reviewed, not rerun:

- Recorded journeys meet their narrow targets: P1 **1 typed / 10 clicks / 2 views**; P2 **1 / 19 / 2**; H1 **4 / 9 / 2**; E1 **2 / 4 / 1**.
- `s7-route-sweep.json`: **498 visits**, six skipped resolved-clash visits, zero page errors/overflow/loading failures. The script uses 900 px height at both widths and has no appearance-variant, keyboard, zoom or field-focus checks. Role-denied visits do not establish authorised workflow behavior for those pages.
- Docker web production build and Android export successes are recorded in progress.md; neither was freshly repeated for this review.

**Still unverified:** physical-phone development-build authentication/offline/reconnect/keyboard acceptance; 200% zoom and focus visibility; full 32-combination theme/mode/density/style matrix with representative forms and confirmation/error states. No emulator was started.

**Test reliability limitation:** `tests/permit-draft-revision.spec.ts` (31–38, 65–68) catches connection/migration failure and returns from each DB test, allowing a false green run. This review preverified setup and fixture creation; future required DB runs should fail setup rather than silently pass.

## Scope status and closure conditions

| Slice | Assessment |
|---|---|
| S0a / S0b | Revision, transactional answer audit, attachments and replay substantially implemented; conflict recovery and device replay acceptance remain open. |
| S2 | Journey targets met; field errors/focus, in-app dirty guards, conflict comparison, read-only owner summaries and stale-prefill feedback remain open. |
| S3 | Areas, hierarchy context and entry targets implemented; account reuse, selected-person context, dirty guards, linked permit configuration and cross-list duplicate checks remain open. |
| S4 | Workspace and stage forms implemented; both mandatory-attestation defects require correction. |
| S5 | Supporting-screen improvements implemented; progress still defers restoration verification feedback and several list/filter treatments. |
| S6 | Partial implementation; multiple mapped native workflows remain unreworked. |
| S7 | Regression and route evidence exists; physical-device, full visual matrix and accessibility acceptance remain open. |

The plan/review headers and task-plan phase/checklists also contain stale statuses. Preserve the approval record, reconcile those statuses against actual remaining work, and do not mark the objective complete until the safety defects, approved implementation gaps and required acceptance evidence are resolved or explicitly descoped by the user.

**Findings: Standards 3; Spec 6 (cross-axis overlap retained). Worst issue: mandatory stage attestations can be bypassed.**

## Response — 2026-10-02

| Finding | Status | What changed |
|---|---|---|
| Standards 1 / Spec 2 — stage checks depend on the live catalogue | **Fixed** | `formsToCheck` checks every form captured on the permit as captured, plus applicable templates with no answers yet; archiving or re-scoping a template no longer removes a requirement (`saveStageAnswers`). DB test archives the template after capture and still gets the missing HOD signature. |
| Standards 2 / Spec 1 — later-stage attestations can be prefilled or signed for someone else | **Fixed** | Draft create/save never writes approval- or closure-stage fields (`keepLaterStageAnswers`); stage answers are only written with the decision, and every signature given there is recorded under the signed-in decision-maker's name whatever was typed. Entering a new approval round (submit, resubmit, revalidation) clears approval and closure signatures; entering a new closure round (work completed again, sent back to the issuer) clears closure signatures — each cleared answer audited, revision bumped. Web and native draft forms show those fields read-only ("Signed at approval: not yet"); decision screens offer only "Sign as <you>, now" / Remove. Tests: unit (keep, clear, captured forms, signer) and DB (pre-sign refused, archived template still required, typed name replaced, resubmit clears, new closure round clears); s4-stage-check adds "a draft save cannot pre-sign approval signatures". |
| Standards 3 — native controls hardcode colours | **Fixed for the new controls** | Mobile theme gains semantic status colours (success, danger, warning with backgrounds, light and dark); `template-form-fill`, `stage-answers` and Home use theme tokens only. Older native screens keep their existing styles. |
| Spec 3 — conflict recovery replaces newer values | **Fixed** | Three-way merge against the last loaded/saved copy (`mergeAfterConflict`, web and native): values only the other person changed are taken, the person's own changes are kept, and values both changed are listed with "Saved:" and "Yours:" and Keep mine / Use saved; saving waits until each is chosen. Lists count as one value each; form answers per field. Tests: permit-conflict.spec; s0a-runtime-check now verifies the comparison, the held save and the explicit choice. The comparison is a list above the form, not beside each field. |
| Spec 4 — S6 incomplete | **Partly addressed** | Mobile incident investigator and action owner are chosen by name. Still open: native sectioned editor (the wizard keeps Next/Back, now with a Forms step), LOTOTO/SIMOPS/execution/multi-day and reference-screen redesigns. |
| Spec 5 — field errors, focus, in-app navigation guard | **Partly addressed** | Editor errors now link to the field itself (focusing it) for title, department, location, planned start/end, primary executor, workstation and machinery, with the message under the field and `aria-invalid`/`aria-describedby`; section-level errors focus the first control of the section. `useLeaveGuard` asks before in-app links as well as tab close, in the editor and in setup/People add-edit forms (once values changed). Still open: browser back-button navigation is not intercepted; form-answer errors link to the forms section, not each question. |
| Spec 6 — person context, account reuse, target sizes | **Partly addressed** | Setup/People form buttons are 44 px; new native controls 48 dp. Still open: authorised existing-account selector and keeping the selected person across People views. |
| Test reliability — DB tests can pass without a database | **Fixed** | Jest global setup fails the run when PostgreSQL is unreachable, unless `SKIP_DB_TESTS=1` is set deliberately. |
| Still unverified | Open | Physical-phone development-build acceptance; 200% zoom and keyboard focus; the 32-combination appearance matrix. |

### Second review — 2026-10-02

| Finding | Status | What changed |
|---|---|---|
| P1 — a later signer's request renamed every signature it carried (the screen sends existing signatures back), so the first approver's signature took the second approver's name | **Fixed** | `applyStageAnswers` keeps a signature that comes back unchanged exactly as stored; only a new or changed signature is bound to the signed-in person. Comparison is by value (`sameAnswer`): Postgres jsonb reorders object keys, which also made answer audit and the conflict merge see unchanged signatures as changed — both now use the same order-independent comparison. Tests: two approvers on one form (unit), issuer signs at verification then HOD at closure (DB). |
| Custom field components do not forward the injected ARIA error attributes | **Open** | `FormField` adds `aria-invalid`/`aria-describedby` to its child, but `PersonSelect` and `PlannedDateTimeField` do not pass them to their inner control, so for primary executor and planned start/end the inline message is visual only (links still move focus to the control). |
| DB suites can still pass silently after a migration failure | **Open** | The Jest global setup now fails when the database is unreachable, but suites still catch their own `migrate()` failure and skip their tests (`canConnect = false`). Fix: let migration errors fail the suite, or migrate once in global setup. |

Full closure stays open: the P2 items above and in the first response, and the unverified acceptance (phone, zoom/keyboard, appearance matrix).
