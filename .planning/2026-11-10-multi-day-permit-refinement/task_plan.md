# Multi-day permit refinement — task plan

See [mdp-refinement.md](./mdp-refinement.md) for locked product rules.

## Progress

| Slice | Status |
|---|---|
| A Foundations | complete |
| B Secure + late secure | complete |
| C Reopen gate | complete |
| D Override | complete |
| E Dual handover | complete |
| F Badges / UX | complete |
| G Composition | complete |
| H Time flows | complete |
| I Jobs / evidence | complete |
| J Ops polish | complete |

## Slice A checklist

- [x] A1 MDP refinement note
- [x] A2 Domain types
- [x] A3 `isMultiDay` + unit tests
- [x] A4 Tenant settings (max validity, cutoff 16:30)
- [x] A5 Migration: policy columns
- [x] A6 Migration: secure / handover / overtime / override
- [x] A7 Backfill policy defaults
- [x] A8 Permit detail exposes multi-day + policy
- [x] A9 Create/update classification rules
- [x] A10 Approval policy capture
- [x] A11 Admin settings API/UI
- [x] A12 Audit events + API/RBAC draft
- [x] A13 Tests for A3–A10

## Slice B checklist

- [x] B1 Secure service create/get (one per permit + operationalDate)
- [x] B2 Gate: progress submitted before secure
- [x] B3 Checklist defaults (personnel clear; light vs full)
- [x] B4 Countersign when daily audit ON or LOTOTO remains
- [x] B5 Late secure + reason
- [x] B6 Block reopen/clear while late secure outstanding
- [x] B7 Final day secure → closure path
- [x] B8 Web secure + late secure UI
- [x] B9 Mobile secure + late secure UI
- [x] B10 Tests

## Slice C checklist

- [x] C1 Today-bound reopen (timezone + cutoff-aware operational date)
- [x] C2 Pass reopen → cleared for work (no separate continue)
- [x] C3 Deprecate Continue as required step (compat shim OK)
- [x] C4 Daily audit OFF: skip mandatory reopen; secure still required
- [x] C5 Fail reopen → suspend + failed_reopen
- [x] C6 Execution gate when not cleared today
- [x] C7 Unify suspend/resume sources
- [x] C8 Day-transition job: clear does not survive next day
- [x] C9 Incident/cancel guards on reopen
- [x] C10 SIMOPS suspension cannot clear via reopen
- [x] C11 Web + mobile reopen → clear UI
- [x] C12 Tests

## Slice D checklist

- [x] D1 Override API (today only, reason, audit)
- [x] D2 Reject if override disabled
- [x] D3 Notify issuer/HOD/safety
- [x] D4 Badge override-used today (day-cycle)
- [x] D5 Tests

## Slice E checklist

- [x] E1 Submit → pending_acceptance; notify incoming
- [x] E2 Accept/reject; custody until accept
- [x] E3 Web + mobile UI
- [x] E4 Legacy one-way → accepted
- [x] E5 Tests

## Slice F checklist

- [x] F1 Day-cycle on permit detail + execution list + mobile
- [x] F2 Classic status + day-cycle badge
- [x] F3 Multi-day page order (Late secure → Secure → Reopen → Progress/Handover → Time)
- [x] F4 Deep links from badge to required action
- [x] F5 Policy + Day N of max + cutoff on permit

## Slice G checklist

- [x] G1 Site security when daily audit ON
- [x] G2 Gas when required — today’s readings; block clear if stale/missing
- [x] G3 LOTOTO integrity when isolations active
- [x] G4 SIMOPS unresolved blocking cases block clear
- [x] G5 Reopen wizard with module links
- [x] G6 Tests

## Slice H checklist

- [x] H1 Same-day overtime (today’s operational date only)
- [x] H2 Approver routing (HOD default / area / shift setting)
- [x] H3 Duration extension updates plannedEndAt
- [x] H4 Extension approve re-runs SIMOPS
- [x] H5 Block extension past tenant max → renew
- [x] H6 Renewal reasons: expired / max_validity / material_change
- [x] H7 Approver inbox (no paste-ID)
- [x] H8 Journey unit tests (overtime bounds + max→renewal)

## Slice I checklist

- [x] I1 Enforce max validity + keep 48h FR-MDP-009 warnings
- [x] I2 Actionable notifications: secure due, reopen due, late secure (handover/overtime/override already wired)
- [x] I3 MinIO evidence on daily progress (FR-MDP-007)
- [x] I4 Evidence on secure/reopen
- [x] I5 Idempotent jobs / dedupe (history + BullMQ jobId + notification dedupeKey)

## Slice J checklist

- [x] J1 Morning queues (API + web `/mdp/morning-queue`)
- [x] J2 Tenant checklist library + seeds (`GET /mdp/checklist-library`)
- [x] J3 Permit-type `forceDailyRevalidation` lock
- [x] J4 Mobile day-cycle → job wizard (late secure → reopen/clear)
- [x] J5 Offline queue hardening (reopen / handover accept-reject + conflict rules)
- [x] J6 Analytics KPIs (`GET /mdp/analytics/kpis`)
- [x] J7 Docs / API reference alignment
- [ ] J8 OpenQodex before push (run when pushing)

## Next

MDP refinement slices **A–J** complete. Run migrations `0108`–`0109` when DB is up. Before push: OpenQodex review.
