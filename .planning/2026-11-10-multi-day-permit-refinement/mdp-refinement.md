# Multi-day permit refinement — locked rules

Internal product/engineering note for MS-05 refinement. Implements industrial daily reopen / overnight secure practice on top of existing MDP modules (`daily-progress`, `revalidation`).

## Product principle

Multi-day = automatic from duration; overnight always secured; morning reopen hard by default and policy-tunable; more time split into overtime / extension / renewal; board always shows lifecycle status + today’s clearance.

## Locked decisions

| # | Topic | Rule |
|---|---|---|
| 1 | Classification | Automatic from `plannedStartAt` / `plannedEndAt` vs tenant **operational day cut-off** (default **16:30**, org/site timezone). No manual “un-tick multi-day” while dates still span multiple operational days. |
| 2 | Daily audit / reopen | Default **ON** at approval (`dailyRevalidationRequired = true`). Approver/HOD may turn OFF → single validation for the validity window. |
| 3 | Emergency override | Default **ON**. Approver may disable → fully hard gate. Override is **day-scoped**, reason-coded, audited — not a permanent bypass. |
| 4 | End-of-day secure | **Required** for every multi-day permit (even when daily audit OFF). |
| 5 | Progress before secure | Daily progress for that operational day must be **submitted** before secure can complete. |
| 6 | Personnel clear | No separate worker check-out module in v1. Secure checklist includes required **personnel clear / accounted for**. |
| 7 | Secure countersign | Executor always. Area/issuer dual when **daily audit ON** **or** **LOTOTO isolations remain** overnight. Else executor-only. |
| 8 | Late secure | If prior operational day not secured → block clear-for-work; allow late secure with mandatory reason; then today’s reopen (if daily audit ON). |
| 9 | Reopen = clear | Successful today-bound reopen with required signatures = **cleared for work**. No separate Continue step. |
| 10 | Hard gate | When daily audit ON: block work/resume until cleared for **today** (timezone + cut-off aware). |
| 11 | Reopen composition | When daily audit ON: always site security; compose gas / LOTOTO integrity / SIMOPS when the permit’s hazards/modules require them → block clear until current. |
| 12 | Handover | Dual acceptance: outgoing submits → incoming accepts. |
| 13 | More time | Three flows: same-day overtime · duration extension · renewal. |
| 14 | Time-flow approvers | Default HOD/permit approver for all three. Overtime may be routed to area/shift in-charge via tenant setting. |
| 15 | Max validity | Admin per tenant; product default **7 days**. Beyond max → renewal, not endless extension. |
| 16 | Board UX | Classic permit status + day-cycle badge. |
| 17 | SIMOPS suspension | Suspension from SIMOPS rejection cannot be cleared via normal MDP reopen alone. |
| 18 | Cut-off | Tenant setting `operationalDayCutoff`; default `16:30`. Drives operational-day boundaries, multi-day detection, and same-day overtime window. |

## PRD mapping

| PRD / legacy wording | Refined behaviour |
|---|---|
| Daily progress report → issuer approves day → next day | Progress submitted + end-of-day secure (executor; area/issuer countersign when required) = day accepted |
| Workers check out | Personnel-clear item on secure checklist (v1); dedicated check-out deferred |
| Daily revalidation + continue | Single reopen action → cleared for work |
| Extension | Split: same-day overtime vs duration extension vs renewal |
| FR-MDP-009 validity / renewal | Keep 48h warning + expiry; add tenant max-validity → renewal |

## Day-cycle states

| State | Meaning |
|---|---|
| `secure_due` | Current/prior work day needs end-of-day secure |
| `late_secure_required` | Prior operational day was not secured; must late-secure before clear |
| `reopen_due` | Daily audit ON; today’s reopen not yet passed |
| `cleared` | Cleared for work **today** (does not survive into next operational day) |
| `failed_reopen` | Today’s reopen failed; permit suspended |
| `override_used` | Emergency override used for today |
| `not_multi_day` | Permit is not under multi-day regime |
| `closed_path` | Final day / closing — no next-day reopen expected |

Derived badges may also surface: validity ending, overtime pending, extension pending.

## Target daily cycle

```text
Work day
  → Daily progress submitted
  → End-of-day secure (personnel clear; dual sign when required)
  → Next operational day (after cut-off / calendar rules)
       → If prior secure missing: late secure (reason) first
       → If daily audit ON: reopen (composed checks) → cleared for work
       → If daily audit OFF: no mandatory reopen; module rules (e.g. gas before CSE) still apply
  → Work only when allowed
  → … until close / expiry / renewal
```

## Same-day overtime vs multi-day

- Same operational day, even past cut-off → still **single-day** for classification; work past cut-off needs **overtime** approval.
- Spans two or more operational days → **multi-day**; overnight secure applies.

Example (cut-off 16:30): start Mon 08:00, end Mon 20:00 → single-day + overtime. Start Mon 08:00, end Tue 17:00 → multi-day.

## Implementation slices

| Slice | Scope |
|---|---|
| A | Foundations: note, types, settings, migrations, classification, approval policy |
| B | End-of-day secure + late secure + progress-first |
| C | Today-bound reopen = clear + execution hard gate + suspend unification |
| D | Emergency override |
| E | Dual handover |
| F | Badges + multi-day workspace UX |
| G | Gas / LOTOTO / SIMOPS on reopen |
| H | Overtime / extension / renewal |
| I | Jobs, notifications, evidence |
| J | Ops polish (queues, checklist library, analytics, docs) — complete |

Order: **A → B → C → D → E → F → G → H → I → J**.

## Out of scope for early slices

- Separate worker check-out module
- Per-permit-type max validity (later)
- Rewriting non-MDP permit lifecycle
- Checklist admin library (Slice J)

## Existing modules to extend (not replace)

- `app/src/modules/daily-progress`
- `app/src/modules/revalidation`
- Permit renewal in `permit.service`
- Frontend/mobile `multi-day` UI
- Execution suspend/resume (unify with MDP in Slice C)

## Schema migrations (Slice A)

| Migration | Purpose |
|---|---|
| `0102_mdp_tenant_settings` | Org max validity, cut-off 16:30, overtime approver role |
| `0103_mdp_permit_policy` | Permit `daily_revalidation_required`, `emergency_override_allowed` |
| `0104_mdp_secure_handover_overtime_override` | Day secure, handover acceptance, overtime, overrides |
| `0105_mdp_policy_backfill` | One-time force policy defaults ON/ON for existing permits |

## API / RBAC / audit (Slice A12)

- Draft route matrix: [api-rbac-draft.md](./api-rbac-draft.md)
- Audit actions: `app/src/modules/revalidation/mdp-audit-events.ts`
- Role constants extended in `revalidation.constants.ts` and `daily-progress.constants.ts`
