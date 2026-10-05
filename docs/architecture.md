# Architecture

## v2 data security core (Phase 1a, PRD §16 and §18)

- **Status.** Owner decision D32: a demo build ahead of counsel's advice, with synthetic data only. The lawful
  bases, the notices and the audit classification of personal fields are provisional until counsel's accepted
  outcome is recorded.
- **Roles.** `ptw_owner` owns the schema and runs migrations and seeds; it has BYPASSRLS and is never given to the
  running API. Its password lives in `infrastructure/postgres/.env`, read only by the postgres service.
  `ptw_api` (DATABASE_URL) is NOSUPERUSER, NOBYPASSRLS and owns nothing. The API refuses to start if it can see
  `MIGRATION_DATABASE_URL` or `PTW_OWNER_PASSWORD`, or if its role, or any role it belongs to, is a superuser,
  bypasses RLS or owns a table. No database credential is compiled into `app/src`: `migrate.ts` requires
  `MIGRATION_DATABASE_URL` for its one command or job. Keycloak has its own database and role. Metabase is removed.
  `0008_hardening`: a trigger lets only the platform admin change an organisation's `kind`, `status` or `slug`; the
  API role cannot write `accounts` or `people.account_id` (Phase 1b links accounts through a SECURITY DEFINER
  function); `people.email` is trimmed and non-empty when present.
- **Context.** Every query runs inside `runInContext` (`app/src/database/context.ts`), which first calls
  `set_config('app.tenant_id' | 'app.person_id' | 'app.legal_entity_ids' | 'app.acting_role', value, true)`.
  All four are always set; `none` is an explicitly empty value, and a missing setting makes any context incomplete.
  Feature code gets `ContextDb`, never the raw connection or pool. A lint rule rejects `set_config` or `SET app.*`
  anywhere else in `app/src`.
- **Policies.** Every table has ENABLE and FORCE RLS. Every policy requires `app_context_valid()`: a user context
  needs a tenant, an active person of that tenant and legal entities of that tenant; a job needs a tenant, no
  person and only legal entities of that tenant; a platform admin has none of the three. Tenant tables use
  `tenant_isolation` (`tenant_id = app_tenant_id()`); `organisations` has its own (own row; the platform admin reads
  all and creates tenants). Child rows reference parents by `(tenant_id, id)`. `accounts` are readable only through
  a person record in the request tenant. Engagements are readable by both parties and written by the client.
- **Definer functions.** Exactly three, each with a pinned `search_path`: `app_context_valid`,
  `app_tenant_ids_for_jobs` and `app_person_contact`. `tests/schema-security.spec.ts` holds them to that allow-list
  and also rejects any view without `security_invoker` and any materialized view.
- **Full record.** The API role cannot select `people.email` or `people.phone`; they are read through
  `PersonalDataService.readProfile` (via `app_person_contact`, which needs a valid user context and the person or an
  admin of their employer legal entity) and logged. A second lint rule allows `app_person_contact` only in
  `personal-data.service.ts`. Write `people` with explicit `returning({ ... })` columns. Phase 2's new full-record
  columns follow the same rule.
- **Personal data.** Sensitive fields live in `person_private_data`, encrypted with AES-256-GCM (`<person id>:<field>`
  as associated data) under a per-tenant data key wrapped by the OpenBao Transit master key. Only
  `PersonalDataService` decrypts; it checks FR-PRV-005, gates consent-based fields and writes
  `personal_data_access_log` in the same transaction before returning anything, so a failed log write returns nothing.
  Its writes are audited with the employer legal entity and, for an admin, the person acted for.
- **Consent.** `ConsentService.record` is the only consent operation. Each decision is bound to the notice version
  shown or signed and its decision date (and time, for in-app decisions). On the latest decision date, the
  decisions that cannot be ordered against each other decide (a day with a signed form: all of them; otherwise
  those at the latest instant), and consent is in force only if all of them are "given". Any decision that leaves
  consent not in force deletes every stored field of the category (`CATEGORY_FIELDS`) in the same transaction.
  The sign-in identity (`people.email`) is separate from optional contact details (`people.phone`), relies on
  employment and never on consent, so withdrawing contact consent never touches sign-in, tenant access, roles or
  permit duties (D31). A phase that stores new consent-based data adds it to `CATEGORY_FIELDS`.
- **Audit.** `AuditWriter` writes `audit_events` in the action's transaction. Named personal fields and secrets
  (passwords, tokens, keys and the like) are recorded as "changed" wherever they appear. Interim rule pending
  counsel: on a person or account entity only the internal IDs in `INTERNAL_IDS` keep their values. Consent
  decisions are audited under the entity type `consent`. The API can only insert into and read audit, access-log,
  consent, notice and data-key tables.
- **Jobs.** Cross-tenant sweeps take tenant IDs from `app_tenant_ids_for_jobs()` and run each tenant under its own
  context; payloads hold record IDs only; a failed job is removed at its final failure and its failure is logged.
- **Proof.** `tests/schema-security.spec.ts` (run as the API role) and `tests/isolation.spec.ts` (catalogue-driven:
  a new table fails until it has a policy, a fixture row and a classification; incomplete contexts are set
  directly and must read and write nothing). Tests run on a throwaway PostgreSQL with `npm run test:api:fresh`;
  CI v2 (`.github/workflows/ci-v2.yml`) runs the suite on `v2` and `v2-*` branches.

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
