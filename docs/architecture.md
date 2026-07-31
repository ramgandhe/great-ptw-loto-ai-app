# Architecture

PTW platform layout maps the production AI skeleton onto NestJS + Next.js.

```
app/                 NestJS API (PTW modules + AI RAG layer)
frontend/            Next.js web UI
mobile/              React Native (Expo)
packages/shared/     Shared types/constants
tests/               Jest suites (PTW + AI)
evaluation/          Golden set + offline/online eval
observability/       Tracing / cost / feedback re-exports
data/                Raw → processed → index config
scripts/             seed, migrate, healthcheck wrappers
infrastructure/      Keycloak realm export
docs/                Specs + architecture
```

Frontend calls `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`).
AI endpoints: `GET /ai/health`, `POST /ai/query`.
