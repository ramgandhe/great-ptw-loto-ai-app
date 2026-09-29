# Findings: Safety pages UI

## Shared system already built (frontend/src)
- components/layout/page-header.tsx: PageHeader (sticky), BackLink, SectionTitle
- components/ui/toggle-group.tsx: SegmentedToggle (single), MultiToggle (multi, coloured chips)
- components/analytics/charts.tsx: StatTile (hero figures, tone warning/danger glow)
- lib/permit/status.ts + globals.css --st-* tokens: grouped permit status colours; .chip, .is-selected, .row-hover, .table-head, .press
- components/work/action-link.tsx: ActionLink coloured by action kind (--act-decide/fix/do/admin)
- Inline create pattern: components/organisation/entity-crud-page.tsx ("Add X" button opens .reveal-in form in page; Add / Add and add another / Cancel)

## Current Safety pages (what differs)
- lototo/page.tsx: own h1; "New LOTOTO plan" = <Link><Button> (nested button in link); "Active LOTOTO", "Restoration" are outline Buttons used as navigation to separate pages; plain list, no stats, no filters
- simops/page.tsx: own h1; "Active conflicts", "History" outline Buttons as navigation; hand-rolled stat boxes (text-2xl) not StatTile; ConflictSummaryCards separate
- incidents/page.tsx: own h1; "Archive" outline button as navigation; "Report incident" goes to /incidents/new page; uses StatTile already
- Status badges each bespoke: PlanStatusBadge (tailwind amber/emerald), IncidentStatusBadge (plain border, no colour), ConflictSeverityBadge (amber/destructive), ExecutionStatusBadge (components/isolation-execution)
- Status unions: LOTOTO plan draft|ready|in_execution|completed; incident draft|open|pending_hod_decision|investigating|pending_verification|verified|closed; conflict open|assessed|mitigation_planned|approved|rejected; severity low|medium|high
- Separate create pages: lototo/plans/new (187 lines), incidents/new (150 lines)
