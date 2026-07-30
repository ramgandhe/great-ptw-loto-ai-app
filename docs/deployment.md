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
