# PTW Platform

Enterprise Permit-to-Work and safety management platform.

## Repository structure

```
app/                 NestJS backend (PTW API)
frontend/            Next.js web application
mobile/              React Native (Expo) mobile application
packages/shared/     Shared TypeScript types and constants
tests/               Jest suites
scripts/             seed, migrate, healthcheck
infrastructure/      Keycloak realm export
docs/                Specs, architecture, API
docker-compose.yml   Local infrastructure + app containers
```

## Prerequisites

- Node.js 20+
- Docker and Docker Compose

## Quick start

1. Start infrastructure:

```bash
docker compose up -d postgres redis minio keycloak
```

2. Configure environment and install/migrate:

```bash
cp .env.example .env   # adjust as needed; .env is gitignored
npm install
npm run db:migrate
npm run db:seed
```

Required environment variables are validated at API startup; see
`.env.example` for the full list and the isolation execution (SP-03.02)
infrastructure configuration.

3. Run apps:

```bash
npm run dev:api
npm run dev:web
npm run start -w mobile
```

4. Healthcheck:

```bash
npm run healthcheck
```

## API endpoints (foundation)

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/v1/health` | GET | Public | Service health |
| `/api/v1/auth/profile` | GET | Required | Current user profile |
| `/api/v1/system/config` | GET | Public | Client configuration |
| `/api/v1/system/version` | GET | Public | Version information |

## Default Keycloak credentials (development)

- URL: `http://localhost:8080`
- Realm: `ptw-platform`
- Admin: `admin` / `admin`
- Test users (run `./scripts/keycloak-sync-dev-users.sh` if only admin exists):
  - `admin@ptw.local` / `admin` — platform admin
  - `orgadmin@ptw.local` / `orgadmin` — organisation admin (System Administrator)
  - `issuer@ptw.local` / `admin` — job issuer
  - `operator@ptw.local` / `admin` — job executor
  - `hod@ptw.local` / `admin` — Head of Department
  - `safety@ptw.local` / `admin` — safety officer
  - `viewer@ptw.local` / `admin` — read-only viewer

## Testing

```bash
npm run test
```

## Demo data

Seed master data and workflow scenarios (permits, approvals, execution, LOTOTO, incidents, SIMOPS, notifications):

```bash
npm run db:migrate
npm run db:seed
```

See [docs/demo-seed-scenarios.md](docs/demo-seed-scenarios.md) for reference codes and which login to use per scenario.

## Sprint reference

Foundation implements **MS-01 – Platform Foundation** per `docs/specs/IMPLEMENTATION PLAN.md`.
