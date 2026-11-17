# MDP API & RBAC draft (Slice A12)

Contract for Slices B–H. Existing MS-05 routes stay; new routes are added below.

Role constants live in:

- `app/src/modules/daily-progress/daily-progress.constants.ts`
- `app/src/modules/revalidation/revalidation.constants.ts`
- Audit action names: `app/src/modules/revalidation/mdp-audit-events.ts`

## Existing routes (keep)

| Method | Path | Roles |
| --- | --- | --- |
| POST/GET | `/permits/{id}/daily-progress` | MDP_WRITE / MDP_READ |
| POST/GET | `/permits/{id}/handover` | MDP_HANDOVER / MDP_READ |
| GET | `/permits/{id}/daily-history` | MDP_READ |
| POST | `/permits/{id}/revalidate` | REVALIDATION_WRITE |
| POST | `/permits/{id}/continue` | REVALIDATION_WRITE (legacy; Slice C → clear) |
| POST | `/permits/{id}/suspend` | REVALIDATION_WRITE |
| POST | `/permits/{id}/extensions` | EXTENSION_REQUEST |
| GET | `/permits/{id}/revalidation-history` | REVALIDATION_READ |
| POST | `/extensions/{id}/approve\|reject` | EXTENSION_APPROVE |
| PATCH | `/organisations/{id}` | tenant admin (incl. MDP settings A11) |

## New / refined routes

| Method | Path | Roles | Slice | Notes |
| --- | --- | --- | --- | --- |
| POST | `/permits/{id}/day-secures` | DAY_SECURE_WRITE | B | Progress submitted first (B2); light/full checklist (B3); dual countersign (B4) |
| GET | `/permits/{id}/day-secures` | MDP_READ | B | |
| GET | `/permits/{id}/day-secures/checklist-template` | MDP_READ | B | Light vs full from daily-audit policy |
| GET | `/permits/{id}/day-cycle` | MDP_READ | B | Late secure / final day snapshot |
| POST | `/permits/{id}/day-secures/{secureId}/countersign` | DAY_SECURE_COUNTERSIGN | B | Required when daily audit ON or open LOTOTO; not self |
| POST | `/permits/{id}/handovers/{handoverId}/accept` | HANDOVER_ACCEPT (+ incoming user) | E | Dual acceptance |
| POST | `/permits/{id}/handovers/{handoverId}/reject` | HANDOVER_ACCEPT (+ incoming user) | E | |
| POST | `/permits/{id}/reopen` | REVALIDATION_WRITE (+ composed checks) | C/G | Today-bound; pass → cleared; G blocks until composition current |
| GET | `/permits/{id}/reopen-composition` | REVALIDATION_READ | G | Site security / gas / LOTOTO / SIMOPS template + links |
| POST | `/permits/{id}/revalidate` | REVALIDATION_WRITE | C | Legacy alias; today-bound like reopen |
| POST | `/permits/{id}/mdp-override` | MDP_OVERRIDE | D | Day-scoped; flag must allow |
| POST | `/permits/{id}/overtime` | OVERTIME_REQUEST | H | Same operational day only |
| GET | `/permits/{id}/overtime` | MDP_READ | H | |
| POST | `/overtime/{id}/approve` | OVERTIME_APPROVE (or tenant overtimeApproverRole) | H | |
| POST | `/overtime/{id}/reject` | OVERTIME_APPROVE (or tenant overtimeApproverRole) | H | |
| GET | `/permits/{id}/day-cycle` | MDP_READ | F | Optional explicit day-cycle endpoint; may stay on permit detail `multiDay` |

## Permit detail (done A8)

`GET /permits/{id}` includes `multiDay` summary + policy columns on `permit`.

## Approval (done A10)

`POST /approvals/{id}/approve` accepts optional:

- `dailyRevalidationRequired` (default true)
- `emergencyOverrideAllowed` (default true)

Applied only on **final** approval when `multiDay.isMultiDay`.

## Org settings (done A11)

`PATCH /organisations/{id}`:

- `maxMultiDayValidityDays`
- `operationalDayCutoff`
- `overtimeApproverRole`

## Audit actions

See `MDP_AUDIT_ACTIONS` in `mdp-audit-events.ts`. Every state change in B–H must log one of those actions (or an explicitly added sibling).
