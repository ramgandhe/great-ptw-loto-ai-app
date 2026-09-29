# Task Plan: PTW deployment bug lists

## Goal
Triage both tester bug lists against current dev_ram, fix the ones that still exist (current UI standards: PageHeader/BackLink, StatusChip, toggles, reveal-in panels, toasts), test, and hand back one consolidated xlsx (source, ID, module, bug, relevance, still exists, action taken, test status, comments).

## Sources
- A: `~/Downloads/ptw issues 3rd deployment.pdf` — 20 bugs (IDs D3-01..D3-20). Text: scratchpad/bugs/pdf.txt
- B: `~/Downloads/PTW_First_vs_Second_Deployment_Analysis_With_Open_Issues (1) (1).xlsx` — column "Open Issues" = 70 open items (IDs OI-01..OI-70, in row order); PTW-001..071 baseline + "Closed Bugs" sheet are history only. Text: scratchpad/bugs/xlsx.txt
- dev_vinesh (0a4347e) is an ancestor of dev_ram (+7 commits) → bugs likely still present unless our commits touched them.

## Phases
### Phase 1: Load + dedupe bug lists
**Status:** complete
### Phase 2: Triage each bug against code (+ running app where needed)
**Status:** complete
### Phase 3: Fix relevant bugs (grouped by module), UI standards
**Status:** complete
### Phase 4: Verify (typecheck, lint changed files, API tests, Playwright checks)
**Status:** complete
### Phase 5: Consolidated tester xlsx
**Status:** complete

### Phase 6: New issues report (`~/Downloads/ptw new issue.pdf`, 10 items, IDs NI-01..NI-10) — triage + RCA
**Status:** complete
### Phase 7: Fix valid NI issues
**Status:** complete
### Phase 10: Commit 92f8093 + deploy to dev server
**Status:** complete
### Phase 8: Verify (tsc, targeted jest, browser/API checks)
**Status:** complete
### Phase 9: Append NI rows to docs/qa/PTW_Bug_Status_2026-09-29.xlsx + Summary counts
**Status:** complete

## Next Step
PARKED until 2026-09-30: NI-04 decision — keep org admin override for permit closure, or HOD-only (CLOSURE_CLOSE_ROLES in app/src/modules/closure/closure.constants.ts + canClose in closure/[permitId]/page.tsx + process.ts wording). Deployed 92f8093; server check ni-srv.mjs 6/6 PASS.

## Decisions Made
| Decision | Why |
|---|---|
| Consolidate PDF + xlsx Open Issues; baseline PTW rows not re-listed | Open Issues column is the tester's current list; PTW rows are history |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| system python lacks openpyxl | 1 | venv in scratchpad/venv |
| jest multi-suite run hit 20 min timeout (RAM) | 1 | --maxWorkers=2, narrower pattern: 20 suites/92 tests pass |
| sign-in throttle 5/min broke browser script | 1 | reuse browser session token |
| local notifications list cached in Redis after direct DB edit | 1 | deleted local notification:list keys |
