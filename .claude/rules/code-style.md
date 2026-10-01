# Code style

- NestJS feature modules stay under `app/src/modules/`.
- Services live with their feature modules. The current application has no implemented AI retrieval pipeline; do not assume `app/src/components/` or `app/src/services/` exists.
- Prefer extending existing modules over new abstractions.
- TypeScript strict mode; no `any` without justification.
