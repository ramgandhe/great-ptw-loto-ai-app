# MS-09 Canon Traceability Matrix

Single matrix for SP-09.08 / PUS-249: PRD → implementation-plan section → Linear → code → tests → release evidence.

**Rule:** `FR-NTF-*` and `FR-DSH-*` are plan aliases only. They do **not** prove `FR-NOT-*` / `FR-DAS-*` without an explicit row below.

Expected coverage: **53/53**.

Machine-readable SSOT: [`ms09-canon-matrix.json`](./ms09-canon-matrix.json).

## Alias resolution (NOT/NTF · DAS/DSH)

| Plan alias | Canon PRD IDs | Note |
|------------|---------------|------|
| FR-NTF-001 | FR-NOT-001 | Plan NTF infrastructure ≠ FR-NOT event coverage; FR-NOT is canonical. |
| FR-NTF-002 | FR-NOT-002, FR-NOT-003, FR-NOT-004, FR-NOT-005, FR-NOT-006, FR-NOT-007, FR-NOT-008 | NTF reminder/infra may support NOT events but does not prove them without explicit mapping. |
| FR-NTF-003 | FR-NOT-009 | Escalation infra alias; FR-NOT remains PRD source of truth. |
| FR-NTF-004 | FR-NOT-009 | Delivery/history infra alias. |
| FR-DSH-001 | FR-DAS-001, FR-DAS-002 | Dashboard kinds/RBAC; DAS is canonical for operational metrics. |
| FR-DSH-002 | FR-DAS-002 | Role dashboard surfaces; not sufficient alone for FR-DAS metric reconciliation. |
| FR-DSH-003 | FR-DAS-002 | Management dashboard kind alias. |
| FR-DSH-004 | FR-DAS-007 | Analytics snapshots support DAS organizational analytics (plan alias only; canon PRD IDs remain source of truth). |
| FR-DSH-005 | FR-DAS-003, FR-DAS-004, FR-DAS-005, FR-DAS-006, FR-DAS-008 | report_exports infrastructure; report-type/content still must map to DAS (plan alias only; canon PRD IDs remain source of truth). |
| FR-DSH-006 | FR-DAS-007 | KPI cache infra alias. |

## Requirement matrix

| PRD ID | Plan section | Sprint | Linear | Code | Tests | Release evidence |
|--------|--------------|--------|--------|------|-------|------------------|
| FR-ROL-001 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/common/decorators/auth.decorators.ts` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-ROL-002 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/common/decorators/auth.decorators.ts` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-ROL-003 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/common/decorators/auth.decorators.ts` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-ROL-004 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/common/decorators/auth.decorators.ts` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-013 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-014 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-015 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-016 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-017 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-018 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-019 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-020 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-021 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-022 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-023 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-024 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-025 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-026 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-027 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-028 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-029 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-PTW-030 | MS-09 / SP-09.01 | SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | `app/src/modules/approval`, `app/src/modules/permits`, `app/src/modules/execution` | `tests/approval.service.spec.ts`, `tests/permit-validation.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/294) |
| FR-SIM-011 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-SIM-012 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-SIM-013 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-SIM-014 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-SIM-015 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-SIM-016 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-SIM-017 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-SIM-018 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-SIM-019 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-SIM-020 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-SIM-021 | MS-09 / SP-09.02 | SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | `app/src/modules/simops` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/295) |
| FR-MDP-009 | MS-09 / SP-09.03 | SP-09.03 | [PUS-242](https://linear.app/pushtirastu/issue/PUS-242) | `app/src/modules/daily-progress`, `app/src/modules/revalidation`, `app/src/modules/multi-day` | `tests` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/296) |
| FR-INC-011 | MS-09 / SP-09.04 | SP-09.04 | [PUS-244](https://linear.app/pushtirastu/issue/PUS-244) | `app/src/modules/incidents` | `tests/incident-recording-service.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/297) |
| FR-NOT-002 | MS-09 / SP-09.05 | SP-09.05 | [PUS-245](https://linear.app/pushtirastu/issue/PUS-245) | `app/src/modules/notifications` | `tests/notifications-infra.spec.ts`, `tests/notifications-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/298) |
| FR-NOT-003 | MS-09 / SP-09.05 | SP-09.05 | [PUS-245](https://linear.app/pushtirastu/issue/PUS-245) | `app/src/modules/notifications` | `tests/notifications-infra.spec.ts`, `tests/notifications-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/298) |
| FR-NOT-004 | MS-09 / SP-09.05 | SP-09.05 | [PUS-245](https://linear.app/pushtirastu/issue/PUS-245) | `app/src/modules/notifications` | `tests/notifications-infra.spec.ts`, `tests/notifications-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/298) |
| FR-NOT-005 | MS-09 / SP-09.05 | SP-09.05 | [PUS-245](https://linear.app/pushtirastu/issue/PUS-245) | `app/src/modules/notifications` | `tests/notifications-infra.spec.ts`, `tests/notifications-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/298) |
| FR-NOT-006 | MS-09 / SP-09.05 | SP-09.05 | [PUS-245](https://linear.app/pushtirastu/issue/PUS-245) | `app/src/modules/notifications` | `tests/notifications-infra.spec.ts`, `tests/notifications-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/298) |
| FR-NOT-007 | MS-09 / SP-09.05 | SP-09.05 | [PUS-245](https://linear.app/pushtirastu/issue/PUS-245) | `app/src/modules/notifications` | `tests/notifications-infra.spec.ts`, `tests/notifications-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/298) |
| FR-NOT-008 | MS-09 / SP-09.05 | SP-09.05 | [PUS-245](https://linear.app/pushtirastu/issue/PUS-245) | `app/src/modules/notifications` | `tests/notifications-infra.spec.ts`, `tests/notifications-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/298) |
| FR-DAS-002 | MS-09 / SP-09.06 | SP-09.06 | [PUS-247](https://linear.app/pushtirastu/issue/PUS-247) | `app/src/modules/dashboards` | `tests/dashboards-infra.spec.ts`, `tests/dashboards-analytics-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/299) |
| FR-DAS-003 | MS-09 / SP-09.06 | SP-09.06 | [PUS-247](https://linear.app/pushtirastu/issue/PUS-247) | `app/src/modules/dashboards` | `tests/dashboards-infra.spec.ts`, `tests/dashboards-analytics-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/299) |
| FR-DAS-004 | MS-09 / SP-09.06 | SP-09.06 | [PUS-247](https://linear.app/pushtirastu/issue/PUS-247) | `app/src/modules/dashboards` | `tests/dashboards-infra.spec.ts`, `tests/dashboards-analytics-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/299) |
| FR-DAS-005 | MS-09 / SP-09.06 | SP-09.06 | [PUS-247](https://linear.app/pushtirastu/issue/PUS-247) | `app/src/modules/dashboards` | `tests/dashboards-infra.spec.ts`, `tests/dashboards-analytics-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/299) |
| FR-DAS-006 | MS-09 / SP-09.06 | SP-09.06 | [PUS-247](https://linear.app/pushtirastu/issue/PUS-247) | `app/src/modules/dashboards` | `tests/dashboards-infra.spec.ts`, `tests/dashboards-analytics-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/299) |
| FR-DAS-007 | MS-09 / SP-09.06 | SP-09.06 | [PUS-247](https://linear.app/pushtirastu/issue/PUS-247) | `app/src/modules/dashboards` | `tests/dashboards-infra.spec.ts`, `tests/dashboards-analytics-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/299) |
| FR-DAS-008 | MS-09 / SP-09.06 | SP-09.06 | [PUS-247](https://linear.app/pushtirastu/issue/PUS-247) | `app/src/modules/dashboards` | `tests/dashboards-infra.spec.ts`, `tests/dashboards-analytics-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/299) |
| FR-BIL-002 | MS-09 / SP-09.07 | SP-09.07 | [PUS-248](https://linear.app/pushtirastu/issue/PUS-248) | `app/src/modules/billing` | `tests/billing-infra.spec.ts`, `tests/billing-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/300) |
| FR-BIL-003 | MS-09 / SP-09.07 | SP-09.07 | [PUS-248](https://linear.app/pushtirastu/issue/PUS-248) | `app/src/modules/billing` | `tests/billing-infra.spec.ts`, `tests/billing-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/300) |
| FR-BIL-004 | MS-09 / SP-09.07 | SP-09.07 | [PUS-248](https://linear.app/pushtirastu/issue/PUS-248) | `app/src/modules/billing` | `tests/billing-infra.spec.ts`, `tests/billing-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/300) |
| FR-BIL-005 | MS-09 / SP-09.07 | SP-09.07 | [PUS-248](https://linear.app/pushtirastu/issue/PUS-248) | `app/src/modules/billing` | `tests/billing-infra.spec.ts`, `tests/billing-schema.spec.ts` | [PR](https://github.com/riddhi2106/great-ptw-loto-ai-app/pull/300) |

## Sprint ownership

| Sprint | Linear | Scope |
|--------|--------|-------|
| SP-09.01 | [PUS-243](https://linear.app/pushtirastu/issue/PUS-243) | FR-ROL family in this matrix |
| SP-09.02 | [PUS-246](https://linear.app/pushtirastu/issue/PUS-246) | FR-SIM family in this matrix |
| SP-09.03 | [PUS-242](https://linear.app/pushtirastu/issue/PUS-242) | FR-MDP family in this matrix |
| SP-09.04 | [PUS-244](https://linear.app/pushtirastu/issue/PUS-244) | FR-INC family in this matrix |
| SP-09.05 | [PUS-245](https://linear.app/pushtirastu/issue/PUS-245) | FR-NOT family in this matrix |
| SP-09.06 | [PUS-247](https://linear.app/pushtirastu/issue/PUS-247) | FR-DAS family in this matrix |
| SP-09.07 | [PUS-248](https://linear.app/pushtirastu/issue/PUS-248) | FR-BIL family in this matrix |
| SP-09.08 | [PUS-249](https://linear.app/pushtirastu/issue/PUS-249) | Matrix + automated coverage checker |
