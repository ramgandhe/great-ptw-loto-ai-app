# UX audit and redesign: persona walkthrough

Date: 27 September 2026. Branch: `dev_ram`. Method: signed in as each demo persona against the local
stack, captured every primary screen, and traced each hand-off in the permit lifecycle.

## Cross-cutting findings

| # | Problem | Evidence | Change |
|---|---|---|---|
| 1 | No "what needs me" view. Home repeated the same four counts twice (Summary and KPIs) and listed no work. | Dashboard, all personas | Home now opens on **Needs you**: every permit, SIMOPS conflict and incident waiting on this person, grouped by action, each with one button to the screen that does the job. KPIs moved below as a compact row. |
| 2 | 8 to 17 flat nav links; Permits, Active work, Drafts, Execution and Closure are the same permits sliced by status, and "Active work" appeared twice for some roles. | Sidebar | Nav grouped into Work, Safety, Insights and Administration, with a count badge on each item that has work waiting. Duplicate "Active work" removed. Sidebar is full height, sticky, and becomes a drawer on phones. |
| 3 | Theme, density, style and mode dropdowns in every user's header. | Header | Replaced by a user menu (profile, light or dark, sign out). Full appearance settings stay on Settings. |
| 4 | No way to find a permit except by browsing lists. | All | **Search and jump** (Ctrl K or `/`): permits by reference or title, pages, and actions such as Create permit. |
| 5 | Raw data leaked into the UI: executor shown as a UUID, dates as `2026-08-10T09:00`, reference fallbacks as `abcd1234`, 38 screens using the browser's default date format. | Permit detail, closure, LOTOTO, SIMOPS | Shared formatter (`lib/format.ts`) and name lookup (`lib/lookups.ts`, merging login users and workforce records). All UUID fallbacks replaced with readable text. |
| 6 | **Data bug**: editing a permit shifted its planned times by the UTC offset on every save (5 h 30 min in India). | `toDateInputValue` sliced the UTC string | Converted to local time before editing (`lib/permit/form.ts`). |
| 7 | Permit detail repeated title, reference and status twice and showed empty fields as "—" rows. | Permit, approval, execution | Permit sheet reorganised into Work, Where (as a path), When, Safety controls and People. Missing information is called out in one line at the top. Pages that already show the title pass `showHeader={false}`. |
| 8 | Cross-links missing: SIMOPS conflicts named permits without linking; incidents loaded their related permits and equipment but never showed them. | SIMOPS conflict, incident detail | Linked. The permit page gained a Related records panel (approval history, execution, daily progress, LOTOTO, print view). |
| 9 | Admin screens (12 organisation and 4 workforce pages) opened with the create form permanently expanded, no search, and parent records (workstation, department, agency) hidden. | Organisation and Workforce | Form behind **Add**, search, parent column, code suggested from the name, **Add and add another** keeps the parent selected, click a row to edit. |
| 10 | Pages were hard-coded to 32 px padding and a small heading, cramped on phones. | 46 screens | Responsive padding and one heading style. |

## Persona by persona

### Job issuer
- **Before:** create a permit from an empty form across five steps; type title, scope, and pick four date and time values; no copy of earlier work; permits list had three status chips and no search.
- **After:** start from a recent permit (copies type, scope, place, crew and controls); permit type chosen from colour-coded tiles; one-tap schedules (today, tomorrow's shift, five days). Permits list has search, lifecycle stages with counts, type, place and planned window, and the issuer's next step per row. Deferred and rejected permits surface in Needs you as "Sent back to you".

### Job executor (operator)
- **Before:** execution screen led with the full permit sheet; progress updates were typed from scratch; no phone layout for the sidebar.
- **After:** Needs you shows "Approved, ready to start" and "In progress" with overdue warnings. The execution screen leads with the task (start work, progress, photos); the permit details fold away once work starts; progress notes have one-tap phrases. Navigation works as a drawer on phones.

### Head of department (HOD)
- **Before:** approval queue cards gave only title, reference and stage; the decision buttons sat at the bottom of a long page in pop-up dialogs; after a decision the HOD returned to the queue.
- **After:** the queue shows type, place, window and how long each permit has waited, oldest first. The review screen puts the permit sheet beside a sticky decision panel; gaps are flagged before deciding; reasons for sending back or rejecting are one tap (the permit's own gaps are offered first); **Approve and open next** moves straight to the next permit. Open SIMOPS conflicts and incident decisions also appear in Needs you.

### Safety officer
- **Before:** Approvals and Deferred in the nav led to "Insufficient permissions"; SIMOPS (listed as a primary safety user in the PRD) did too; Permits was hidden although the API allows reading assigned permits; the API's safety veto had no screen.
- **After:** nav shows only what the role can use (the frontend role lists now match the API). Safety officers can read SIMOPS conflicts and master data (read only; analysis, resolution and editing unchanged). Needs you shows assigned permits waiting for a safety check and incidents to investigate, verify or close. The permit page has **Stop work (safety veto)** with one-tap reasons.

### Organisation owner and admin
- **After:** everything above plus the rebuilt admin screens (finding 9).

### Viewer
- Read-only access is unchanged; benefits from search, readable permit sheets and cross-links.

## Analytics and reports (second pass)

Reports are now read on screen instead of generated as files. `GET /analytics/insights?days=` and
`GET /reports/view?type=&days=` compute live, tenant-scoped figures; the Analytics and Reports pages,
the home page and the incident and active-work lists render them with Recharts and Framer Motion
(one staggered entrance per page, count-up figures, reduced motion respected).

| Persona | Where | What they see, in order of attention |
|---|---|---|
| HOD, safety officer, owner, admin | Home, Site at a glance | Work past planned end, approvals waiting over a day, high-severity SIMOPS clashes, serious open incidents (each links to where it is fixed) |
| HOD, safety officer, owner, admin | Analytics | Needs attention strip; permits raised and closed over time; permits by lifecycle stage; typical time to an approval decision and how long pending permits have waited; incidents by type, priority and over time; SIMOPS by severity; corrective actions open, overdue, done; permits by type, department and busiest places |
| HOD, safety officer, owner, admin | Reports | Permit register and incident register (search, stage or priority filter, sortable, every row opens its record), operational summary; period selectable; cards on phones |
| Job issuer, executor, viewer | Home, Your permits | Permits they can see, how many are approved or in progress, where their permits stand by stage, what starts in the next 7 days |
| Everyone | Incidents, Active work, Messages | Open incidents first by priority; suspended work first with overdue flags; repeated messages grouped and linked to their records |

Removed: file export UI (`generate` and download on Reports), the duplicate KPI grid and dashboard-kind
selector on Home, the old trends panel and notification list components.

Demo data note: every seeded permit was created on the day of seeding, so time-series charts show a
single spike until real history accumulates. Repeated SIMOPS analysis runs have also created duplicate
conflicts in the local database.

## Open items that need a product decision

1. **Safety officer assignment.** No demo permit has a safety officer assigned, so the safety queue is empty in demo data. Decide whether safety officers see all permits in their plant or only those they are assigned to.
2. **SIMOPS role for safety officers.** Read access was added to match PRD 4.6. Decide whether they should also assess conflicts.
3. **Approval routing for safety.** The PRD describes a safety officer approval stage; the implementation uses a veto instead. Confirm which is intended.
4. **Mobile field app.** The web app is now usable on a phone, but the `mobile/` Expo app was not part of this pass.

## Verification

- Type-check clean; new code lints clean (remaining lint errors are pre-existing `set-state-in-effect` patterns in files not restructured).
- API tests: role changes covered by `tests/master-data-roles.spec.ts` and `tests/simops-roles.spec.ts`.
- Browser checks as HOD, issuer, operator, safety officer and org admin at desktop and 390 px width: search palette opens the right permit, approval reason prefill and "open next" label, drawer closes after navigating, permit search persists in the URL, no horizontal overflow.
