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

## Production deployment (SP-08.03)

Use the production overlay — secrets come from `.env.production` (never committed):

```bash
cp .env.production.example .env.production
# edit secrets, CORS_ORIGIN, KEYCLOAK_HOSTNAME, NEXT_PUBLIC_API_URL
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --env-file .env.production up -d --build
DATABASE_URL=... npm run db:migrate
curl -fsS http://127.0.0.1:4000/api/v1/health
```

### Go-live sequence

1. Infrastructure verification (Postgres, Redis, MinIO, Keycloak, Loki, Metabase healthy).
2. Verified backup (`backup_runs` / external snapshot) before migrate.
3. Deploy API image; run migrations forward only.
4. Deploy frontend; confirm `NEXT_PUBLIC_API_URL`.
5. Smoke: auth, health, permit create/approve path, file upload, notifications.
6. Enable production traffic; enter hypercare with raised Loki/alert attention.

### Production compose controls

`docker-compose.prod.yml` requires secret env vars (`POSTGRES_PASSWORD`,
`REDIS_PASSWORD`, MinIO keys, Keycloak admin, `DATABASE_URL`, `CORS_ORIGIN`),
binds published ports to `127.0.0.1`, sets `restart: unless-stopped`, forces
`NODE_ENV=production` on API/frontend, enables `SECURITY_TRUST_PROXY`, and gates
API on healthy Loki as well as Postgres/Redis/MinIO/Keycloak.

### Loki / monitoring

- Ship API structured logs (`loki: true`) to Grafana Loki.
- Alert on sustained `/api/v1/health` unhealthy, migration failures, and backup
  job failures recorded in `backup_runs`.
- Retain logs per organisational policy (see `data_retention_policies`).

### Go-live rollback

Same as the SP-08.02 rollback path: redeploy previous images, restore Postgres
from the pre-migrate backup if needed, migrate forward only, verify health
before opening traffic.

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

## Production readiness database (SP-08.03)

Migration `0021_production_readiness.sql` adds operational tables used for
go-live validation (not tenant business workflows):

| Table | Purpose |
| --- | --- |
| `backup_runs` | Metadata for Postgres / MinIO / config / Keycloak backups and restore verification |
| `data_retention_policies` | Platform defaults (`tenant_id` null) and per-tenant retention overrides |
| `migration_run_log` | Append-oriented record of dry-run / production migration sequencing |

### Go-live migration sequence

1. Take a verified Postgres backup; record a `backup_runs` row (`trigger=pre_migrate`).
2. Dry-run migrations against a restored staging copy; log each tag in `migration_run_log`.
3. Apply migrations forward only on production (`npm run db:migrate`).
4. Run `ANALYZE` on hot tables after index-heavy releases.
5. Confirm seed/reference catalogues (permit types, PPE, etc.) for each tenant.

Do **not** roll back migrations by dropping tables. Restore from the verified
backup and re-apply forward if a release must be reverted.

### Backup schedule (minimum)

- **Postgres** — daily full + continuous WAL if available; verify restore weekly.
- **MinIO** — bucket replication or periodic sync of evidence buckets.
- **Config / Keycloak** — export realm and env templates with each release.

Retention defaults should keep audit history at least as long as organisational
policy requires; use `data_retention_policies` to document enforced windows.

## Database performance hardening (SP-08.02)

Migration `0020_database_performance_hardening.sql` adds composite indexes for
high-traffic tenant-scoped queries (permits by creator/status, incidents by
occurred_at, notification recipients by user/read, audit logs, report exports,
billing invoices/subscriptions).

API pool knobs (defaults shown):

- `DATABASE_POOL_MAX=20`
- `DATABASE_POOL_IDLE_TIMEOUT_MS=30000`
- `DATABASE_POOL_CONNECTION_TIMEOUT_MS=5000`

After deploy, run `ANALYZE` on hot tables during a maintenance window if
query plans lag behind new indexes.

## Infrastructure hardening (SP-08.02)

Hardening controls for platform dependencies:

- **Redis** — optional `REDIS_PASSWORD` (compose enables `--requirepass` when set);
  API/BullMQ clients pass the password when configured.
- **BullMQ** — `BULLMQ_WORKER_CONCURRENCY` controls worker parallelism (default 5).
- **API throttling** — `RATE_LIMIT_TTL_MS` / `RATE_LIMIT_LIMIT` feed Nest Throttler.
- **Keycloak** — compose waits on Keycloak health before starting `api`; production
  should shorten access-token TTL, enable HTTPS, and restrict admin console exposure.
- **MinIO** — inject `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` from secrets; never
  commit production credentials.
- **Loki** — retain structured `loki: true` logs for security/ops investigation.

### Rollback path

1. Redeploy previous known-good images/tags for `api` / `frontend`.
2. If a migration shipped with the release, do **not** drop tables; restore from
   the latest Postgres backup and re-run `npm run db:migrate` only forward.
3. Clear Redis cache keys if stale config was cached (`FLUSHDB` only on dedicated
   PTW Redis instances).
4. Verify `/api/v1/health` is green before routing traffic back.

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

## Incident Closure infrastructure (SP-06.03)

The Incident Closure module depends on:

- **Redis** — caches archive list/detail views (`incident:archive:*`),
  invalidated on verify/close writes.
- **BullMQ** — repeatable `incident.closure-notify` job
  (`INCIDENT_CLOSURE_NOTIFY_CRON`) for verified incidents pending closure.
- **MinIO** — historical evidence remains under incident evidence prefix.
- **Keycloak** — role validation for verify / close / archive routes.
- **Grafana Loki** — structured closure event logging (`loki: true` marker).

## Notifications infrastructure (SP-07.01)

The Notifications module depends on:

- **Redis** — caches per-user notification lists and unread counts
  (`notification:list:*`, `notification:unread:*`), TTL via
  `NOTIFICATION_CACHE_TTL_SECONDS`.
- **BullMQ** (`platform-queue`) — repeatable jobs:
  - `notification.delivery-retry` (`NOTIFICATION_DELIVERY_RETRY_CRON`) scans
    failed `notification_recipients` whose `next_retry_at` is due.
  - `notification.task-reminder` (`NOTIFICATION_TASK_REMINDER_CRON`) emits
    reminder sweeps for recent `task_reminder` notifications.
- **Keycloak** — recipient identity / role validation for notification routes
  (wired in BE-SP-07.01).
- **Grafana Loki** — structured delivery logging (`loki: true` marker).

## Dashboards & Analytics infrastructure (SP-07.02)

The Dashboards & Analytics module depends on:

- **Redis** — caches dashboard payloads, KPI widgets and analytics views
  (`dashboard:*`, `dashboard:kpi:*`, `dashboard:analytics:*`), TTL via
  `DASHBOARD_CACHE_TTL_SECONDS`.
- **BullMQ** (`platform-queue`) — repeatable jobs:
  - `dashboard.report-generate` (`DASHBOARD_REPORT_GENERATE_CRON`) flags
    pending `report_exports` for generation.
  - `dashboard.analytics-snapshot` (`DASHBOARD_ANALYTICS_SNAPSHOT_CRON`)
    triggers nightly analytics snapshot sweeps.
  - `dashboard.kpi-refresh` (`DASHBOARD_KPI_REFRESH_CRON`) flags expired
    `kpi_cache` rows for recomputation.
- **MinIO** — generated report files under `DASHBOARD_REPORT_PREFIX`
  (default `dashboards/reports`) inside `MINIO_BUCKET`.
- **Metabase** — optional embedded analytics via `METABASE_URL`
  (leave empty when not configured).
- **Keycloak** — role validation for dashboard / report routes
  (wired in BE-SP-07.02).
- **Grafana Loki** — structured dashboard/ops metric logging (`loki: true`).

## Billing & Subscription infrastructure (SP-08.01)

The Billing & Subscription module depends on:

- **Redis** — caches plan catalogue, tenant subscription and usage lookups
  (`billing:plan:*`, `billing:subscription:*`, `billing:usage:*`), TTL via
  `BILLING_CACHE_TTL_SECONDS`.
- **BullMQ** (`platform-queue`) — repeatable jobs:
  - `billing.cycle-invoice` (`BILLING_CYCLE_INVOICE_CRON`) flags renewing
    `tenant_subscriptions` for invoice drafting.
  - `billing.usage-aggregate` (`BILLING_USAGE_AGGREGATE_CRON`) emits usage
    aggregation sweeps into `usage_records`.
  - `billing.renewal-notify` (`BILLING_RENEWAL_NOTIFY_CRON`) flags upcoming
    renewals within `BILLING_RENEWAL_HORIZON_DAYS` (FR-BIL-005).
- **Keycloak** — org-admin / platform-admin role validation for billing routes
  (wired in BE-SP-08.01).
- **Grafana Loki** — structured billing event logging (`loki: true`).
- **Metabase** — optional usage/revenue reporting via `METABASE_URL`.

## Health checks

`docker compose up` gates the `api` service on `postgres`, `redis` and `minio`
being healthy, and the `api` container healthcheck probes
`/api/v1/health/ready` (DB + Redis). Aggregated status remains available at
`/api/v1/health`; process liveness at `/api/v1/health/live`:

```bash
curl -fsS http://localhost:4000/api/v1/health/ready | jq
curl -fsS http://localhost:4000/api/v1/health/live | jq
```

Production boots (`NODE_ENV=production`) also require `REDIS_PASSWORD` and
`CORS_ORIGIN`, and refuse known local/dev secret defaults.
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
