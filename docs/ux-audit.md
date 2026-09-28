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

## Organisation setup wizard (third pass)

Setting up an organisation meant visiting 19 separate pages with no order, no sense of progress and no
guidance. `/organisation/setup` now walks the admin through them in dependency order: profile, site
structure (plants, departments, locations, workstations, machinery), safety catalogues (hazards, PPE),
permits (types, checklists, gas testing, templates), approval workflow, people (users, employees,
agencies, contractors, competencies) and notifications.

- Each step embeds the existing list page for the same records, so existing data is shown and can be
  added, edited, archived or deleted in place; the standalone pages are unchanged.
- Every step explains why it matters, gives typical examples, and warns when a step it depends on
  (for example Locations needing Plants) has nothing yet, with a link to fix it.
- Steps can be skipped; skipped steps and the last step are saved on the organisation
  (`organisations.setup_progress`, migration `0042`) so the wizard resumes where the admin left off.
- Progress shows steps done, skipped and to go, and a completion percentage (each step counts
  equally; the profile counts by fields filled). Optional steps are labelled. A review screen lists
  what is skipped, unfinished and done, and names the essential steps still blocking permits.
- The Organisation hub shows a progress card with Start, Continue or Open setup; the search palette
  has "Set up the organisation" for owners and admins.

## Permit templates from the reference permit pack

Templates were a name and code only. They now hold a form definition (sections of fields: yes / no /
not applicable checks, text, numbers with units, dates, times, single or multiple choice, and
name-date-time-signature blocks), are linked to the permit types they apply to
(`permit_templates.permit_type_ids`, migration `0043`), and can be duplicated as a draft.

- **Import reference set** adds the Fresenius Kabi Ranjangaon pack (SOP/ES/023-F1 to F9): the safe
  work permit (linked to every type) and eight check sheets. Electrical, height, hot work, confined
  space, excavation and EOT crane are linked by permit type code; hazardous area and machine shifting
  have no matching type yet and are flagged "Not linked". Duplicate items in the scanned excavation
  and civil sheets were merged. Importing again only adds templates that are missing.
- The editor adds, renames, reorders and deletes sections and fields, with help text, units and
  options, and a live preview of the form; draft or published status; unsaved-change guard.
- Permit types list the templates linked to them.
- Permits fill them in: the wizard has a **Forms & check sheets** step (between crew and review) showing the
  published templates linked to the permit type, permit forms first. Either the issuer or the assigned
  executor can complete it. Yes / No / N/A is one tap, "All yes" answers a section's open checks, and
  signatures have "Me, now". Fields marked "Fill from permit" (department, location, equipment, job
  description, dates, crew) start from what the permit already holds.
- Answers are stored on the permit (`permits.form_responses`, migration `0044`) with a copy of each
  form, so editing a template later never changes an issued permit. Submission is refused while any
  required answer is missing. The permit, approval and active-work pages show the filled forms, and
  any check answered "No" is flagged for the approver.
- Every Yes / No / N/A row in the reference set is required, as on the paper sheets. Starting a permit from a
  recent one copies the job but never its check-sheet answers or signatures. The print preview shows every
  form expanded.

## Open items that need a product decision

1. **Safety officer assignment.** No demo permit has a safety officer assigned, so the safety queue is empty in demo data. Decide whether safety officers see all permits in their plant or only those they are assigned to.
2. **SIMOPS role for safety officers.** Read access was added to match PRD 4.6. Decide whether they should also assess conflicts.
3. **Approval routing for safety.** The PRD describes a safety officer approval stage; the implementation uses a veto instead. Confirm which is intended.
4. **Mobile field app.** The web app is now usable on a phone, but the `mobile/` Expo app was not part of this pass.

## Verification

- Type-check clean; new code lints clean (remaining lint errors are pre-existing `set-state-in-effect` patterns in files not restructured).
- API tests: role changes covered by `tests/master-data-roles.spec.ts` and `tests/simops-roles.spec.ts`.
- Browser checks as HOD, issuer, operator, safety officer and org admin at desktop and 390 px width: search palette opens the right permit, approval reason prefill and "open next" label, drawer closes after navigating, permit search persists in the URL, no horizontal overflow.
