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
docs/                Specs, architecture, API, deployment
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
`.env.example` and `docs/deployment.md` for the full list and the isolation
execution (SP-03.02) infrastructure configuration.

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
- Test user: `admin@ptw.local` / `admin`

## Testing

```bash
npm run test
```

## Sprint reference

Foundation implements **MS-01 – Platform Foundation** per `docs/specs/IMPLEMENTATION PLAN.md`.
