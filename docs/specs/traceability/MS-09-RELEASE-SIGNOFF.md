# MS-09 Release Sign-off

Milestone: **MS-09 — Canon Coverage & Acceptance Remediation**  
Owner issue: [PUS-249](https://linear.app/pushtirastu/issue/PUS-249) · GitHub [#293](https://github.com/riddhi2106/great-ptw-loto-ai-app/issues/293)

## Coverage gate

- [ ] Automated matrix check green: `npm run test -w api -- --testPathPattern=ms09-canon-traceability`
- [ ] Matrix shows **53/53** mapped IDs in [`MS-09-CANON-TRACEABILITY.md`](./MS-09-CANON-TRACEABILITY.md)
- [ ] Alias table resolves NOT↔NTF and DAS↔DSH without ambiguous “implemented” claims
- [ ] Remediation tickets Done: PUS-243, PUS-246, PUS-242, PUS-244, PUS-245, PUS-247, PUS-248, PUS-249

## Regression evidence (attach CI / local logs)

- [ ] Positive + negative API suites for remediations
- [ ] RBAC / tenant-isolation samples for dashboards, billing, notifications
- [ ] Audit log checks for plan change / invoice / approval paths
- [ ] Migration apply on clean DB (`npm run db:migrate`)
- [ ] Web smoke: login, dashboard, reports, billing
- [ ] Mobile smoke: Expo bundler + authenticated read path

## Manual safety-critical workflows

| Path | Verified by | Date | Result | Notes |
|------|-------------|------|--------|-------|
| Approval (multi-stage veto / FR-PTW) | | | Pass / Fail | |
| SIMOPS conflict detect + alert | | | Pass / Fail | |
| Multi-day validity / renewal (FR-MDP-009) | | | Pass / Fail | |
| Incident severity lifecycle (FR-INC-011) | | | Pass / Fail | |

## Defect triage

Safety-critical open defects **block** sign-off. Non-blocking items must be linked with severity.

| Defect | Severity | Blocks release? | Owner |
|--------|----------|-----------------|-------|
| | | | |

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering | | | |
| QA | | | |
| Product / Safety | | | |
