# UI/UX Simplification Plan — Revision 3

Status: **Revised after second review; application implementation has not started.**

Branch: `feat/ui-ux-simplification`, from `dev_ram` at `ed8c3cc`. Full scope remains web and native; the first milestone is deliberately smaller.

## Concrete review package

- [Before/after sketches](ux-sketches.html): permit editor, setup overview/contextual site entry, and People. Includes a 390 px preview and selected interactive examples; these are planning artifacts, not implemented screens.
- [Journey baselines and targets](journey-baselines.md): reproducible action counts and their limits.
- [Field assistance](field-assistance.md): exactly what stays typed, becomes derived, is selected, or remains deliberate.
- [Concurrency contract](concurrency-review.md): verified current PATCH semantics and required backend changes.
- [Review response](plan-review.md), [route dispositions](route-inventory.md), [audit](audit-summary.md), [browser evidence](browser-review.md).

The structural source audit covers 84 web routes and 47 native screens, with deeper analysis of forms, shared components and business contracts. Browser inspection covered 70 web route patterns. This is a UX-focused review, not a line-by-line certification of every backend module. Retain existing Needs you, reusable CRUD, templates, schedule presets, copy support, safety lists, theme tokens and APIs wherever their contracts suffice.

## Outcomes and boundaries

Every task should show its current owner, missing information, next action and result. Keep required work visible; disclose optional entry. Reduce repeated selection and competing headings; preserve entered values after recoverable errors.

**Smart means deterministic assistance here.** Derive a short editable title from the entered scope; derive plant from the selected location; reuse explicit parent/person context; reuse configured template prefills; flag exact duplicate email/equipment codes in authorized data. Show sources and allow permitted correction. Generative AI hazard/PPE recommendations are outside S0–S7. They need a separate validated knowledge/provider proposal; no AI capability is claimed for this revision.

Keep server safety validation, roles, tenant boundaries, lifecycle transitions, evidence and audit history. Never infer a safe state, copy old safety answers, sign for another person or interpret an offline queue entry as approval. Existing PRD conflicts around administrator participation, the Safety Officer gate and rejected-permit resubmission remain recorded policy questions; this UX scope does not silently resolve them.

## First milestone: S0a, then S2

The deliverable is a reliable **web permit editor**, not an application-wide component rewrite or setup redesign. Build S1 interaction patterns inside S2 only when a real permit interaction consumes them. Keep the slice IDs for traceability in the route inventory.

**Size, stated plainly:** milestone 1 is roughly half backend. S0a (migration, locked-row revision checks, transactional answer audit, both clients on the new contract) ships no visible improvement but is required before direct section editing is safe. Review progress with that expectation; S2 is where users see the change.

### S0a — save correctness and revision contract (milestone 1)

- Save current authorized edits before submitting; on first create, persist the rest of the draft after receiving its ID. Never report the whole form saved after only creating its title/type/scope. Retain inputs and ID if the follow-up save fails; do not create duplicates on retry.
- Fix native payload union errors and local-time round trips; explicitly map web/native stored step positions.
- **The API supports partial updates, but has no revision check.** Included arrays replace whole collections. Implement items 1–4 of [concurrency-review.md](concurrency-review.md): `draftRevision` migration, `expectedRevision` on draft PATCH and submit, tenant-scoped locked-row validation, save/submit and duplicate-submit races, stale save after return-to-editable, and transactional answer-change audit. This supersedes the previous “no contract change assumed.”
- Native clients send the revision they loaded, including on queued requests. A queued request that receives 409 becomes a failed item with its local input kept and visible; full offline reconciliation is S0b.
- Require the relevant persistence, authorization, concurrent-write and date tests before S2. Do not claim that dirty-field patches alone prevent data loss.

### S0b — remaining draft safeguards (deferred, before S6 closes)

Draft attachment upload/remove under the revision lock with MinIO cleanup, and full offline replay reconciliation (stop dependent requests, reconcile legacy queued requests without a revision). Until S0b lands, attachment edits keep today's behavior; this known gap is recorded, not hidden. S2 must not add new attachment interactions that depend on S0b. *Implemented 2026-10-01:* attachments re-check the locked permit and clean up storage; they do not bump the draft revision (saves never replace attachments). Offline replay maps local ids, holds dependent requests after a refusal, and fails legacy saves without a revision for review.

### Rollout of the revision contract

Once the server requires `expectedRevision`, any client without it fails every draft save. The repository contains no EAS/store build configuration (`mobile/eas.json` is absent), so the assumed situation is no distributed native builds: deploy server, web and native together, and older clients receive a clear “Update the app to keep saving” error. **User decision required if any tester or partner has an installed build:** in that case use a short compatibility window where a missing revision is accepted, logged with client version, and switched to rejection on an announced date.

### S2 — permit editor, with S1 patterns built as needed

Replace six separate wizard views with one scrollable editor. The current step buttons already permit jumping; changing their labels alone is insufficient. Work and location/schedule must be editable together. Keep section anchors for **Work**, **Place and schedule**, **People and site safety**, **Forms and evidence**, and **Review**, with missing-field counts and role labels.

| Visible region | Proposed behavior |
|---|---|
| Header | One title, draft/reference, accurate save state, compact Use previous permit action. Remove the large repeat-work panel above entry. |
| Work + place | Scope first; editable title suggestion; explicit type; location path deriving plant; compatible department; executor and schedule in the same view. |
| Preparation | Executor-owned workstation, machinery, controls and crew together. Issuer sees readable summaries and the next owner, not enabled controls they cannot edit. |
| Forms/evidence | Required questions visible with progress based on answers; factual prefills show source. Optional participants/files are disclosed without hiding blockers. |
| Review/actions | Missing data links to its field/owner. Save draft or Save preparation reports actual success. Issuer reviews and submits through existing server workflow. |

**Title from scope:** the suggestion uses the first sentence. Scopes that open with boilerplate ("As per work order 4411, the team will…") produce a poor suggestion; the title stays editable and this case is in the tests.

**Conflict screen, first version:** on 409 keep all local values, show "This permit changed since you opened it. Your changes are still here.", display the saved value beside each field the person changed, and let them re-save against the new revision. Submit stays disabled until that re-save succeeds. A full side-by-side compare view is deferred until the simple version proves insufficient.

Use one in-memory form; local section navigation retains edits. Explicit save, pending-state disabling, inline errors linked with `aria-describedby`, a focused linked error summary, and dirty-navigation protection are the S1 work needed here. Reuse existing form fields/dialogs and tokens; extract only reused behavior. Defer unrelated global component cleanup.

Copy factual job context from a previous permit; show prior hazard/PPE choices as candidates requiring review, never as verified safety answers. Keep configured prefills without overwriting edited values. Changing place/equipment visibly invalidates incompatible dependent choices.

**All yes decision: retain it per section with explicit confirmation.** The current control already targets a section's unanswered checks. Put the action after visible questions, list its exact target questions in confirmation, and require the authenticated actor's declaration. Never overwrite No/N/A, fill hidden sections, sign, or enter readings. Persist answer changes with mandatory transactional actor/time/revision audit evidence. The existing best-effort audit call alone is insufficient. This applies to **every** check-sheet answer change, individual or batch, through one server path; there is no second, weaker audit route for single answers. This is a deliberate extra activation: 2 instead of 1 for a section of ten checks, still fewer than ten individual answers.

### First-milestone exit

P1 issuer preparation: **2→1 typed fields, 13→≤10 normalized clicks, 3→2 views**. This ends at assigned draft handoff, not approval or permission to work.

P2 executor preparation (where most entry happens): **1→1 typed field, 31→≤21 normalized clicks, 5→2 views** (baseline recorded 2026-10-01). Open the editor on the viewer's own section. Template fields now carry an optional *required at stage* (submit / approval / closure); submit enforces only submit-stage fields. Existing companies' Safe work permit and hot work check sheet copies were updated by migration 0052. Approval- and closure-stage fields are enforced in **S4** (decided 2026-10-01). See [journey-baselines.md](journey-baselines.md). Milestone 1 is not complete on P1 alone.

Preserve issuer review/submit with role/transition tests. Include custom-title, boilerplate-scope title, custom-schedule, applicable form, validation failure, save failure, stale revision (conflict screen keeps values and re-saves), and duplicate-submit cases. Full native redesign remains S6; native contract compatibility belongs in S0a; offline reconciliation in S0b.

## Second milestone: S3 setup, sites and people

Replace setup's 19-step presentation with five direct work areas: **Organisation**, **Sites and equipment**, **Permit configuration**, **People and responsibilities**, **Readiness and preferences**. Existing setup already allows jumping; the gain is grouped work, retained parent context and fewer remounted forms.

The overview displays required configuration gaps and unknown checks, not a percentage implying work is authorized. Use a short Configuration checklist; failed reads show Retry. Separate optional preferences. Existing server validation remains authoritative.

Sites follows the specified hierarchy plant → department → location → workstation → equipment (FC-ORG-004: locations belong to a department). Add-child forms stay in that workspace, display their inherited parent and retain generated codes. Four new entity names remain four typed fields. Save changes saves the visible entity; Back to setup has dirty protection. Remove the misleading outer Save and exit. Preserve `SETUP_STEPS`, `setupProgress` keys and old `?step=` links through mapping, and reuse `EntityCrudPage`, `WorkforceCrudPage` and `AdminEmbedContext`.

People uses the existing directory as the primary entry with inline add/edit and selected-person context. Employees/contractors remain distinct; agencies remain organisations/contacts. Use existing Keycloak provisioning and `keycloakUserId`, show the actual login outcome, and link roles/capabilities in context. Add exact-match email warnings and an authorized existing-account selector; do not auto-merge similarly named people. New name/email stay necessary.

Permit configuration groups type and its applicable templates/checklists with links into existing specialist editors. Preserve template publication, snapshots and dirty guards. Catalogue setup remains reusable across types where the schema allows; do not invent missing relationships.

Exit: H1 **4→4 typed names, 18→≤9 clicks, 5→2 views**; E1 **2→2 typed fields, 6→≤4 clicks, 3→1 views**. Exact scenarios and counting rules are in the baseline document. Test parent changes, duplicate code/email, API failure, returning after cancellation, and existing query links.

## Later milestones: full application scope retained

### S4 — one permit context and task queue

Use `/permits/[id]` as a stable workspace with **Overview / Preparation / Review / Work / History**. First compose existing content under one compact header: reference/status, work title, place/window, current owner and blockers. On desktop place the current decision beside its relevant evidence; on phone put a concise task summary above the evidence and reserve space for the action footer. Remove repeated record headings in closure/archive.

**Stage form answers (decided 2026-10-01):** the Review section lets the person taking the decision record the template fields required at their stage (approval: HOD, authoriser; closure: completion acceptance, hot work fire watch) beside the decision, through a stage-answer endpoint that checks role, permit status and revision, and writes the same transactional answer audit as draft saves. Approval and closure are refused while their stage's required fields are empty. Until S4, those signatures are not enforced anywhere; the approval workflow still records who approved and when. *Implemented 2026-10-01:* the answers travel with the approve/verify/close request rather than a separate endpoint, so signing and deciding are one atomic step; the final approval and the closure enforce them.

Work contains current activity entry, evidence and daily operations in one context, with separate explicit completion/revalidation/extension actions. Review shows the relevant approval or closure decision, preserving issuer verification and HOD sign-off as distinct attestations. History groups journey, approval history and audit content; print preview remains separate and archives stay read-only. A failed evidence/history read has Retry, never an empty-success presentation.

The main queue begins with task view, search and result count. Move secondary filters into **Filters (N)**; keep active filter chips and Clear visible. Views: Needs me, Drafts, Awaiting review, Live, Closing, Finished. Retain different backend queue endpoints where their semantics differ. Keep return filters and selection after review-next. Redirect old URLs only after role/data/query/hash/back-navigation parity is proved; otherwise retain contextual entry links.

### S5 — concrete supporting-screen changes

| Area | First visible content | Current interaction made simpler |
|---|---|---|
| LOTOTO execution | Plan/permit, selected isolation point, remaining point count and blockers | Point selector + current point's lock/tag/evidence/verify controls; completed points become expandable records. No skipped sequence or batch completion. |
| Restoration | Outstanding locks/tags/points and authorized next action | Current restoration point expanded; completed register collapsed. Removal, verification and completion stay separate confirmed operations. |
| SIMOPS | Overlapping permits, place/time conflict and current stage | Two-column permit comparison above existing assessment/mitigation; show rejection text only after Reject. Keep existing status-dependent stages. |
| Incident detail | Severity, affected permit, stage, assigned investigator and next owner | Current investigation/corrective-action form first; report/evidence/history as labelled sections. Keep quick reporting and serious-incident server gates. |
| Notifications | Unread/actionable groups with record name and next task link | Make Open related task primary; read/unread secondary. Explain unavailable/deleted targets. |
| Dashboard | Needs you and immediate task links | Reduce duplicate totals; unavailable queues show Retry instead of all-clear. |
| Analytics/reports | Period/filter row, headline values or register | Keep filters during drill-through; disclose secondary controls; expose tabular values for charts. |
| Billing/platform | Current subscription or selected tenant and next task | Reveal change/invite forms on intent; history below; preserve destructive confirmations and permissions. |
| Settings | Personal profile and appearance | One clear administration link; all approved appearance variants remain available. |
| Public/auth/legal | Existing purpose and primary form/action | Consistent field errors, focus and narrow layout; retain Keycloak and legal content. |

Each mapped route in `route-inventory.md` receives its listed treatment. Shared patterns adopted here must have passed the permit milestone first; preserve working native `<dialog>` behavior rather than replacing every dialog.

### S6 — native field workflows

Home becomes operational tasks plus compact sync status; move API/storage/version diagnostics to existing Platform/Settings. Consolidate useful dashboard content into Home. Use the same task/section names, semantic themes and readable authorized person/location choices. Add required check-sheet/form-response parity. Queued work is **Pending server confirmation**, with cached age, retry and conflict states. Verify local-ID mapping and replay order for each queued workflow.

**Physical phone testing; no Android emulator on the 8 GB host.** Keep Docker's existing resource limits. Use SDK-52-compatible Expo Go on physical Android for compatible launch/UI checks; [Expo provides that Android build](https://expo.dev/go?device=true&platform=android&sdkVersion=52). Full Keycloak authentication needs special care: the app uses `AuthSession` with the `ptw` callback scheme, and [Expo documents that OAuth/OIDC testing needs a development build](https://docs.expo.dev/guides/authentication/). Use an existing compatible development build on the same phone for authenticated/offline acceptance; if unavailable, obtain one using an approved build environment, not a local emulator or framework upgrade. Do not bypass login to claim acceptance.

Point `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_KEYCLOAK_URL` at addresses reachable by the phone, and verify exact development redirect/issuer configuration. Phone localhost is not the Docker host. Run Metro with one worker and perform expensive builds/browser suites sequentially. No phone or authenticated build has yet been verified; record device/OS/build and offline/reconnect evidence when available.

### S7 — full regression and visual matrix

Run web/mobile type checks, relevant Jest regressions, production builds and Docker/browser checks against rebuilt changed services. Confirm all 84 web route dispositions and all 47 native screen dispositions, including legacy-link behavior. Native runtime acceptance requires the physical phone evidence above.

## Testable acceptance criteria

1. Meet P1/P2/H1/E1 numeric targets with the documented counting contract. Publish before/after traces; do not claim timed speed gains.
2. Redesigned web form/button hit areas are at least **44×44 CSS px**, including compact/coarse-pointer cases in these workflows, with at least **8 px** between adjacent independent buttons. Native Android targets are at least **48 dp**; iOS targets at least **44 pt** if tested.
3. At **390×844** and **1440×900**, the first relevant entry/task control appears without scrolling. No page-level horizontal overflow; focused fields are entirely visible above sticky actions. Verify at **200% zoom** and with the phone keyboard open.
4. Every invalid required input has a visible associated message; summary links move focus to that input. Dialogs trap focus, close through explicit cancel/Escape where appropriate, and return focus. Save/validation/conflict failures retain all typed values.
5. Milestone 1 and 2 smoke: **Hazard and Control Room**, light/dark, at the two viewports, normal density/standard style; also inspect compact target sizes and reduced motion on the changed task. These are representative themes, not a claim about usage analytics.
6. Full four-theme × two-mode × two-density × two-style **32-combination** matrix belongs to **S7**, on a fixed representative set: permit editor, setup work area, person form and confirmation/error states. Record results per combination; do not demand every component permutation before the first milestone.
7. Concurrency and safety checks from `concurrency-review.md` pass. No silent overwrite, duplicate transition, missing tenant check, implied safe/offline-success state or unsigned batch answer evidence.
8. Full-matrix, native-phone and broader route acceptance are not prerequisites for beginning S2, but remain requirements for completion of the full goal. Record failures and unavailable evidence explicitly.

## Review decision requested

Approve revision 3's direction and scope, starting with **S0a→S2 (S1 inside S2)**. S0b, setup/People S3 and S4–S7 remain the full subsequent scope. Explicit decisions: deterministic assistance, scoped confirmed All yes, one transactional audit path for all answer changes, revision backend prerequisite, simple first conflict screen, P2 executor baseline, and physical-device testing with Expo Go's authentication limits acknowledged. Open for the user: revision-contract rollout if any native build is installed outside development. Record approval or further revisions in `plan-review.md` before implementation.
