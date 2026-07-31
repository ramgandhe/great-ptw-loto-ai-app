# Testing

- PTW and AI Jest specs live in `/tests`.
- Run with `npm run test -w api` (cwd resolves migrations via `app/`).
- AI golden evaluation: `npx tsx evaluation/offline_eval.ts` (requires auth token).
- Do not fabricate passing results.
