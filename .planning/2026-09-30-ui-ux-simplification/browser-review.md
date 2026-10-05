# Browser Review

Review date: 2026-09-30. Application: existing local Docker deployment at `http://localhost:3000`. No application code changed during this review.

## Method and coverage

Used Playwright with Chromium, normal UI sign-in, and the documented demo personas. Navigated pages without creating records or submitting lifecycle decisions. Captured page text, headings, visible controls inside `main`, route destinations, page errors, and selected screenshots.

| Persona / state | Recorded visits |
|---|---:|
| Organisation account (displayed Tenant Owner) | 26 |
| Issuer, including record details | 27 |
| HOD, including record details | 13 |
| Operator | 7 |
| Safety officer | 4 |
| Viewer | 5 |
| Platform administrator | 2 |
| Signed out / public | 9 |
| **Total** | **93** |

These visits cover **70 of 84 web route patterns**. Every web route and all 47 native screens received structural source review; see [route inventory](route-inventory.md). Browser evidence is in `browser-*.json`, with images in `screenshots/`.

Desktop viewport: 1440×1000. Nineteen selected visits also captured 390×844 views. Reduced motion was enabled. No horizontal overflow was detected by the recorded viewport checks, and no JavaScript page errors were captured. All recorded page navigations returned HTTP 200. These observations establish page loading only; they do not prove successful API responses, accessibility, or workflow completion.

## Observed interaction problems

- **Setup:** the narrow layout puts the first form below the initial viewport, after title, progress, navigation and repeated guidance. Desktop screenshot shows the bottom action bar competing with the form's own save controls. Source review confirms the outer “Save and exit” saves progress metadata rather than the visible entity.
- **Create permit:** step navigation, draft messaging and repeated container headings compete with initial entry. The saved-state wording is broader than what persistence guarantees. Source review found incomplete first saves and existing-draft submission that can skip current edits.
- **Permit queue:** the narrow layout has a large filter area before record content. Preserve URL filters while reducing their initial visual footprint.
- **Approval:** the mobile review starts with a large multiline title and full evidence card. Preserve evidence and missing-data warnings while providing compact context and navigation to the decision. The visited seed record has missing information and old schedule dates; this is fixture state, not proof of a validation bypass.
- **Closure:** the narrow screenshot repeats the permit title under “Verify & close” and again inside the evidence card. Three headings consume space before the first useful details. Use one record header with a clear current responsibility.
- **Role entry points:** Home already has “Needs you” and role-specific content. Build on that behavior. The organisation demo account is displayed as Tenant Owner; it is not evidence of a separate tenant-admin runtime check.
- **Public links:** reset and invite pages without tokens show incomplete/invalid-link states. Successful token-based recovery and invitation flows remain untested.

Representative images: [setup](screenshots/orgadmin-organisation-setup-mobile.png), [permit creation](screenshots/issuer-permits-new.png), [approval](screenshots/hod-approvals-00000000-0000-4000-8000-000000000203-mobile.png), [closure](screenshots/issuer-closure-00000000-0000-4000-8000-000000000209-mobile.png).

## Source-only web coverage

No browser visit was recorded for `/incidents/archive`, `/incidents/new`, `/lototo/active`, `/lototo/plans/new`, `/lototo/restoration/[executionId]`, `/lototo/restoration`, `/notifications/[id]`, `/organisation/templates/[id]`, `/permits/[id]/execute`, `/safety`, `/simops/conflicts`, `/simops/history/[id]`, `/simops/history`, or `/unauthorized`. Their disposition is based on source and shared components. Redirect compatibility and dynamic states require implementation-stage verification.

## Limits and implementation verification

- Docker containers were restarted from existing images, without rebuilding, seeding, migrating or resetting data. Exact image/source revision parity has not been established. Rebuild changed services for final branch validation.
- Native mobile has no emulator/device evidence yet. `adb` is available, but no emulator is on PATH, SDK variables are unset, and standard local SDK/AVD directories are absent. Connected devices and nonstandard SDK locations remain unverified. Responsive browser screenshots are not native verification.
- One reduced-motion browser configuration was inspected. The full 32-combination theme/mode/density/style matrix remains an implementation acceptance check.
- Keyboard traversal, screen-reader behavior, 200% zoom, network failures, offline replay, concurrent edits and full end-to-end transitions remain to be tested. Source findings guide these checks; page loading does not substitute for them.
- Control collection was scoped to `main`; counts omit controls outside that element. Do not use those counts as an application-wide usability metric.
- No task timing comparison was performed. Claims about fewer clicks or faster entry require fixed before/after scenarios.

## Baseline checks

- `npm run lint -w web`: passed.
- Four targeted API Jest suites (`permit-validation`, `permit-collaboration`, `permit-forms`, `organisation-setup-progress`): 16 tests passed.
- `npm run lint -w mobile`: failed with four existing TS2339 errors in `mobile/src/components/permit/permit-wizard.tsx` at lines 143, 144, 145 and 163. The role-filtered payload union does not guarantee issuer-only fields. Recorded as an S0 prerequisite.
- Docker services: API, frontend, Keycloak, Loki, Mailpit, MinIO, PostgreSQL and Redis running; configured health checks healthy. Optional Metabase remains stopped under the existing analytics profile. API readiness and web HTTP response were verified after startup.

This is baseline evidence for plan review, not acceptance of the proposed implementation.

## Review revision 2 baseline replay

See [journey baselines](journey-baselines.md) and its trace for the three controlled UI replays. All ten business writes were intercepted and simulated; these are action counts, not additional successful lifecycle tests. Physical-phone acceptance supersedes the earlier emulator option. The static planning sketches are validated separately from application screens.
