# Entry Baselines and Numeric Targets

Baseline replay completed 2026-10-01 against the existing Docker UI. Sources remain `dev_ram` / `ed8c3cc`; Docker image/source identity is not certified. These are fixed scenarios, not estimates of all possible permits or an analytics-based claim about frequency.

## Counting contract

- **Typed fields:** distinct text/number fields the scenario requires the actor to populate. Search text counts if needed. Generated codes, selected options and unchanged defaults do not count.
- **Normalized clicks:** button/link activation = 1; opening a native selector and choosing an option = 2. The replay uses Playwright `selectOption` and records its two-click equivalent. Text focus, typing, scrolling and sign-in are excluded. These are reproducible control-action counts, not recorded mouse-event totals or elapsed task time.
- **Screens:** main-content views encountered, including wizard steps and starting list/hub. Inline forms/disclosures do not add a screen; a new route or replacement wizard view does. This definition applies to both before and after.
- Use desktop 1440×1000, loaded seed catalogues, first-time actor state, no errors, optional descriptions/phone/attachments omitted, and visible choices requiring no search. Repeat after implementation with the same scenario. Mobile receives a separate usability check; these are not mobile click counts.

**Replay isolation:** all business write requests were intercepted and fulfilled in browser memory. New hierarchy records were appended only to intercepted list responses. No real permits, people, accounts, invitations or notifications were created. Save success here is a simulated UI receipt, not proof of backend persistence. Baseline loading/authentication used the real application. The completed [replay trace](journey-baseline-replay.json) has all actions, 10 intercepted writes and no final-run errors.

## Reproducing the baseline

The [replay script](replay-baselines.cjs) takes `PTW_UX_ISSUER_EMAIL`, `PTW_UX_ISSUER_PASSWORD`, `PTW_UX_ORGADMIN_EMAIL` and `PTW_UX_ORGADMIN_PASSWORD` from the environment; use documented local demo accounts. Set `PTW_UX_PLAYWRIGHT_MODULE` to an existing Playwright module path if it is not resolvable normally. With Docker running, execute `node .planning/2026-09-30-ui-ux-simplification/replay-baselines.cjs`. It uses one headless browser sequentially and intercepts business writes after sign-in. Do not run it against production.

## Required targets

| Journey | Typed fields now → target | Clicks now → target | Screens now → target | Milestone |
|---|---:|---:|---:|---|
| P1: issuer creates and assigns a fresh routine permit | 2 → **1** | 13 → **≤10** | 3 → **2** | 1: S0a→S2 |
| P2: executor prepares site, crew and required forms | 1 → **1** | 31 → **≤21** | 5 → **2** | 1: S0a→S2 |

**Measured after S2 (2026-10-01, two identical runs, [script](replay-s2-after.cjs), [trace](s2-after-replay.json)):** P1 **1 typed, 10 clicks, 2 views**; P2 **1 typed, 19 clicks, 2 views** (All yes counted with its confirmation). Both meet their targets. P1 now saves for real in the replay and stores the plant derived from the location.
| H1: add plant, department, location and workstation through setup | 4 → **4** | 18 → **≤9** | 5 → **2** | 2: S3 |
| E1: add a genuinely new employee and department from Directory | 2 → **2** | 6 → **≤4** | 3 → **1** | 2: S3 |

**Measured after S3 (2026-10-01, two identical runs, [script](replay-s3-after.cjs), [trace](s3-after-replay.json)):** H1 **4 typed, 9 clicks, 2 views** with the department, location and workstation stored under the plant, department and location just added; E1 **2 typed, 4 clicks, 1 view**. Both meet their targets. Correction: the hierarchy is plant → department → location → workstation (FC-ORG-004, FR-ORG-005), not departments and locations as siblings; the location form asked for a plant the API never stored, and now asks for the department.

Names and a new person's identity cannot be derived reliably. The unchanged typing targets for H1/E1 are intentional. Success there means zero repeated parent choices and fewer intervening pages, not inventing data. A user starting directly on the existing Employees page already has a four-click path; the E1 improvement removes the Directory detour, not its necessary form controls.

## P1 — issuer preparation

Start `/permits`. Choose General Work, enter title/scope, select a compatible plant/department/location and one primary executor, use Tomorrow 08:00–16:00, then save the assigned draft. Finish at issuer handoff; executor site preparation, checks, signatures and final submit are separate responsibilities, never removed from this benchmark to claim a complete permit is ready.

| Current action | Clicks |
|---|---:|
| New permit | 1 |
| Permit type | 1 |
| Type title and scope | 0 (2 typed fields) |
| Next to Location & schedule | 1 |
| Plant, department, location, primary executor | 8 |
| Schedule preset | 1 |
| Save draft | 1 |
| **Total** | **13** |

Target: New permit 1 + type 1 + location path 2 + department 2 + executor 2 + schedule 1 + save 1 = **10**. Scope is the one typed field; title is visibly suggested from its first sentence and can be edited. Location supplies its actual plant relationship. Work and location/schedule render in the same editor rather than separate views. Multiple departments remain explicit; no savings assume an unverified sole choice.

Custom title adds one typed field; custom dates and search add interactions and must be reported when exercised. A previous-permit copy is a separate scenario, not the fresh-permit baseline.

## P2 — executor preparation

P1 needs only two typed fields, so it does not measure the reported data-entry burden. That sits in the executor-owned steps (`PERMIT_WIZARD_STEPS` 2–4: On-site details, Crew assignment, Forms & check sheets). P2 measures them.

**Scenario (as replayed):** `operator@ptw.local` (David) opens the P1 handoff draft from **Needs you → Add your on-site details**. The seed is real local data created through the API as the issuer: General Work, Demo Plant / Maintenance / Compressor Bay, tomorrow 08:00–16:00, David as primary executor, saved at step 2. On-site details: workstation, machinery, two hazards, three PPE items (quantity default 1, no descriptions); LOTOTO and gas testing not required for General Work and left off. Crew: add two existing crew members. Forms: the only applicable template is **Safe work permit**; the executor types the contractor firm, signs as contractor supervisor with **Me, now**, picks one type of work and answers the two precaution checks with **All yes**. Save draft. Executor writes are intercepted; the seed draft is deleted after the run.

**Baseline (recorded 2026-10-01, two identical runs, [trace](p2-baseline-replay.json), [script](replay-p2-baseline.cjs)): 1 typed field, 31 normalized clicks, 5 views.**

| Step | Clicks |
|---|---:|
| Open draft from Needs you | 1 |
| Lands on the issuer's read-only Location & schedule step; click **3. On-site details** | 1 |
| Workstation, machinery | 4 |
| Two hazards (select, Add, select) | 5 |
| Three PPE (select, then Add + select twice) | 8 |
| Next (saves) | 1 |
| Two crew members (Add + select, twice) | 6 |
| Next (saves) | 1 |
| Contractor firm (typed), supervisor **Me, now**, type of work, **All yes** | 3 |
| Save draft | 1 |
| **Total** | **31** |

Views: Dashboard, Location & schedule (read-only for the executor), On-site details, Crew assignment, Forms & check sheets.

Form prefill already works: 7 of the 13 required Safe work permit fields arrive filled (department, persons covered, number of persons, valid from/to, location, job description), including the crew added on the previous step. Individually answering the two checks would cost 2 clicks instead of 1.

**Target (S2): 1 typed field, ≤ 21 normalized clicks (≥ 30% fewer), 2 views** (Dashboard + one editor that opens on the executor's own section). The All yes path is counted with its confirmation (2 activations), so the target absorbs one extra click. Expected sources of the saving: opening on the executor's section (−1), no Next between sections (−2), and choosing catalogue items and crew without a separate Add per row (about −8 for five catalogue items and two crew members). Measured, not assumed, after S2.

**Findings from the replay (for S2, not fixed in S0a):**
- The Safe work permit template marks four later-stage signatures as required: *Job issued by*, *HOD of job issuer*, *Job authorised by*, *Job completion accepted by*. Submit checks every required field, so as configured someone must enter a completion acceptance before the permit is even approved. Decision 2026-10-01: optional *required at stage* on template fields (submit, approval, closure; absent = submit). Implemented: submit checks only submit-stage fields; the reference Safe work permit marks HOD and authoriser at approval and completion at closure (the issuer still signs before submit). Existing company copies updated by migration 0052 (also the hot work sheet's fire watch three hours after completion, which had blocked every hot work submit). Enforcement at approval and closure is scheduled in S4.
- Location prefill reads "Compressor Bay, Compressor Bay" when the location and workstation share a name.
- The executor lands on the issuer's read-only step because the stored step is the issuer's last one.
- Suspected, not proven: `update()` invalidates the permit list cache inside the transaction, before commit, so a list read in that window can re-cache stale data until the TTL. The replay first missed its draft on the dashboard when the executor signed in between the seed's create and assignment; signing in after the seed fixed it.

## H1 — four-record site hierarchy

Start setup on Profile. Open Plants, then create one plant; create its department and location; create a workstation in that location. Accept the existing generated codes. Department and location are sibling children of plant.

Current: Plants step 1 + four Add openings 4 + four saves 4 + three parent selectors 6 + three Next transitions 3 = **18**. Five main views: Profile, Plants, Departments, Locations, Workstations. Four names typed; codes already generated.

Target: Sites area 1 + four Add openings 4 + four saves 4 = **9**. The overview and Sites work area are two views; child forms stay in that work area. The newly saved/selected plant supplies two parent values and location supplies the workstation's parent. The four entered names remain necessary.

## E1 — new employee

Start `/workforce/directory`. Add an employee with a new name/email and one department; omit phone. The existing backend creates or reuses the Keycloak login. Do not add a second manual account-creation journey to exaggerate the baseline.

Current: Back to Workforce 1 + Employees 1 + Add 1 + department selector 2 + save 1 = **6**, across Directory, Workforce hub and Employees. Two typed fields.

Target: inline Add employee 1 + department selector 2 + save 1 = **4**, within the employee view of the People directory. The default record type follows the selected employee view; switching to contractor adds one explicit action. With an explicit department filter already applied, both saved context and its effect are shown; that shortcut is not included in the four-click target.

## Safety efficiency is measured separately

For a displayed section with ten unanswered checks and no signatures: current All yes takes 1 activation; proposed open confirmation + explicit declaration takes **2**, versus ten individual answers. The extra confirmation is a deliberate tradeoff, not a claimed speed gain. A section containing No/N/A keeps those answers. Signature/readings/actions and applicable mandatory questions remain unchanged.

## Acceptance evidence after implementation

Re-run P1/P2/H1/E1 with the same counting contract and publish before/after traces. Then run real persistence and role-transition tests against disposable local fixtures. Report both results separately. Require zero lost fields after validation/network/conflict errors. Do not claim faster task completion without timing people performing comparable tasks.
