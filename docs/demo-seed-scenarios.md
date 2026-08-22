# Demo seed scenarios

Run after migrations:

```bash
npm run db:migrate
npm run db:seed
```

Re-run `./scripts/keycloak-sync-dev-users.sh` on a **fresh** Keycloak realm so dev user IDs match seed data (`seed-ids.ts`). Existing Keycloak users keep their generated IDs unless recreated.

## Dev logins

| Login | Password | Persona |
|-------|----------|---------|
| `issuer@ptw.local` | `admin` | Job issuer |
| `hod@ptw.local` | `admin` | Head of Department |
| `safety@ptw.local` | `admin` | Safety officer |
| `operator@ptw.local` | `admin` | Job executor |
| `viewer@ptw.local` | `admin` | Read-only |
| `orgadmin@ptw.local` | `orgadmin` | Org admin |

## Default approval workflow

Pre-execution approval is **HOD initial review only**. Executor steps are part of permit creation, not approval.

## PRD lifecycle (six phases)

1. Issuer initiation — creation wizard steps 1–2
2. Executor on-site details — creation wizard steps 3–4
3. HOD initial review — approval workflow
4. Executor pre-work confirmation — execution / LOTOTO
5. Issuer completion approval — closure
6. HOD final approval — closure

## Permit scenarios (`PTW-DEMO-*`)

| Reference | Status | Test as | What to verify |
|-----------|--------|---------|----------------|
| PTW-DEMO-001 | `draft` | Issuer | Edit/submit incomplete permit |
| PTW-DEMO-002 | `pending_approval` (HOD initial, stage 3) | HOD | Stages 1–2 complete; HOD initial review active |
| PTW-DEMO-003 | `pending_approval` (executor pre-work, stage 4) | Operator | Stages 1–3 complete; executor pre-work confirmation active |
| PTW-DEMO-004 | `deferred` | Issuer | Resubmit after deferral |
| PTW-DEMO-005 | `rejected` | Issuer | View rejection reason |
| PTW-DEMO-006 | `approved` | Operator / HOD | LOTOTO plan setup |
| PTW-DEMO-007 | `active` | Operator | Execution, progress, evidence |
| PTW-DEMO-008 | `suspended` | HOD / Operator | Suspended execution |
| PTW-DEMO-009 | `pending_closure` | HOD | Verify and close |
| PTW-DEMO-010 | `closed` | Viewer | Archive / audit history |
| PTW-DEMO-011 | `cancelled` | Viewer | Terminal cancelled state |
| PTW-DEMO-012 | `expired` | Viewer | Expired validity edge case |
| PTW-DEMO-013 / 014 | `active` / `approved` | HOD | SIMOPS conflict overlap |

## LOTOTO (`LOTOTO-DEMO-*`)

| Reference | Status | Test as | What to verify |
|-----------|--------|---------|----------------|
| LOTOTO-DEMO-001 | `draft` | HOD | Plan authoring |
| LOTOTO-DEMO-002 | `ready` | Operator | Ready for execution |
| LOTOTO-DEMO-003 | `in_execution` | Operator | Apply locks / active isolation |

## Incidents (`INC-DEMO-*`)

| Reference | Status | Test as | What to verify |
|-----------|--------|---------|----------------|
| INC-DEMO-001 | `open` | Operator | Report / triage |
| INC-DEMO-002 | `pending_hod_decision` | HOD | Near-miss HOD decision |
| INC-DEMO-003 | `closed` | Safety / Viewer | Closed incident history |

## SIMOPS

- Open high-severity location conflict linking PTW-DEMO-013 and PTW-DEMO-014 — resolve as HOD.

## Notifications (dashboard)

- HOD: permit approval pending (PTW-DEMO-002)
- Operator: daily progress reminder (PTW-DEMO-007)
- HOD / Safety: SIMOPS escalation

## Idempotency

Seed uses upserts / `onConflictDoNothing` on stable IDs and references. Safe to re-run on dev; existing rows with the same keys are updated or skipped.
