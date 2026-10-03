# Progress

## 2026-10-03 — M1 built (not committed; waiting for the phone check)
- Theme: mobile/src/theme/web-themes.ts generated from frontend themes.css + globals.css status colours by
  mobile/scripts/sync-web-themes.cjs; tokens.ts maps them (4 themes x light/dark, compact scale, strict radii,
  per-theme shadow and border width); fonts.ts loads the web's faces per theme (one file per weight).
- Theme provider applies a theme only after its fonts load (no flash, navigation kept).
- Kit (mobile/src/components/ui): AppText, Screen, PageHeader, BackLink, SectionTitle, Card, ActionBar,
  Button, TextField, SearchField, FieldFrame, Chip, PermitStatusChip, PermitTypeChip, RefChip, Banner,
  EmptyState, Tabs, BrandMark, icons.ts (per-file Lucide imports).
- Screens: Sign in, Home (Needs you grouped with action colours, PermitCard), Settings (appearance choices,
  sync card), tab bar with icons; native headers on other screens take the canvas colour and display font.
- Shared: lib/format.ts (copy of web), permit status labels and type families, permit type names + colours.
- Checks: mobile tsc clean; Android export 1,274 modules (3,100 before per-file icons).
- Not verified: on a phone (no device attached here).

## 2026-10-03 — M1 checked on device by the user; M2 built (not committed)
- Kit additions: ScreenState, InfoList, ProgressBar, TimelineItem, FileRow, DateTimeField (native date then time
  picker; replaces typed ISO dates), ToggleRow, CheckRow, SearchField onSubmit; SelectField restyled (pill, full-screen
  list, search when > 8 options, tick on the choice); template form fill and stage signatures restyled via their styles.
- Screens: permits list (tabs, search, cards, phone-only drafts marked), permit detail (summary, approval progress,
  pinned actions), editor (section cards, switches for LOTOTO / gas testing, banners for conflicts and errors, pinned
  Save / Submit), approvals list, decision (stages with markers, Approve / Defer / Reject choice, inline errors instead
  of alerts), approval history (timeline), closure list, verify / close (tick boxes, pinned actions), archive list
  (search on enter) and archived permit (files with Open).
- Native headers for these routes are hidden in the root layout (no flash); execution keeps its header until M3.
- Checks: mobile tsc clean; Android export 1,300 modules; no unused imports in changed files.

## 2026-10-03 — M2 checked on device by the user; M3 built (not committed)
- Kit additions: SafetyStatusChip + lib/safety-status.ts (copy of the web's LOTOTO / isolation / incident / SIMOPS
  status families), SeverityChip, DateTimeField dateOnly, components/lototo/point-stepper.tsx (shared by lock-out and
  restoration).
- Screens: work in progress list, permit work (pinned Start / Resume, progress and evidence cards, suspend on request),
  progress timeline, evidence (files open), LOTOTO home (isolate / restore shortcuts, plans), isolate list, new plan
  (inline field errors), plan set-up (numbered points, people, pinned Save sequence), lock-out (progress bar, point
  stepper, Lock / Tag / Verify steps, finished points, pinned whole-isolation action), restore list and restoration,
  LOTOTO history (timeline), work clashes list and detail (overlap banner, permits, assess / mitigate / approve steps,
  reject on request), multi-day (tabs; date pickers instead of typed dates; whole directory for handover).
- Execution's native headers removed from the root layout.
- Checks: mobile tsc clean; Android export 1,315 modules; no old StyleSheet styling or unused imports in stage 3 files.

## 2026-10-03 — M3 checked on device by the user; M4 built (not committed)
- Kit: ChoiceGroup (now also used by approvals decision, multi-day outcome and appearance settings, replacing three
  hand-written copies); INCIDENT_TYPE_LABELS in lib/safety-status.ts.
- Shared screens: components/record-list-screen.tsx (searchable read-only lists) replaces three near-identical list
  components (deleted); components/hub-links.tsx for the Organisation and Workforce hubs.
- Screens: incidents list / report (type choice, inline errors, pinned Save draft / Submit) / detail (summary,
  investigation steps, pinned Verify / Close; offline submit now says it was saved on the phone), messages list (tabs,
  unread marker, Open record) / detail, site figures (tabs, figure tiles), organisation and workforce hubs, profiles and
  six reference lists, platform status.
- Deleted src/theme/use-themed-styles.ts (no longer used).
- Checks: mobile tsc clean; Android export 1,319 modules; all 154 source files: no unused imports, no raw hex colours
  outside the theme, no hand-set font weights outside the form fill.

## 2026-10-03 — M4 checked on device by the user; M5 sweep (not committed)
- Contrast: 60 text/colour pairs in the web theme tokens fell below WCAG (accent links and Hazard's white-on-#ff4530
  buttons, status text and banners, 6 status chips, field edges ~1.4:1). Added readable()/blend() in tokens.ts and
  primaryFill / primaryText / inputBorder tokens; status text colours guarded on their banner and on cards; chips,
  tint/danger/ghost buttons, choice pills, section counts and number circles use them; placeholders use muted text.
  Re-measured on the real token output (esbuild bundle of tokens.ts): all pairs pass in 4 themes x 2 modes x 2 styles.
  Visible change: Hazard buttons #ff4530 -> #d93b29 (light), #ff5a3c -> #cc4830 (dark); links #cc3726; Control Room
  dark buttons #3b82f6 -> #326fd1. Same gaps exist in the web tokens (not changed here).
- TalkBack / targets: every Pressable has a role; tabs raised 40 -> 44 px.
- Large font: button labels wrap to two lines, action bar wraps, number circles capped at 1.2x.
- Checks: mobile tsc clean; Android export builds.
