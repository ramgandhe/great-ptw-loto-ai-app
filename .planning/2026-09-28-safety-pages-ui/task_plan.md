# Task plan: Safety pages on the shared UI system

## Goal
LOTOTO, SIMOPS and Incidents use the same header, back navigation, view switch (toggle not buttons), filters (multi toggle), hero stats (StatTile), grouped status colours (chip badges) and button styles as Permits/Reports; "New LOTOTO plan" and "Report incident" open an in-page panel like "Add plant" instead of a separate page.

## Next Step
Done. Awaiting user review; nothing committed.

### Phase 1: Survey
**Status:** complete

### Phase 2: Read remaining pages and forms
**Status:** complete
- lototo/active, lototo/restoration, simops/conflicts, simops/history, incidents/archive
- lototo/plans/new, incidents/new (forms to embed)

### Phase 3: Shared safety status palette
**Status:** complete
- One status list per domain (LOTOTO plan, isolation execution, incident, conflict, severity) with grouped colours via .chip; replace bespoke badges

### Phase 4: Index pages
**Status:** complete
- [x] LOTOTO (views plans/active/restoration, stats, status filter, create panel)
- [x] SIMOPS
- [x] Incidents
- PageHeader + SegmentedToggle view switch replacing button navigation (LOTOTO: Plans/Active/Restoration; SIMOPS: Overview/Active/History; Incidents: Open/Closed(archive))
- StatTile hero stats, MultiToggle filters, row-hover, table-head, reference chips

### Phase 5: In-page create panels
**Status:** complete
- [x] components/safety/create-panels.tsx (LototoPlanCreatePanel, IncidentReportPanel)
- [x] old routes redirect (lototo/active, restoration, plans/new, simops/conflicts, history, incidents/archive, new)
- Extract form bodies of lototo/plans/new and incidents/new into components; open inline (reveal-in) from the index page; keep old routes redirecting/working

### Phase 6: Detail pages back navigation + verify
**Status:** complete
- BackLink on all Safety detail pages; lint, tsc, rebuild, screenshots light/dark

## Decisions Made
| Decision | Why |
|---|---|
| Sub-views become a SegmentedToggle (?view=) on one index page; old sub-routes redirect there | user: "why buttons" for navigation; deep links keep working |
| Incident archive merges into Incidents "Closed" view | archive = closed incidents; one list, one filter set |
| BackLink becomes a plain arrow text link (not a pill) | user: "back navigation (why button?)" |
| Safety statuses reuse --st-* families: amber=awaiting decision, green=live/safe, violet=verifying, rose=needs attention, slate=done | same colour meaning as permits |
| /lototo/plans/new and /incidents/new redirect to index with ?new=1 (keeps machineryId/permitId) | in-page create like Add plant; old links from machinery and permit pages still work |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Incidents page crashed after "Submit report" (reading 'replace' of undefined) | 1 | createIncident typed as Incident but API returns IncidentDetail {incident,...}; unwrapped in lib/incidents/api.ts (old /incidents/new also redirected to /incidents/undefined) |
