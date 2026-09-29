# Progress Log

## Session: 2026-09-29

### Current Status
- **Phase:** 1 - Requirements & Discovery
- **Started:** 2026-09-29

### Actions Taken
-

### Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|

### Errors
| Error | Resolution |
|-------|------------|

## 2026-09-29 session
Fixed so far (uncommitted):
- Storage: MINIO_PUBLIC_URL signer + Caddy /ptw-documents/* → evidence view/download/LOTO upload/avatar (D3-02, D3-10, D3-11, OI-08, OI-11, OI-47, OI-67; OI-17/54 view)
- lib/api.ts: FormData support + non-JSON guard; 4 upload helpers via fetchApi (401 refresh) → D3-09
- newId without crypto.randomUUID → D3-03; copyText fallback + toast → D3-13, OI-39, OI-40
- Toaster (components/ui/toast.tsx) mounted in shell
- WorkforceCrudPage: name pattern, phone country code + digits, date inputs, columns (phone/expiry/select labels), Edit/Delete for certs+competencies, toasts, copy temp pw → OI-05/06/14/15/19/20/21/23/24/41/46/52/53/54/55/56
- API: common/validation.ts (NAME/PHONE/TEXT regex + self-check), DTOs workforce/org-entity/tenant/investigation, migration 0047 competencies.start_date
- Permit wizard: history.replaceState instead of router.replace (D3-20 Next double click), PageHeader+back (D3-18), RemoveRowButton for viewers/safety officers/LOTOTO/gas/hazards/PPE/executors (OI-09, OI-61), viewer options = all active users (OI-60), LOTOTO hint links to /lototo?new=1&machineryId + refresh (D3-08), department required web+API (OI-31)
- Notifications: group key includes entity → each opens its own record (D3-07); permit submit/resubmit/stage_advanced → 'permit_submitted' to next approvers (HOD dept-scoped) (D3-12, OI-32, OI-64)
- Incidents: detail page rebuilt (PageHeader, chips, HOD decision panel → /hod-decision (OI-37), evidence open via new GET /incidents/:id/evidence/:eid/download-url (OI-08), FileUploadField), InvestigationWorkflow rebuilt (lists root causes/CA/PA, toasts, cancel CA (OI-36 by cancel), people = tenant users), closure role-gated + toasts, closed = archived note (OI-10)
- Org entities: ?archived=true list + Active/Archived toggle (OI-03, OI-42), toasts (OI-69/70), name pattern
- Checklists: archived were still listed → Active/Archived split + toast (OI-43)
- Permit types: colour from name family until picked (OI-44), toasts (OI-45, OI-68)
- LOTOTO: DELETE /lototo/plans/:id/isolation-points/:pointId (draft/ready only) + Delete button (OI-04)
- Billing: usage needs a subscription (API 409) + usage section hidden without one (OI-27/51); qty empty default + required (OI-25/49); one card per metric w/ earlier periods (OI-26/50); no-plans empty state (OI-28); toasts
- Sign-in: BackLink to home, localhost hint removed (OI-57/59)
- Profile: DELETE /auth/profile/avatar + Remove picture button (D3-10, OI-48); display via MinIO fix (OI-47)
- Platform admin: PERMIT_CREATE_ROLES (web) without platform-admin (OI-13); tenant form name pattern + toast (OI-58); OI-07 = Tenants page (by design)
- Role change → in-app 'role_changed' notification, migration 0048 (OI-18)
- Separation of duties: submitter cannot approve (API Forbidden + excluded from pending queue) + test (D3-06)
- Draft delete → /permits + toast; OI-66 not reproducible (edit only for editable statuses)
- OI-12 not reproducible (read only via Mark read); OI-62 needs clarification; D3-14 by design (on-screen reports, print, evidence open)
Tests: approval.service (10, incl. new), approval-workflow, tenant-users, mdp-day-transition, permit-validation → pass
- Verification: browser script 17/17 PASS (scratchpad/e2e/bugs.mjs), API script 7/7 PASS (api.mjs) after fixes to approver lookup (Keycloak) and tenant_id loss.
- Final: tsc clean (api+web); lint on changed files 12 errors = base 12 (none new); jest targeted 57 suites / 259 tests pass (full suite >20 min under 3 GB free RAM, not completed); UI 17/17; API 7/7.
- Deliverable: docs/qa/PTW_Bug_Status_2026-09-29.xlsx (Summary, Consolidated Bugs 90 rows, Deployment notes), recalc 0 errors.
- Not committed / not deployed (not asked yet).

## 2026-09-29 afternoon — new issues report (NI-01..10)
- NI-01 PKCE: message/code removed in 20de02d (own sign-in page, API relays to Keycloak). Tester on older build. Cookie policy still listed PKCE/Keycloak storage → updated (ptw_nav_trail added).
- NI-02: RCA — only explicit "Mark read"/"Mark as read" buttons marked read; opening via link or detail page did not. Fix: panel link onClick marks group read; detail page marks read on load; dead button removed.
- NI-03: RCA — web validateStep + API validateForSubmit only required workstation/machinery when gas/LOTOTO toggled. Fix: workstation always required (web+API); machinery required (web) when the chosen workstation has machines. Test updated (+workstation case). Note: ms02/ms06 http integration specs already lacked departmentId (pre-existing; skip without DB).
- NI-04: API closure roles = hod + tenant-owner/admin (admin override is systemwide: approve, veto, close). Fix = messaging: closure panel "Final sign-off … HOD, or org admin when HOD unavailable"; process map actor/owner updated. Ask user if HOD-only wanted.
- NI-05: HistoryTimeline had identical hollow dots. Fix: filled dot + icon per tone (EDGES tone: forward=success ✓, back=warning, stop=danger), latest ringed.
- NI-06: RCA — resubmit notified only next-stage approvers (dept HOD). Fix: on 'resubmitted' also org admins (tenant-admin/owner) + last deferrer/rejecter; title "Permit resubmitted". Test added (canonical-notifications). jest 15/15 pass.
- NI-07: API import works (dev: 201, 9 already present → toast "All reference templates are already here"). RCA of real failure: deleted (archived) reference template counted as present → never returns and code is unique per tenant. Fix: import restores archived references. DB test extended; passes.
- NI-08/09: RCA via local walk: (1) job issuer: On-site step owned by executor → checkboxes/selects disabled yet hints say "choose machinery/workstation first" (misleading) and Next greyed; (2) workstation with no gas tests (dev: only Tank Farm Manifold has one) → Add gas testing disabled, dead end; machine without plan similar (LOTOTO had link already). Org admin: LOTOTO works. Fix: explicit executor banner, hints only when editable, gas-testing link+refresh, tick prefills all workstation gas tests / single LOTOTO plan.
- NI-10: department on tenant_users only drives HOD scoping (permit-access, next-approver notifications). Fix: add-user form shows Department only for role HOD ("this HOD sees and approves its permits only"); list column "HOD department", "—" for non-HOD; departmentId only sent for HOD.
- Verify so far: tsc api+web clean; eslint changed files = base (6 pre-existing, none new). jest (15 + 4) pass; broader run timed out at 20 min (RAM) → narrower run in background.
- Verify: jest 20 suites / 92 tests pass (--maxWorkers=2). Local rebuild; browser checks (ni-verify.mjs, ni-verify2.mjs) all PASS: NI-01 cookies, NI-02 detail + list marks read, NI-03 workstation/machinery required, NI-05 markers, NI-08 add link + prefill, NI-09 LOTOTO, issuer banner, NI-10 HOD-only department. NI-04 wording not browser-checked (needs pending_closure permit).
- xlsx: rows 92–101 (NI-01..10) appended, ranges/filters/CF/DV extended, Summary B7 + note A35; recalc 0 errors; check = 0. Backup: scratchpad/bugs/PTW_Bug_Status_before_NI.xlsx.
- Not committed / not deployed.
- Deployed 92f8093; dev server read-only check ni-srv.mjs 6/6 PASS (NI-01 cookies + sign-in, NI-10 x2, NI-07, NI-05 on PTW-2026-000020).
