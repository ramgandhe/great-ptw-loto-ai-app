# MS-09 Canon Coverage Traceability Matrix (PUS-249)

Maps canonical PRD requirements to implementation, Linear tickets, automated tests, and release evidence.

**Naming aliases resolved:** `FR-NOT-*` = canonical notifications (not legacy `FR-NTF-*`). `FR-DAS-*` = canonical dashboards/analytics (not legacy `FR-DSH-*`).

| Requirement | Sprint / Ticket | Primary code | Tests |
|---|---|---|---|
| FR-ROL-001 | PUS-243 / SP-09.01 | `approval.service.ts`, `closure.service.ts` (distinct HOD stages) | `approval.service.spec.ts`, `closure-roles.spec.ts` |
| FR-ROL-002 | PUS-243 | `approval.service.ts` (`safetyVeto`) | `approval-workflow.spec.ts` |
| FR-ROL-003 | PUS-243, BUG-09 | `roles.guard.ts`, `approval.constants.ts`, `closure.constants.ts` | `roles-guard.spec.ts`, `approval-roles.spec.ts`, `closure-roles.spec.ts` |
| FR-ROL-004 | PUS-243 | `execution` evidence / co-sign services | `execution-validation.spec.ts` |
| FR-PTW-013–030 | PUS-243 | `workflow-engine.service.ts`, `approval.service.ts`, migrations `0023–0024` | `approval-workflow.spec.ts`, `approval-schema.spec.ts` |
| FR-SIM-011–021 | PUS-246 / SP-09.02 | `simops.service.ts`, `conflict-detection.service.ts`, `conflict-resolution.service.ts` | `simops-*.spec.ts` (Ravi PR #295 in progress) |
| FR-MDP-009 | PUS-242 / SP-09.03 | `permit-validity.service.ts`, `revalidation-jobs.service.ts`, `permit.service.ts` (`renewFromExpired`) | `permit-validity.spec.ts`, `mdp-day-transition.spec.ts` |
| FR-INC-011 | PUS-244 / SP-09.04 | `incident-severity-lifecycle.service.ts`, migration `0022` | `incident-severity-lifecycle.spec.ts`, `ms06-lifecycle-http.integration.spec.ts` |
| FR-NOT-002 | PUS-245 / SP-09.05 | `canonical-notification.service.ts` ← approval approved | `canonical-notifications.spec.ts` |
| FR-NOT-003 | PUS-245 | `canonical-notification.service.ts` ← rejected / safety veto | `canonical-notifications.spec.ts` |
| FR-NOT-004 | PUS-245 | `canonical-notification.service.ts` ← deferred | `canonical-notifications.spec.ts` |
| FR-NOT-005 | PUS-245 | `canonical-notification.service.ts` ← validity expiry / renewal due | `canonical-notifications.spec.ts`, `mdp-day-transition.spec.ts` |
| FR-NOT-006 | PUS-245 | `canonical-notification.service.ts` ← incident submit | `canonical-notifications.spec.ts` |
| FR-NOT-007 | PUS-245 | `canonical-notification.service.ts` ← SIMOPS conflict detect | `canonical-notifications.spec.ts` |
| FR-NOT-008 | PUS-245 | `canonical-notification.service.ts` ← LOTOTO jobs | `canonical-notifications.spec.ts`, `lototo-jobs.spec.ts` |
| FR-DAS-002–008 | PUS-247 / SP-09.06 | `dashboards/`, `reporting.service.ts` | `dashboards-canon.spec.ts`, `dashboards-*.spec.ts`, `ms07-lifecycle-http.integration.spec.ts` |
| FR-BIL-002–005 | PUS-248 / SP-09.07 | `billing/` module, `billing-jobs.service.ts` | `billing-canon.spec.ts`, `billing-*.spec.ts` |

## Release verification checklist

- [x] Server-side RBAC fail-closed (`roles.guard.ts`)
- [x] Approval parallel/quorum, delegation, SLA, safety veto
- [x] MDP day-transition validity + renewal copy flow
- [x] Incident near-miss vs accident paths
- [x] Canonical notifications persisted via `notifications` table
- [ ] SIMOPS advanced detection (FR-SIM-011–021) — tracked in PUS-246 / PR #295
- [ ] Dashboard canon reconciliation (FR-DAS-002–008) — PUS-247
- [ ] Billing canon reconciliation (FR-BIL-002–005) — PUS-248
- [ ] Automated traceability gate (`ms-09-traceability.spec.ts`) — PUS-249
