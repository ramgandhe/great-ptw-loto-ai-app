# Deployment

## Local infrastructure

```bash
docker compose up -d postgres redis minio keycloak
npm install
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

## Full stack containers

```bash
docker compose up -d --build
```

API: `http://localhost:4000/api/v1/health`  
Web: `http://localhost:3000`  
Keycloak: `http://localhost:8080`

## Environment configuration

Copy `.env.example` to `.env` and set values for your environment. `.env` is
gitignored — never commit real secrets. Required variables are validated at API
startup (`app/src/config/validate-env.ts`): in `NODE_ENV=production` a missing
variable aborts boot; in development a warning is logged and defaults are used.

Required: `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `MINIO_ENDPOINT`,
`MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `KEYCLOAK_URL`,
`KEYCLOAK_REALM`, `LOKI_URL`. In `docker-compose.yml` the MinIO credentials are
supplied via `${MINIO_ACCESS_KEY}` / `${MINIO_SECRET_KEY}` interpolation with
local-dev fallbacks, so production credentials are injected from the environment
rather than committed.

## Isolation Execution infrastructure (SP-03.02)

The Isolation Execution module depends on:

- **Redis** — caches active isolation sessions (`isolation:detail:*`,
  `isolation:plan:*`), invalidated on every lock/tag/verification/status change.
- **BullMQ** (`platform-queue`) — repeatable `isolation.reminder` job
  (`ISOLATION_REMINDER_CRON`) that flags active isolation sessions pending
  verification.
- **MinIO** — evidence storage for `isolation_evidence`; the API issues presigned
  upload/download URLs (`ISOLATION_EVIDENCE_URL_EXPIRY_SECONDS`).
- **Keycloak** — role validation (`isolation-officer`, `verifier`, `supervisor`,
  `org-admin`, `platform-admin`) enforced server-side on every lock/tag/
  verification route.
- **Grafana Loki** — structured isolation event logging (`loki: true` marker).

## Restoration & History infrastructure (SP-03.03)

The Restoration & History module depends on:

- **Redis** — historical cache (`restoration:detail:*`, `restoration:history:exec:*`,
  `restoration:history:plan:*`), invalidated on every restoration mutation.
- **BullMQ** (`platform-queue`) — repeatable `restoration.notification` job
  (`RESTORATION_NOTIFICATION_CRON`) flagging verified executions pending restoration.
- **MinIO** — restoration-evidence storage via presigned upload/download URLs
  (`RESTORATION_EVIDENCE_URL_EXPIRY_SECONDS`), keyed under the execution path.
- **Keycloak** — role validation (`isolation-officer`, `verifier`, `supervisor`,
  `org-admin`, `platform-admin`) enforced server-side on every restoration/removal route.
- **Grafana Loki** — structured restoration event logging (`loki: true` marker).

## Multi-Day Daily Progress infrastructure (SP-05.01)

The Daily Progress module depends on:

- **Redis** — caches active multi-day permit lists and per-permit progress
  (`mdp:active:*`, `mdp:progress:*`), invalidated on progress/handover writes.
- **BullMQ** (`platform-queue`) — repeatable `mdp.daily-reminder` job
  (`MDP_DAILY_REMINDER_CRON`) that flags active permits for daily progress.
- **MinIO** — daily evidence under `MDP_EVIDENCE_PREFIX` (default
  `mdp/daily-progress`) inside `MINIO_BUCKET`; presigned URL expiry via
  `MDP_EVIDENCE_URL_EXPIRY_SECONDS`.
- **Keycloak** — role validation for daily progress / handover routes.
- **Grafana Loki** — structured MDP event logging (`loki: true` marker).

## Multi-Day Daily Revalidation infrastructure (SP-05.02)

The Daily Revalidation module depends on:

- **Redis** — caches revalidation views (`mdp:revalidation:*`,
  `mdp:extensions:pending:*`), invalidated on revalidation/extension/suspend writes.
- **BullMQ** — `mdp.revalidation-reminder` (`MDP_REVALIDATION_REMINDER_CRON`) and
  `mdp.extension-expiry` (`MDP_EXTENSION_EXPIRY_CRON`) repeatable jobs.
- **Keycloak** — role validation for revalidation / continuation / extension routes.
- **Grafana Loki** — structured revalidation event logging (`loki: true` marker).

## Incident Recording infrastructure (SP-06.01)

The Incident Recording module depends on:

- **Redis** — caches tenant incident lists and detail views
  (`incident:list:*`, `incident:detail:*`), invalidated on writes.
- **BullMQ** (`platform-queue`) — repeatable `incident.open-reminder` job
  (`INCIDENT_OPEN_REMINDER_CRON`) that flags open incidents for Safety Officers.
- **MinIO** — incident evidence under `INCIDENT_EVIDENCE_PREFIX` (default
  `incidents/evidence`) inside `MINIO_BUCKET`; presigned URL expiry via
  `INCIDENT_EVIDENCE_URL_EXPIRY_SECONDS`.
- **Keycloak** — role validation for incident reporting routes.
- **Grafana Loki** — structured incident event logging (`loki: true` marker).

## Investigation infrastructure (SP-06.02)

The Investigation module depends on:

- **Redis** — caches investigation detail views (`investigation:detail:*`),
  invalidated on assignment / RCA / action writes.
- **BullMQ** — repeatable `investigation.overdue-actions` job
  (`INVESTIGATION_OVERDUE_ACTION_CRON`) that flags overdue corrective actions.
- **MinIO** — investigation evidence continues under incident evidence prefix.
- **Keycloak** — role validation for investigation / action routes.
- **Grafana Loki** — structured investigation event logging (`loki: true` marker).

## Health checks

`docker compose up` gates the `api` service on `postgres`, `redis` and `minio`
being healthy, and the `api` container has its own healthcheck against
`/api/v1/health`. That endpoint aggregates the status of Postgres, Redis,
MinIO, BullMQ and Keycloak — use it to confirm all dependent services are green:

```bash
curl -fsS http://localhost:4000/api/v1/health | jq
```

## Rollback

Deployments are rolled back by reverting the merge and, where a migration was
included, rolling the database forward to a compensating state (migrations are
forward-only; there is no destructive down-migration).

1. **Application:** revert the merge commit on the target branch and redeploy the
   previous image tag:

   ```bash
   git revert -m 1 <merge_commit_sha>
   git push origin <branch>
   docker compose up -d --build api frontend
   ```

2. **Database:** the SP-03.02 tables (`isolation_execution`, `applied_locks`,
   `applied_tags`, `isolation_verifications`, `isolation_evidence`) are additive
   in migration `0008` and are not read by earlier (MS-02) code, so a reverted
   application can run against the migrated schema without a down-migration. If
   the tables must be removed, apply a new forward migration that drops them
   (never edit or delete an applied migration file).
3. **Verify:** `curl /api/v1/health` returns `healthy` and CI is green on the
   reverting PR.
