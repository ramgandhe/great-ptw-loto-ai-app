# PTW Platform

Enterprise Permit-to-Work and safety management platform (MS-01 / SP-01.01).

## Repository structure

```
apps/
  api/      NestJS backend
  web/      Next.js web application
  mobile/   React Native (Expo) mobile application
packages/
  shared/   Shared TypeScript types and constants
infrastructure/
  docker-compose.yml
  keycloak/
docs/
  specs/
```

## Prerequisites

- Node.js 20+
- Docker and Docker Compose (for local infrastructure)

## Quick start

1. Copy environment template:

```bash
cp infrastructure/.env.example .env
```

2. Start infrastructure services:

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

3. Install dependencies:

```bash
npm install
```

4. Run database migrations:

```bash
npm run db:migrate -w api
```

5. Start applications:

```bash
npm run dev:api
npm run dev:web
npm run start -w mobile
```

## API endpoints (SP-01.01)

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/v1/health` | GET | Public | Service health |
| `/api/v1/auth/profile` | GET | Required | Current user profile |
| `/api/v1/auth/logout` | POST | Required | Logout acknowledgement |
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

This foundation implements **MS-01 – Platform Foundation**, sprint **SP-01.01 – Platform Infrastructure** per `docs/specs/IMPLEMENTATION PLAN.md`.
