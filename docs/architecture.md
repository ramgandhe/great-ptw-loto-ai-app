# Architecture

PTW platform layout maps the production stack onto NestJS + Next.js.

```
app/                 NestJS API (PTW modules)
frontend/            Next.js web UI
mobile/              React Native (Expo)
packages/shared/     Shared types/constants
tests/               Jest suites
scripts/             seed, migrate, healthcheck wrappers
infrastructure/      Keycloak realm export
docs/                Specs + architecture
```

Frontend calls `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`).
