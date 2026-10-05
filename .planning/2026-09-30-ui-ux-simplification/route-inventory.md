# Route-by-Route UX Disposition

Coverage: 84 web pages and 47 native screens. Every route received a structural source pass (composition, labels/actions, navigation and data/error patterns); shared-component findings apply to their consumers. High-friction workflows additionally received detailed source inspection. “Browser” means at least one recorded page visit, not complete state, role, accessibility, or theme verification. Native runtime remains untested. Proposed redirects require semantic/permission parity before activation.

Revision 3 sequencing: S0a→S2 is milestone one (S0b deferred, before S6 closes); S1 patterns are built inside S2 as needed. S3 is milestone two. S4–S7 retain subsequent full scope.

| Platform | Existing route | Proposed disposition | Slice | Acceptance concern | Evidence |
|---|---|---|---|---|---|
| web | [/active-permits](../../frontend/src/app/(app)/active-permits/page.tsx) | Live view of work queue after parity | S4 | Include suspended/overdue without losing filters | Source + browser |
| web | [/analytics](../../frontend/src/app/(app)/analytics/page.tsx) | Retain insights; simplify controls/drill-through | S5 | Readable values, periods, partial failure | Source + browser |
| web | [/approvals/[permitId]/history](../../frontend/src/app/(app)/approvals/[permitId]/history/page.tsx) | Workspace History section | S4 | Role-specific history access and immutable events | Source + browser |
| web | [/approvals/[permitId]](../../frontend/src/app/(app)/approvals/[permitId]/page.tsx) | Workspace Review section | S4 | Sticky decision with evidence and clear result | Source + browser |
| web | [/approvals/deferred](../../frontend/src/app/(app)/approvals/deferred/page.tsx) | Returned-work view after parity | S4 | Return reason, responsible editor and resume action | Source + browser |
| web | [/approvals](../../frontend/src/app/(app)/approvals/page.tsx) | Needs review queue after parity | S4 | Assignment-based API and approve-next semantics | Source + browser |
| web | [/billing](../../frontend/src/app/(app)/billing/page.tsx) | Retain specialist billing workspace | S5 | Current subscription before plan choice/history | Source + browser |
| web | [/closure/[permitId]](../../frontend/src/app/(app)/closure/[permitId]/page.tsx) | Workspace Review: close work | S4 | Remove duplicate headings; keep actor attestations | Source + browser |
| web | [/closure/archive/[permitId]](../../frontend/src/app/(app)/closure/archive/[permitId]/page.tsx) | Read-only workspace archive view | S4 | Evidence load failures visible; immutable history | Source + browser |
| web | [/closure/archive](../../frontend/src/app/(app)/closure/archive/page.tsx) | Finished/archive view using archive endpoint | S4 | Search semantics and closed record visibility | Source + browser |
| web | [/closure](../../frontend/src/app/(app)/closure/page.tsx) | Closing queue after parity | S4 | Distinguish issuer verification and final approval | Source + browser |
| web | [/dashboard](../../frontend/src/app/(app)/dashboard/page.tsx) | Retain Needs you; reduce competing summaries | S5 | Current task first; failed queues never all-clear | Source + browser |
| web | [/execution/[permitId]/evidence](../../frontend/src/app/(app)/execution/[permitId]/evidence/page.tsx) | Work evidence subsection | S4 | Preserve attachments and upload/error state | Source + browser |
| web | [/execution/[permitId]](../../frontend/src/app/(app)/execution/[permitId]/page.tsx) | Workspace Work section | S4 | Explicit prerequisites, completion and safety confirmation | Source + browser |
| web | [/execution/[permitId]/progress](../../frontend/src/app/(app)/execution/[permitId]/progress/page.tsx) | Work activity/history subsection | S4 | Preserve direct links and full progress feed | Source + browser |
| web | [/execution](../../frontend/src/app/(app)/execution/page.tsx) | Execution task view in permit queue | S4 | Approved, active, suspended retain distinct next actions | Source + browser |
| web | [/incidents/[id]](../../frontend/src/app/(app)/incidents/[id]/page.tsx) | Current-stage incident workspace | S5 | Evidence, investigator, corrective actions, sign-off | Source + browser |
| web | [/incidents/archive](../../frontend/src/app/(app)/incidents/archive/page.tsx) | Preserve closed-list redirect | S5 | Clear closed-state filters | Source |
| web | [/incidents/new](../../frontend/src/app/(app)/incidents/new/page.tsx) | Preserve report-panel redirect | S5 | Carry related permit context | Source |
| web | [/incidents](../../frontend/src/app/(app)/incidents/page.tsx) | Retain consolidated incident list/report panel | S5 | Fast reporting and clear follow-up owner | Source + browser |
| web | [/lototo/active](../../frontend/src/app/(app)/lototo/active/page.tsx) | Preserve active-list redirect | S5 | Retain deep-link query semantics | Source |
| web | [/lototo/execute/[planId]](../../frontend/src/app/(app)/lototo/execute/[planId]/page.tsx) | Current-point execution workspace | S5 | Locks/tags/checks/evidence grouped without skipping gates | Source + browser |
| web | [/lototo/history/[planId]](../../frontend/src/app/(app)/lototo/history/[planId]/page.tsx) | History in LOTOTO context; keep URL | S5 | Immutable sequence and evidence history | Source + browser |
| web | [/lototo](../../frontend/src/app/(app)/lototo/page.tsx) | Retain existing consolidated safety list | S5 | Concise filters; current next action visible | Source + browser |
| web | [/lototo/plans/[id]](../../frontend/src/app/(app)/lototo/plans/[id]/page.tsx) | Plan workspace: points, people, sequence | S5 | Keep configuration controls explicit and ordered | Source + browser |
| web | [/lototo/plans/new](../../frontend/src/app/(app)/lototo/plans/new/page.tsx) | Preserve contextual create panel redirect | S5 | Carry machinery/permit context where supported | Source |
| web | [/lototo/restoration/[executionId]](../../frontend/src/app/(app)/lototo/restoration/[executionId]/page.tsx) | Current restoration work and remaining blockers | S5 | Keep reverse sequence and confirmations | Source |
| web | [/lototo/restoration](../../frontend/src/app/(app)/lototo/restoration/page.tsx) | Preserve restoration-list redirect | S5 | Retain verified/restored filtering | Source |
| web | [/notifications/[id]](../../frontend/src/app/(app)/notifications/[id]/page.tsx) | Contextual message and related record | S5 | Missing target handling and read/unread semantics | Source |
| web | [/notifications](../../frontend/src/app/(app)/notifications/page.tsx) | Retain grouped inbox | S5 | Related task prominent; readable status | Source + browser |
| web | [/organisation/checklists](../../frontend/src/app/(app)/organisation/checklists/page.tsx) | Permit configuration checklist editor | S3 | Required items, deliberate archive confirmation | Source + browser |
| web | [/organisation/departments](../../frontend/src/app/(app)/organisation/departments/page.tsx) | Sites workspace: departments under plant | S3 | Parent preselected, data retained on errors | Source + browser |
| web | [/organisation/gas-testing](../../frontend/src/app/(app)/organisation/gas-testing/page.tsx) | Workstation configuration | S3 | Safe limits/units explicit; parent retained | Source + browser |
| web | [/organisation/hazards](../../frontend/src/app/(app)/organisation/hazards/page.tsx) | Permit configuration catalogue | S3 | Preserve severity and archived references | Source + browser |
| web | [/organisation/locations](../../frontend/src/app/(app)/organisation/locations/page.tsx) | Sites workspace: locations under plant | S3 | Parent selection carried forward | Source + browser |
| web | [/organisation/machinery](../../frontend/src/app/(app)/organisation/machinery/page.tsx) | Equipment within selected workstation | S3 | Reuse LOTOTO cross-links; distinguish empty/error | Source + browser |
| web | [/organisation/notifications](../../frontend/src/app/(app)/organisation/notifications/page.tsx) | Readiness/preferences work area | S3 | Optional state separate from operational blockers | Source + browser |
| web | [/organisation](../../frontend/src/app/(app)/organisation/page.tsx) | Administration overview linked to five work areas | S3 | Reduce hub-to-hub navigation | Source + browser |
| web | [/organisation/permit-types](../../frontend/src/app/(app)/organisation/permit-types/page.tsx) | Permit configuration entry with related templates | S3 | Avoid repeated type selection | Source + browser |
| web | [/organisation/plants](../../frontend/src/app/(app)/organisation/plants/page.tsx) | Sites workspace: plant context | S3 | Reuse Add/edit and suggested code | Source + browser |
| web | [/organisation/ppe](../../frontend/src/app/(app)/organisation/ppe/page.tsx) | Permit configuration catalogue | S3 | Readable category/quantity; no unsafe default | Source + browser |
| web | [/organisation/profile](../../frontend/src/app/(app)/organisation/profile/page.tsx) | Organisation work area; retain direct URL | S3 | Short visible form; timezone clarity | Source + browser |
| web | [/organisation/setup](../../frontend/src/app/(app)/organisation/setup/page.tsx) | Five-group direct-access setup | S3 | Accurate readiness and unsaved-data protection | Source + browser |
| web | [/organisation/templates/[id]](../../frontend/src/app/(app)/organisation/templates/[id]/page.tsx) | Retain specialist editor within context | S3 | Keep preview, dirty guard, snapshot semantics | Source |
| web | [/organisation/templates](../../frontend/src/app/(app)/organisation/templates/page.tsx) | Templates in permit configuration | S3 | Clear linked types and publication status | Source + browser |
| web | [/organisation/workflows](../../frontend/src/app/(app)/organisation/workflows/page.tsx) | People/responsibilities: approval configuration | S3 | Describe actual configurable gate, preserve RBAC | Source + browser |
| web | [/organisation/workstations](../../frontend/src/app/(app)/organisation/workstations/page.tsx) | Sites workspace: workstations under location | S3 | Show full location path and dependent records | Source + browser |
| web | [/permits/[id]/edit](../../frontend/src/app/(app)/permits/[id]/edit/page.tsx) | Sectioned editor in permit context | S0a/S2 | Role ownership, dirty guard, save before submit | Source + browser |
| web | [/permits/[id]/execute](../../frontend/src/app/(app)/permits/[id]/execute/page.tsx) | Preserve existing execution redirect | S4 | Resolve into workspace Work section compatibly | Source |
| web | [/permits/[id]/journey](../../frontend/src/app/(app)/permits/[id]/journey/page.tsx) | History section with existing journey map | S4 | Keep timeline/anomalies and audit provenance | Source + browser |
| web | [/permits/[id]/multi-day](../../frontend/src/app/(app)/permits/[id]/multi-day/page.tsx) | Work section: daily operations | S4 | Distinct progress/handover/revalidation actions | Source + browser |
| web | [/permits/[id]](../../frontend/src/app/(app)/permits/[id]/page.tsx) | Canonical permit workspace overview | S4 | One header, next owner/action, visible blockers | Source + browser |
| web | [/permits/[id]/preview](../../frontend/src/app/(app)/permits/[id]/preview/page.tsx) | Retain dedicated print preview | S4 | Historical form snapshots and full evidence labels | Source + browser |
| web | [/permits/drafts](../../frontend/src/app/(app)/permits/drafts/page.tsx) | Draft view of permit queue after parity | S4 | Preserve creator visibility and edit action | Source + browser |
| web | [/permits/new](../../frontend/src/app/(app)/permits/new/page.tsx) | Sectioned permit editor | S0a/S2 | Full first save; deliberate assignment and safety answers | Source + browser |
| web | [/permits](../../frontend/src/app/(app)/permits/page.tsx) | Canonical work queue with concise filters | S4 | Preserve counts, roles and URL state | Source + browser |
| web | [/permits/process](../../frontend/src/app/(app)/permits/process/page.tsx) | Keep process reference; link from context/history | S4 | Actual server transitions and readable map | Source + browser |
| web | [/platform/tenants](../../frontend/src/app/(app)/platform/tenants/page.tsx) | Retain platform administration | S5 | Invitation result, selected tenant context, confirmations | Source + browser |
| web | [/reports](../../frontend/src/app/(app)/reports/page.tsx) | Retain registers/summary | S5 | Filters and sorting preserved on return | Source + browser |
| web | [/safety](../../frontend/src/app/(app)/safety/page.tsx) | Preserve dashboard redirect | S5 | Role-specific Needs you remains entry | Source |
| web | [/settings](../../frontend/src/app/(app)/settings/page.tsx) | Personal settings with one admin entry | S5 | Themes/modes/densities/styles preserved | Source + browser |
| web | [/simops/conflicts/[id]](../../frontend/src/app/(app)/simops/conflicts/[id]/page.tsx) | Contextual risk/mitigation/decision workspace | S5 | Role-aware current action; reject entry on demand | Source + browser |
| web | [/simops/conflicts](../../frontend/src/app/(app)/simops/conflicts/page.tsx) | Preserve active-list redirect | S5 | Existing query behavior | Source |
| web | [/simops/history/[id]](../../frontend/src/app/(app)/simops/history/[id]/page.tsx) | Retain read-only conflict history | S5 | Readable participants, mitigation and outcome | Source |
| web | [/simops/history](../../frontend/src/app/(app)/simops/history/page.tsx) | Preserve history-list redirect | S5 | Resolved data endpoint semantics | Source |
| web | [/simops](../../frontend/src/app/(app)/simops/page.tsx) | Retain consolidated active/resolved list | S5 | Clear overlap context and concise filters | Source + browser |
| web | [/unauthorized](../../frontend/src/app/(app)/unauthorized/page.tsx) | Retain permission recovery screen | S1/S5 | Clear reason and safe permitted destination | Source |
| web | [/workforce/agencies](../../frontend/src/app/(app)/workforce/agencies/page.tsx) | Related agencies view | S3 | Agency remains a separate entity | Source + browser |
| web | [/workforce/certifications](../../frontend/src/app/(app)/workforce/certifications/page.tsx) | Selected-person certificates | S3 | Expiry remains visible and filterable | Source + browser |
| web | [/workforce/competencies](../../frontend/src/app/(app)/workforce/competencies/page.tsx) | Selected-person capabilities | S3 | Correct setup mapping and contextual preselection | Source + browser |
| web | [/workforce/contractors](../../frontend/src/app/(app)/workforce/contractors/page.tsx) | People view: contractors | S3 | Agency relation retained | Source + browser |
| web | [/workforce/directory](../../frontend/src/app/(app)/workforce/directory/page.tsx) | Canonical people list and selected-person detail | S3 | Manage opens selected person, not entire list | Source + browser |
| web | [/workforce/employees](../../frontend/src/app/(app)/workforce/employees/page.tsx) | People view: employees | S3 | Reuse account provisioning and record IDs | Source + browser |
| web | [/workforce](../../frontend/src/app/(app)/workforce/page.tsx) | People workspace entry | S3 | Search and context instead of another hub | Source + browser |
| web | [/workforce/roles](../../frontend/src/app/(app)/workforce/roles/page.tsx) | Account access within People | S3 | Account-only users supported; role confirmation | Source + browser |
| web | [/forgot-password](../../frontend/src/app/(auth)/forgot-password/page.tsx) | Retain focused recovery page | S1/S5 | Accessible success and resend feedback | Source + browser |
| web | [/join](../../frontend/src/app/(auth)/join/page.tsx) | Retain invitation entry | S5 | Explain organisation and next step | Source + browser |
| web | [/login](../../frontend/src/app/(auth)/login/page.tsx) | Retain Keycloak-backed sign-in | S1/S5 | Inline errors and password/return flow | Source + browser |
| web | [/reset-password](../../frontend/src/app/(auth)/reset-password/page.tsx) | Retain focused recovery page | S1/S5 | Invalid-link recovery and field feedback | Source + browser |
| web | [/cookies](../../frontend/src/app/(marketing)/cookies/page.tsx) | Retain legal view | S5 | Readable table/reflow | Source + browser |
| web | [/](../../frontend/src/app/(marketing)/page.tsx) | Retain public landing; simplify only shared spacing/focus | S5 | Keep access request/sign-in intent distinct | Source + browser |
| web | [/privacy](../../frontend/src/app/(marketing)/privacy/page.tsx) | Retain legal view | S5 | Shared layout and readable navigation | Source + browser |
| web | [/register](../../frontend/src/app/(marketing)/register/page.tsx) | Retain Request access | S5 | Submission outcome and clear next owner | Source + browser |
| web | [/terms](../../frontend/src/app/(marketing)/terms/page.tsx) | Retain legal view | S5 | Shared layout; no legal-content rewrite | Source + browser |
| mobile | [/](../../mobile/app/(app)/(tabs)/index.tsx) | Task-oriented Home; absorb separate dashboard | S6 | Remove foundation diagnostics from daily work | Source |
| mobile | [/settings](../../mobile/app/(app)/(tabs)/settings.tsx) | Personal settings and sync recovery | S6 | Pending/failed queue visible, accessible theme controls | Source |
| mobile | [/organisation/departments](../../mobile/app/(app)/organisation/departments.tsx) | Organisation reference in context; keep cached directories | S6 | Readable parent/name, cache freshness, empty vs unavailable | Source |
| mobile | [/organisation](../../mobile/app/(app)/organisation/index.tsx) | Organisation reference in context; keep cached directories | S6 | Readable parent/name, cache freshness, empty vs unavailable | Source |
| mobile | [/organisation/locations](../../mobile/app/(app)/organisation/locations.tsx) | Organisation reference in context; keep cached directories | S6 | Readable parent/name, cache freshness, empty vs unavailable | Source |
| mobile | [/organisation/plants](../../mobile/app/(app)/organisation/plants.tsx) | Organisation reference in context; keep cached directories | S6 | Readable parent/name, cache freshness, empty vs unavailable | Source |
| mobile | [/organisation/profile](../../mobile/app/(app)/organisation/profile.tsx) | Organisation reference in context; keep cached directories | S6 | Readable parent/name, cache freshness, empty vs unavailable | Source |
| mobile | [/platform](../../mobile/app/(app)/platform.tsx) | Diagnostics destination | S6 | Version/API/storage details live here | Source |
| mobile | [/workforce/certifications](../../mobile/app/(app)/workforce/certifications.tsx) | People reference and capability views | S6 | Readable person/expiry, search, authorized cached selections | Source |
| mobile | [/workforce/competencies](../../mobile/app/(app)/workforce/competencies.tsx) | People reference and capability views | S6 | Readable person/expiry, search, authorized cached selections | Source |
| mobile | [/workforce/directory](../../mobile/app/(app)/workforce/directory.tsx) | People reference and capability views | S6 | Readable person/expiry, search, authorized cached selections | Source |
| mobile | [/workforce](../../mobile/app/(app)/workforce/index.tsx) | People reference and capability views | S6 | Readable person/expiry, search, authorized cached selections | Source |
| mobile | [/workforce/profile](../../mobile/app/(app)/workforce/profile.tsx) | People reference and capability views | S6 | Readable person/expiry, search, authorized cached selections | Source |
| mobile | [/login](../../mobile/app/(auth)/login.tsx) | Retain native Keycloak sign-in | S6 | Clear cancel/error outcome and return flow | Source |
| mobile | [/approvals/[id]/history](../../mobile/app/approvals/[id]/history.tsx) | History in record context | S6 | Readable actors/times, offline freshness and errors | Source |
| mobile | [/approvals/[id]](../../mobile/app/approvals/[id].tsx) | Contextual review and explicit decision | S6 | Named location, evidence and comment preservation | Source |
| mobile | [/approvals](../../mobile/app/approvals/index.tsx) | Review queue within work navigation | S6 | Assignment scope and next action preserved | Source |
| mobile | [/closure/[id]](../../mobile/app/closure/[id].tsx) | Closing task in permit context | S6 | Queued verification never implies authorized closure | Source |
| mobile | [/closure/archive/[id]](../../mobile/app/closure/archive/[id].tsx) | Read-only finished-work view | S6 | Immutable evidence, errors distinguishable from none | Source |
| mobile | [/closure/archive](../../mobile/app/closure/archive/index.tsx) | Read-only finished-work view | S6 | Immutable evidence, errors distinguishable from none | Source |
| mobile | [/closure](../../mobile/app/closure/index.tsx) | Closing task in permit context | S6 | Queued verification never implies authorized closure | Source |
| mobile | [/dashboard](../../mobile/app/dashboard/index.tsx) | Combine useful dashboard content into Home | S6 | Role-aware work entry, keep legacy link | Source |
| mobile | [/execution/[id]/evidence](../../mobile/app/execution/[id]/evidence.tsx) | Work context with progress/evidence sections | S6 | Explicit prerequisites and server-confirmed status | Source |
| mobile | [/execution/[id]/progress](../../mobile/app/execution/[id]/progress.tsx) | Work context with progress/evidence sections | S6 | Explicit prerequisites and server-confirmed status | Source |
| mobile | [/execution/[id]](../../mobile/app/execution/[id].tsx) | Work context with progress/evidence sections | S6 | Explicit prerequisites and server-confirmed status | Source |
| mobile | [/execution](../../mobile/app/execution/index.tsx) | Work context with progress/evidence sections | S6 | Explicit prerequisites and server-confirmed status | Source |
| mobile | [/incidents/[id]](../../mobile/app/incidents/[id].tsx) | Incident follow-up in one context | S6 | Select investigator/owner by name; role/stage controls | Source |
| mobile | [/incidents](../../mobile/app/incidents/index.tsx) | Task-oriented incident list | S6 | Priority text/icon and report action | Source |
| mobile | [/incidents/new](../../mobile/app/incidents/new.tsx) | Short contextual incident report | S6 | Visible labels and accurate offline save/submit result | Source |
| mobile | [/](../../mobile/app/index.tsx) | Retain authenticated routing entry | S6 | Preserve login/session route guards | Source |
| mobile | [/lototo/[id]](../../mobile/app/lototo/[id].tsx) | Plan configuration in one record context | S6 | Sequential points and personnel preserved | Source |
| mobile | [/lototo/active](../../mobile/app/lototo/active.tsx) | Consolidate plan/active/restoration views | S6 | Preserve distinct action roles and deep links | Source |
| mobile | [/lototo/execute/[planId]](../../mobile/app/lototo/execute/[planId].tsx) | Current-point isolation actions | S6 | Locks, tags, verification, evidence remain deliberate | Source |
| mobile | [/lototo/history/[planId]](../../mobile/app/lototo/history/[planId].tsx) | History in record context | S6 | Readable actors/times, offline freshness and errors | Source |
| mobile | [/lototo](../../mobile/app/lototo/index.tsx) | Consolidate plan/active/restoration views | S6 | Preserve distinct action roles and deep links | Source |
| mobile | [/lototo/new](../../mobile/app/lototo/new.tsx) | Contextual plan creation | S6 | Machinery selection with visible dependency | Source |
| mobile | [/lototo/restoration/[executionId]](../../mobile/app/lototo/restoration/[executionId].tsx) | Restoration tasks with remaining blockers | S6 | No queued/offline success claim before server result | Source |
| mobile | [/lototo/restoration](../../mobile/app/lototo/restoration/index.tsx) | Restoration tasks with remaining blockers | S6 | No queued/offline success claim before server result | Source |
| mobile | [/multi-day/[permitId]](../../mobile/app/multi-day/[permitId].tsx) | Daily operations inside work context | S6 | Progress/handover/revalidation ownership and date preserved | Source |
| mobile | [/notifications/[id]](../../mobile/app/notifications/[id].tsx) | Inbox with direct related-task access | S6 | Read/unread and offline state explicit | Source |
| mobile | [/notifications](../../mobile/app/notifications/index.tsx) | Inbox with direct related-task access | S6 | Read/unread and offline state explicit | Source |
| mobile | [/permits/[id]/edit](../../mobile/app/permits/[id]/edit.tsx) | Native sectioned permit editor | S0a+S0b/S6 | Five/six-step compatibility, templates, roles, timezone, offline draft | Source |
| mobile | [/permits/[id]](../../mobile/app/permits/[id].tsx) | Stable permit context and next action | S6 | Names instead of identifiers, clear safety blockers | Source |
| mobile | [/permits](../../mobile/app/permits/index.tsx) | Task-filtered permits list | S6 | Readable state/action and cached/queued indicators | Source |
| mobile | [/permits/new](../../mobile/app/permits/new.tsx) | Native sectioned permit editor | S0a+S0b/S6 | Five/six-step compatibility, templates, roles, timezone, offline draft | Source |
| mobile | [/simops/[id]](../../mobile/app/simops/[id].tsx) | Current risk/mitigation/decision stage | S6 | Role gating, contextual labels and queued status | Source |
| mobile | [/simops](../../mobile/app/simops/index.tsx) | Readable clashes list | S6 | Participant context and related record actions | Source |

Source links are relative to the plan directory; implementation slice references point to `implementation-plan.md`.
