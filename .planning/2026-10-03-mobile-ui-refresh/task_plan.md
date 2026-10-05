# Mobile UI refresh to the web design system

Goal: the Expo app looks and behaves like the current web app at phone width (docs/specs/latest_ui_platform.html,
frontend/src/styles/themes.css), replacing the older dev_vinesh look (plain white, system font, 8 px corners, #ea580c).

Reference screenshots of the web at 390 px: scratchpad webref/*.png (home, permits, new permit, approvals, LOTOTO, incidents, permit, login).

## Web standard to match
- Canvas grey background; white surfaces with large radius and soft shadow (Hazard: radius 14-32, no border, shadow-md).
- Display font per theme (Hazard Sora 800, Control room Space Grotesk, Setu Baloo 2, Ledger Slate Source Serif 4); body Inter / IBM Plex Sans / Noto Sans; mono IBM Plex Mono for references.
- Page title: accent bar + large display heading + secondary subtitle; back link above.
- Buttons: pill (radius-full); primary accent fill, secondary sunken, outline, ghost, destructive tint, success tint ("Continue").
- Status chip: tinted in its colour with a dot; permit-type chip with type colour; mono reference chip.
- Segmented tabs with counts, pill search field, Filters button, sticky bottom action bar.
- Section header with a coloured dot + description; cards with a left status bar.
- Tokens per theme x light/dark, compact density scale, strict style (small radius, IBM Plex Sans display).

## Stages
| Stage | Scope | Status |
|---|---|---|
| M1 | Tokens ported from themes.css (4 themes x 2 modes, compact, strict), fonts loaded, UI kit (Screen, PageTitle, Card, Button, TextField, StatusChip, TypeChip, RefChip, Tabs, SearchField, ActionBar, Banner, EmptyState, SectionHeader), stack/tab chrome, Login, Home | complete (user checked on device) |
| M2 | Permits: list, detail, editor (wizard + forms + stage answers), approvals, closure, archive | complete (user checked on device) |
| M3 | LOTOTO (list, new, detail, execute, restoration, history, active), execution, multi-day, SIMOPS | complete (user checked on device) |
| M4 | Incidents, notifications, dashboard, settings/theme, organisation, workforce, platform, offline banners | complete (user checked on device) |
| M5 | Sweep: no raw hex / ad-hoc styles left, 44 px targets, dark mode and 4 themes, tsc, Android export, phone check | built; device matrix with the user |

## Decisions
- Fonts via @expo-google-fonts packages + expo-font (all in Expo Go); only the weights the web loads.
- Keep the existing preference model (theme, density, visualStyle, mode) and useThemedStyles.
- Each stage committed after the user checks it on the phone.

## Next Step
User runs the device checklist (themes x modes, compact, strict, largest font, TalkBack); fix findings; commit when the user asks.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Bundle grew to 3,100 modules (lucide root import) | 1 | Per-file icon imports in components/ui/icons.ts: 1,274 |
| expo-font useFonts loads only on mount | 1 | loadAsync in the provider, theme applied after its fonts load |
