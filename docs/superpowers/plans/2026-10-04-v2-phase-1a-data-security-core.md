# PermitWiseAI v2 Phase 1a: Data and Security Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 4 (2026-10-04).** This revision applies the three findings in `.planning/2026-10-03-prd-restructure/phase-1a-plan-review-r3.md`.
- **R3-STD-01:** Task 5's fresh-and-reused-connection test reads only tables that exist, taken from the catalogue.
- **R3-SPEC-01:** follows PRD v0.5 (D31, approved by the owner on 2026-10-04). The sign-in identity (`people.email`) is separate from optional contact details (`people.phone`).
  - The sign-in identity relies on employment and never on consent.
  - Withdrawing contact consent deletes the phone only. It keeps the account link, tenant access, roles and permit duties.
- **R3-SPEC-02:** two in-app decisions with the same timestamp cannot be ordered. Consent then counts only if both are "given", whatever their row order.

**Revision 3 (2026-10-04).** This revision applied the four findings in `.planning/2026-10-03-prd-restructure/phase-1a-plan-review-r2.md`.
- **R2-STD-01:** no database credential is compiled into API code. `migrate.ts` requires `MIGRATION_DATABASE_URL` and has no default, the API's `DATABASE_URL` has no default, and a test scans `app/src`.
- **R2-STD-02:** every setting must be present. An explicitly empty value is `none`; a missing setting makes any context, including a job or platform context, incomplete.
- **R2-SPEC-01:** in-app decisions keep their exact time. A signed form carries only its date, so on a day that has a form, consent is in force only if every decision that day is "given". A same-day withdrawal therefore always wins.
- **R2-SPEC-02:** withdrawal deletes every stored field of the category, contact fields included. Revision 3 also cleared email and unlinked the account; revision 4 replaces that with D31, so only optional contact details are deleted.

**Revision 2 (2026-10-04).** This revision applied the eight findings in `.planning/2026-10-03-prd-restructure/phase-1a-plan-review.md`.
- **Runtime credentials:** owner credentials are kept out of the API, and the API refuses to start with them (STD-01).
- **Context completeness:** policies deny any incomplete or inconsistent context, and the raw pool is no longer exported (STD-02).
- **Consent wording:** each consent decision records the notice version it was given under and its own date (SPEC-01).
- **Withdrawal:** there is one consent operation, and it deletes dependent data on any decision other than "given" (SPEC-02).
- **Contact fields:** contact columns are not readable by the API role, and there is a logged profile read (SPEC-03).
- **Counsel gate:** counsel review gates the consent and personal-data tasks, which now come last (SPEC-04).
- **Failed jobs:** failed jobs are removed when they fail (SPEC-06).
- **Isolation:** v2 runs in its own worktree and Docker volumes.
- **Table count:** the plan creates 18 tables.

SPEC-05 is fixed in the roadmap.

**Goal:** Replace the v1 data layer with the v2 security core:
- database roles that cannot bypass row-level security;
- a transaction-local request context, which the database itself checks for completeness;
- tenant isolation proven for every table;
- person and account records, roles and permission checks;
- an audit writer and consent records;
- the only service that reads personal data.

**Architecture:**
- **Roles and context.**
  - PostgreSQL row-level security is the tenant boundary. The API connects as `ptw_api`, which owns no table and cannot bypass RLS.
  - Migrations run as `ptw_owner` in a separate step. Owner credentials never reach the API.
  - Every query runs inside `runInContext`, whose first statement sets the `app.*` settings with `set_config(..., true)`.
  - Every policy requires `app_context_valid()`, which checks that the context is complete for its acting role and consistent with the tenant. A missing, partial or mismatched context matches nothing.
- **Isolation proof.** The isolation suite reads the table list from the catalogue and tries incomplete contexts against every table.
- **Sensitive data.**
  - Sensitive person fields are encrypted with AES-256-GCM under a per-tenant data key, which is wrapped by a master key in OpenBao Transit.
  - Contact columns are not granted to the API role at all.
  - Only `PersonalDataService` reads either kind, and it logs every view in the same transaction.

**Tech Stack:** NestJS 11, Drizzle ORM 0.40 (hand-written SQL migrations with a Drizzle journal), PostgreSQL 16, Jest 29 with ts-jest, BullMQ, OpenBao 2 Transit (new component: owner approval needed), Node `crypto`.

**Spec:** `docs/specs/2026-10-04-permitwiseai-v2-prd.md`. v0.4 was approved on 2026-10-04. This plan follows v0.5 (D31: the sign-in identity is separate from optional contact details), approved by the owner on 2026-10-04. Roadmap: `docs/superpowers/plans/2026-10-04-permitwiseai-v2-roadmap.md`.

**Phase 1a delivers these PRD items:**
- **People:** FR-PPL-001, 004 and 005, plus FR-PPL-003 for the sensitive and contact fields.
- **Roles:** FR-ROL-001 and the FR-ROL-007 model.
- **Privacy:**
  - FR-PRV-002: the consent gate and withdrawal.
  - FR-PRV-004.
  - FR-PRV-005 and 008, for the fields that exist in 1a. Phase 2 applies the same rule to the profile fields it adds.
  - FR-PRV-011: the logic.
  - FR-PRV-001: the records. The screens come in Phase 2.
- **Audit:** FR-AUD-001, 003 and 005.
- **Security:** NFR-SEC-001, 001a, 003 (without key rotation) and 008. NFR-SEC-002 is a skeleton only.
- **Acceptance:** PRD §21 criterion 4, first three clauses.

Phase 1b (identity and sessions) follows; see the roadmap.

## Before you start

**State on 2026-10-04:**
- The v1 UI work is committed as `b34fa03` on `feat/mobile-ui-refresh` and `dev_ram`, tagged `v1-final` and deployed to the dev server.
- Local `main` is at `acaae2a` and is not the v2 base.
- **v2 starts from `v1-final` (`b34fa03`).**

Owner decisions:
0. **PRD v0.5 (D31).** Approved by the owner on 2026-10-04. It separates the sign-in identity from optional contact details and shapes `people` in Task 7 and consent cleanup in Task 13.
1. **O2 key service.** Approved by the owner on 2026-10-04: OpenBao Transit, self-hosted in Docker, for NFR-SEC-003.
   - Dev mode, which keeps keys in memory and loses them on restart, is for disposable local test data only.
   - Persistent storage, an unseal procedure and an application token limited to `datakey` and `decrypt` are prerequisites of the Phase 3 pilot.
   - If the owner chooses a cloud KMS instead, only Task 10's `KeyService` and its compose service change.
2. **O3 branch and environment.**
   - Branch `v2` from `v1-final`, and give each phase its own branch that merges into `v2`.
   - Work in a separate git worktree whose Compose project is `ptw-v2`, so v2 gets its own Docker volumes and its own `.env`. The local v1 database and volumes are never touched.
   - Ports stay the same. On this 8 GB machine the v1 and v2 stacks must not run at the same time, so stop the v1 stack while working on v2.
   - The dev server keeps v1 until the approved Phase 3 pilot.
3. **O4 commits.** Authorised by the owner on 2026-10-04: each task is committed after its tests pass, after `/ponytail-review` and after the task review. Committing never implies a merge or a deploy.
4. **O5 counsel review, as a hard gate.** PRD §22 R4 requires counsel to review the lawful basis per data category, the notice text and the translations before the affected schema is built. The review also covers the employment basis of the sign-in identity (D31).
   - Tasks 13 and 14 (consent, notices, health data and the personal-data service) do not start until that review's accepted outcome is recorded in `.planning/2026-10-03-prd-restructure/findings.md`.
   - The outcome must name any change to the lawful-basis defaults in FR-PRV-001.
   - Tasks 1 to 12 model no health data and can proceed meanwhile.
   - If counsel changes the PRD, the PRD is amended first and Tasks 13 and 14 follow the amended text.

## Global Constraints

- **Ground rules:**
  - A fresh build in the existing codebase, a database reset, and no v1 data migration (D4).
  - No language model anywhere (D5).
  - The design system stays unchanged, with no new design tokens (UX-001). Phase 1a changes no screens.
  - Fixed stack (AGENTS.md): NestJS, Next.js, Expo, PostgreSQL with Drizzle, Keycloak 26, Redis and BullMQ, MinIO. No other new dependency or framework.
- **NFR-SEC-001a, verbatim:**
  - "The API and workers connect as a dedicated login role that is NOSUPERUSER and NOBYPASSRLS and owns no table. Migrations run as a separate owner role that the API cannot assume."
  - "Every table in the application schema has ENABLE and FORCE ROW LEVEL SECURITY and at least one policy."
  - "The API role has only INSERT and SELECT on audit and access-log tables. Keycloak uses its own database and role."
  - "Any reporting tool (Metabase) is removed or connects as a read-only role…" (this plan removes Metabase).
- **Owner credentials:**
  - `MIGRATION_DATABASE_URL` and `PTW_OWNER_PASSWORD` never appear in a compose service, in the root `.env` or in the API's environment.
  - The role passwords live in `infrastructure/postgres/.env`, which only the `postgres` service reads. Migrations run with `npm run db:migrate` from a shell or a one-off job.
  - The API refuses to start if it can see an owner credential, or if its role can bypass RLS or owns a table.
  - No database credential is compiled into API code (`app/src`), so none ships in the API image:
    - `migrate.ts` requires `MIGRATION_DATABASE_URL` and has no default;
    - `DATABASE_URL` has no default;
    - a test scans `app/src`.

    The test helpers keep their local defaults; they are not part of the image.
- **NFR-SEC-008, verbatim:**
  - "Every request and every job runs its queries in a transaction that first sets `app.tenant_id`, `app.person_id`, `app.legal_entity_ids` and `app.acting_role` with `set_config(name, value, true)`."
  - "Session-level SET is forbidden and blocked by a lint rule."
  - "Policies … return no rows when one is missing (default deny)."
  - "Job payloads carry the tenant ID and record IDs only."
  - "Failed jobs are kept for at most 7 days."
- **Valid contexts.** Every policy also requires `app_context_valid()`. First, all four settings must be present; `none` is an explicitly empty value, and a missing setting is never read as empty. Then:
  - **user:** a tenant, an active person of that tenant, and at least one legal entity, all of that tenant;
  - **job:** a tenant, no person, and only legal entities of that tenant;
  - **platform admin:** no tenant, no person, no legal entities.

  Anything else is no context.
- **NFR-SEC-003, verbatim:**
  - "AES-256-GCM using the record ID as associated data."
  - The master key is "never an environment variable, the database or its backups."
  - "Only one personal-data service decrypts; … if the log write fails, nothing is returned."
- **FR-PRV-005, full record:**
  - Contact columns, and every later full-record-only column, are never granted to the API role.
  - They are read only through `PersonalDataService`, which logs the view (FR-PRV-008).
  - Assignment-card columns (name, designation, employer, status) stay readable within the tenant.
- **FR-AUD-005:** contact, identity, health and employment-history values never reach audit. A change to one is recorded as "field X changed by Y at T".
- **Tenant keys.** Every tenant table carries `tenant_id` (organisations use `id`), and child rows reference their parents by `(tenant_id, id)`.
  - The only exceptions are `accounts`, scoped through person records, and the engagement tables, which carry client and agency columns.
  - Each exception is tested on its own.
- **Migrations:**
  - Hand-written SQL in `app/src/database/migrations/`, with a Drizzle journal entry each.
  - Policies, grants and functions cannot be expressed in the Drizzle TypeScript schema, so `drizzle-kit generate` is not used.
  - Because contact columns are not selectable, inserts and updates that return rows return explicit columns only, for example `.returning({ id })`.
- **Tests:** they live in `/tests` and run with `npm run test -w api`. Never report a result you did not see.
- **Git:**
  - The author is Ram Gandhe.
  - The commit message ends with the Co-Authored-By trailer in force for the session. Today that is `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; use the trailer of the model that actually wrote the change.
  - Stage explicit paths only.
- **No test data on the dev server.** Phase 1a deploys nothing.

## Review Focus

These five inputs are implied by the spec, and each one is pinned by a test in the task that owns it:

1. **A request fails halfway, and its pooled connection serves the next tenant.** The rolled-back transaction must take its context with it. Tested in Task 3 (`database-context.spec.ts`) and Task 5 (reused-connection check).
2. **A context that is incomplete or does not fit together.** Examples:
   - a setting missing, for a user, a job or a platform admin alike, on a fresh or a reused connection;
   - no legal entity;
   - a person or legal entity from another tenant;
   - a person who has left;
   - a job carrying a person;
   - a platform admin carrying a tenant;
   - an unknown role.

   Each must read nothing and write nothing, in the database itself and not only in TypeScript. Tested in Task 5 (incomplete-context check), Task 6 (foreign legal entity) and Task 7 (foreign or departed person).
3. **The key service is down or refuses the token during a write.** The write must fail, with no plaintext, no partial row and no access-log entry. Tested in Task 14.
4. **Two requests use a tenant's data key for the first time at once.** Exactly one key version 1 must exist, and both requests must get the same key. Tested in Task 10.
5. **A consent withdrawal races an admin entering blood group.** The withdrawal always succeeds. The write either succeeds before it or is refused after it. Either way, no blood group remains. Tested in Task 14, with each outcome asserted.

---

### Task 1: Clear the v1 data layer in a separate worktree

v2 resets the database (D4), so the v1 API modules, schema, migrations and their specs cannot run. They are removed from the v2 branch; the tag `v1-final` keeps them. The web and mobile apps are not touched. The work happens in its own worktree and Compose project, so the local v1 checkout, database and volumes stay as they are.

**Files** (all inside the v2 worktree):
- Delete:
  - every folder in `app/src/modules/` except `system/`;
  - `app/src/database/schema/` and `app/src/database/migrations/`;
  - `app/src/database/{seed.ts,seed-default-workflow.ts,seed-demo-workflows.ts,seed-ids.ts,seed-master-catalogue.ts,reset.ts,permit-reference.ts}`;
  - `app/src/infrastructure/keycloak/`;
  - `app/src/common/constants/tenant-roles.ts`.
- Delete: every spec under `tests/` that imports a v1 module or the v1 database (111 files, listed by the command in Step 4).
- Create: `app/src/database/schema/index.ts`, `.env` (copied from `.env.example`, not committed).
- Modify: `app/src/app.module.ts`, `app/package.json` (scripts), `package.json` (scripts).

**Interfaces:**
- Consumes: the tag `v1-final`.
- Produces:
  - a worktree at `../great-ptw-loto-ai-app-v2` on branch `v2-phase-1a`, cut from `v2`, which is cut from `v1-final`;
  - an API that builds with only the infrastructure modules;
  - an empty schema barrel.

- [ ] **Step 1: Create the v2 branch and worktree**

Run in the v1 checkout:
```bash
git rev-parse --short v1-final            # expect b34fa03
git branch v2 v1-final
git worktree add ../great-ptw-loto-ai-app-v2 -b v2-phase-1a v2
docker compose stop                       # v1 stack; the 8 GB machine cannot run both
```
All later steps and tasks run in `../great-ptw-loto-ai-app-v2`.

Then:
```bash
cd ../great-ptw-loto-ai-app-v2
cp .env.example .env
printf '\n# Own Compose project: v2 volumes never touch the v1 stack.\nCOMPOSE_PROJECT_NAME=ptw-v2\n' >> .env
npm ci
```
Expected: `npm ci` completes. From Task 2 on, `docker compose ls --all` shows the project `ptw-v2` beside the stopped v1 project, and `docker volume ls` shows `ptw-v2_*` volumes next to the untouched v1 ones.

- [ ] **Step 2: Remove the v1 API modules and the v1 Keycloak admin client**

```bash
cd app/src/modules && git rm -r -q approval auth billing closure daily-progress dashboards execution \
  incident-closure incidents investigation isolation-execution logging lototo master-data notifications \
  organisation permit platform restoration revalidation simops workforce && cd -
git rm -r -q app/src/infrastructure/keycloak app/src/common/constants/tenant-roles.ts
```

- [ ] **Step 3: Remove the v1 database layer and add an empty schema barrel**

```bash
git rm -r -q app/src/database/schema app/src/database/migrations
git rm -q app/src/database/{seed.ts,seed-default-workflow.ts,seed-demo-workflows.ts,seed-ids.ts,seed-master-catalogue.ts,reset.ts,permit-reference.ts}
```

Create `app/src/database/schema/index.ts`:
```ts
// v2 schema (PRD §18). Each table file is added by the task that creates its migration.
export {};
```

- [ ] **Step 4: Remove the v1 specs**

```bash
grep -lP "app/src/(modules/(?!system/)|database/)" tests/*.ts | xargs git rm -q
grep -rlE "integration-auth|role-guard-mock" tests/*.ts || git rm -q tests/helpers/integration-auth.ts tests/helpers/role-guard-mock.ts
```
Expected: the 15 specs that do not import v1 code remain (`infra-hardening`, `mail.service`, `mobile-home`, `mobile-permit-form`, `ms-09-traceability`, `offline-replay`, `permit-conflict`, `permit-editor`, `permit-workspace`, `phone-validation`, `production-readiness-backend`, `roles-guard`, `s5-supporting-screens`, `security-hardening`, `setup-areas`).

- [ ] **Step 5: Reduce `app/src/app.module.ts` to the infrastructure modules**

Replace the file with:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SecurityHeadersInterceptor } from './common/interceptors/security-headers.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DatabaseModule } from './database/database.module';
import { RedisInfrastructureModule } from './infrastructure/redis';
import { StorageModule } from './infrastructure/storage/storage.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { MailModule } from './infrastructure/mail/mail.module';
import { SystemModule } from './modules/system/system.module';

// v2 is rebuilt module by module (PRD §19). Until Phase 1b brings sign-in back, only the public
// health routes answer; any other route fails closed because no authentication strategy is registered.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../.env', '../infrastructure/.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: true,
        customProps: () => ({ service: 'ptw-api' }),
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('rateLimit.ttlMs') ?? 60000,
          limit: config.get<number>('rateLimit.limit') ?? 100,
        },
      ],
    }),
    MailModule,
    DatabaseModule,
    RedisInfrastructureModule,
    StorageModule,
    QueueModule,
    SystemModule,
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SecurityHeadersInterceptor },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Delete common files that nothing imports any more**

Run:
```bash
for f in $(find app/src/common -name '*.ts'); do
  b=$(basename "$f" .ts); grep -rqE "/$b'" app/src tests --include=*.ts || echo "$f"
done
```
Delete each printed file with `git rm`, except files under `guards/`, `filters/`, `interceptors/` and `decorators/` that `app.module.ts` or `system.controller.ts` uses. Expected candidates: `helpers/tenant-context.ts`, `helpers/require-actor-id.ts`, `helpers/optional-uuid.ts`. Re-run the loop until it prints only kept files.

- [ ] **Step 7: Remove the v1 database scripts**

- In `app/package.json`, delete the `"db:reset"` and `"db:seed"` script lines.
- In the root `package.json`, delete the `"db:reset"` and `"db:seed"` script lines.

`db:migrate` stays; Phase 1b adds a new `db:seed`.

- [ ] **Step 8: Build and lint**

Run: `npm run build -w api && npm run lint -w api`
Expected: both pass. A missing import means a file still refers to v1 code: delete or fix that reference and run again.

- [ ] **Step 9: Run the remaining specs**

Run: `SKIP_DB_TESTS=1 npm run test -w api`
Expected: every remaining spec passes. A spec that fails only because it asserts a deleted v1 file (for example a migration name) is deleted with `git rm`, and its name goes in the commit message. Fix any other failure before going on.

- [ ] **Step 10: Commit (only when authorised)**

```bash
git add -A app/src tests app/package.json package.json
git status --short   # .env must not be listed; it is gitignored
git commit -m "v2: clear the v1 data layer (D4 reset); v1 stays at tag v1-final

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Database roles, runtime credential guard and the Keycloak database

**Files:**
- Create: `infrastructure/postgres/init/01-roles.sh`, `infrastructure/postgres/.env.example`
- Create: `app/src/database/runtime-guard.ts`
- Create: `app/src/database/migrations/meta/_journal.json`
- Create: `tests/helpers/global-setup.ts`, `tests/database-roles.spec.ts`
- Modify:
  - Compose files: `docker-compose.yml`, `docker-compose.app.yml`, `docker-compose.caddy.yml`, and your local `docker-compose.override.yml` (not committed).
  - Configuration: `.env.example`, `app/drizzle.config.ts`, `app/jest.config.js`.
  - API: `app/src/database/migrate.ts`, `app/src/database/database.module.ts`, `app/src/config/configuration.ts`, `app/src/config/validate-env.ts`.
  - Tests: `tests/helpers/db.ts`.
- Delete: `tests/helpers/require-database.js`

**Interfaces:**
- Consumes: the worktree from Task 1.
- Produces:
  - **Database roles:**
    - `ptw_owner`: LOGIN and BYPASSRLS; owns the schema; used only by migrations, seeds and test fixtures.
    - `ptw_api`: LOGIN, NOSUPERUSER, NOBYPASSRLS.
    - `keycloak`: owns the database `keycloak`.
  - **Runtime guard:** `assertRuntimeDatabaseRole(pool: Pool, env?: NodeJS.ProcessEnv): Promise<void>`. `DatabaseModule.onModuleInit` calls it.
  - **Environment:** `DATABASE_URL` is the API role, with no default in code. `MIGRATION_DATABASE_URL` is set only for the migration command or job; it has no default in `app/src`, and only the tests keep a local default.
  - **Tests:** `tests/helpers/db.ts` exports `apiDatabaseUrl`, `ownerDatabaseUrl` and `migrationsFolder`, and a Jest global setup migrates once, as the owner role.

- [ ] **Step 1: Write the failing test**

Create `tests/database-roles.spec.ts`:
```ts
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { assertRuntimeDatabaseRole } from '../app/src/database/runtime-guard';
import { apiDatabaseUrl, ownerDatabaseUrl } from './helpers/db';

const repoRoot = join(__dirname, '..');

describe('Database roles (NFR-SEC-001a)', () => {
  const api = new Pool({ connectionString: apiDatabaseUrl });
  const owner = new Pool({ connectionString: ownerDatabaseUrl });

  afterAll(async () => {
    await api.end();
    await owner.end();
  });

  it('connects the API as a role that is not a superuser and cannot bypass RLS', async () => {
    const { rows } = await api.query(
      `select current_user as name, rolsuper as super, rolbypassrls as bypass,
              rolcreaterole as createrole, rolcreatedb as createdb
         from pg_roles where rolname = current_user`,
    );
    expect(rows[0]).toEqual({ name: 'ptw_api', super: false, bypass: false, createrole: false, createdb: false });
  });

  it('does not let the API role create tables', async () => {
    await expect(api.query('create table api_must_not_create (id int)')).rejects.toMatchObject({ code: '42501' });
  });

  it('runs migrations as a separate owner role that is not a superuser', async () => {
    const { rows } = await owner.query(
      `select current_user as name, rolsuper as super from pg_roles where rolname = current_user`,
    );
    expect(rows[0]).toEqual({ name: 'ptw_owner', super: false });
  });

  it('gives Keycloak its own database, which the API role cannot open', async () => {
    const { rows } = await api.query(
      `select pg_get_userbyid(datdba) as owner from pg_database where datname = 'keycloak'`,
    );
    expect(rows).toEqual([{ owner: 'keycloak' }]);
    const keycloakDb = new Pool({ connectionString: apiDatabaseUrl.replace(/\/ptw_platform$/, '/keycloak') });
    await expect(keycloakDb.query('select 1')).rejects.toMatchObject({ code: '42501' });
    await keycloakDb.end();
  });

  it('refuses to start the API with an owner credential or with a role that can bypass RLS', async () => {
    await expect(assertRuntimeDatabaseRole(api, {})).resolves.toBeUndefined();
    await expect(assertRuntimeDatabaseRole(api, { MIGRATION_DATABASE_URL: ownerDatabaseUrl })).rejects.toThrow('MIGRATION_DATABASE_URL');
    await expect(assertRuntimeDatabaseRole(api, { PTW_OWNER_PASSWORD: 'x' })).rejects.toThrow('PTW_OWNER_PASSWORD');
    await expect(assertRuntimeDatabaseRole(owner, {})).rejects.toThrow('bypass RLS');
  });

  it('compiles no database credential into API code, so none ships in the API image', () => {
    const credential = /postgres(ql)?:\/\/[^:@/\s'"`]+:[^@\s'"`]+@/;
    const found: string[] = [];
    const scan = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) scan(path);
        else if (credential.test(readFileSync(path, 'utf8'))) found.push(path.slice(repoRoot.length + 1));
      }
    };
    scan(join(repoRoot, 'app/src'));
    expect(found).toEqual([]);
  });

  it('keeps owner credentials out of every compose file', () => {
    const files = readdirSync(repoRoot).filter((name) => /^docker-compose.*\.ya?ml$/.test(name));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(join(repoRoot, file), 'utf8');
      for (const secret of ['MIGRATION_DATABASE_URL', 'PTW_OWNER_PASSWORD', 'ptw_owner']) {
        expect({ file, secret, present: text.includes(secret) }).toEqual({ file, secret, present: false });
      }
    }
  });
});
```

Replace `tests/helpers/db.ts` with:
```ts
import { existsSync } from 'fs';
import { join } from 'path';

/** The API role (NOSUPERUSER, NOBYPASSRLS). */
export const apiDatabaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://ptw_api:ptw_api_dev_password@localhost:5432/ptw_platform';

/** The migration owner role (BYPASSRLS). Tests use it for migrations and fixtures only. */
export const ownerDatabaseUrl =
  process.env.MIGRATION_DATABASE_URL ??
  'postgresql://ptw_owner:ptw_owner_dev_password@localhost:5432/ptw_platform';

export const migrationsFolder = join(__dirname, '../../app/src/database/migrations');

if (!existsSync(migrationsFolder)) {
  throw new Error(`Migrations folder not found: ${migrationsFolder}`);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Do not start Postgres yet. The role script runs only on an empty volume.

Run: `npm run test -w api -- tests/database-roles`
Expected: FAIL. TypeScript reports that `../app/src/database/runtime-guard` cannot be found.

- [ ] **Step 3: Create the roles, keep owner credentials out of the API, add the guard**

Create `infrastructure/postgres/init/01-roles.sh`, then run `chmod +x infrastructure/postgres/init/01-roles.sh`:
```bash
#!/bin/bash
# Runs once, on an empty data volume, as the bootstrap superuser (postgres image entrypoint).
# NFR-SEC-001a: migrations own the schema; the API connects as a role that owns nothing and cannot
# bypass row-level security; Keycloak has its own database and role.
set -euo pipefail
: "${PTW_OWNER_PASSWORD:?}" "${PTW_API_PASSWORD:?}" "${KEYCLOAK_DB_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_pw="$PTW_OWNER_PASSWORD" -v api_pw="$PTW_API_PASSWORD" -v kc_pw="$KEYCLOAK_DB_PASSWORD" <<'SQL'
CREATE ROLE ptw_owner LOGIN NOSUPERUSER BYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD :'owner_pw';
CREATE ROLE ptw_api LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD :'api_pw';
CREATE ROLE keycloak LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD :'kc_pw';
CREATE DATABASE ptw_platform OWNER ptw_owner;
CREATE DATABASE keycloak OWNER keycloak;
REVOKE CONNECT, TEMPORARY ON DATABASE ptw_platform FROM PUBLIC;
REVOKE CONNECT, TEMPORARY ON DATABASE keycloak FROM PUBLIC;
GRANT CONNECT ON DATABASE ptw_platform TO ptw_api;
\connect ptw_platform
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SQL
```

Create `infrastructure/postgres/.env.example`. Then copy it to `infrastructure/postgres/.env`, which is gitignored by the existing `.env` rule:
```bash
# Role passwords for infrastructure/postgres/init/01-roles.sh. Only the postgres service reads this file;
# the API never sees the owner password (NFR-SEC-001a). Dev values only; real ones live on the server.
PTW_OWNER_PASSWORD=ptw_owner_dev_password
PTW_API_PASSWORD=ptw_api_dev_password
KEYCLOAK_DB_PASSWORD=keycloak_dev_password
```

In `docker-compose.yml`, update three services:
- **postgres:**
  - Set `POSTGRES_DB: postgres`, so the image does not create `ptw_platform` itself.
  - Add `env_file: [./infrastructure/postgres/.env]`.
  - Add the volume `- ./infrastructure/postgres/init:/docker-entrypoint-initdb.d:ro`.
  - Change the healthcheck to `pg_isready -U ptw -d postgres`.
- **keycloak:**
  - `KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak`
  - `KC_DB_USERNAME: keycloak`
  - `KC_DB_PASSWORD: ${KEYCLOAK_DB_PASSWORD:-keycloak_dev_password}`
- **api:** set `DATABASE_URL: postgresql://ptw_api:${PTW_API_PASSWORD:-ptw_api_dev_password}@postgres:5432/ptw_platform`. Add nothing else for migrations.

Remove Metabase (NFR-SEC-001a):
- Delete the `metabase:` service from `docker-compose.yml` and its port override from `docker-compose.caddy.yml`.
- Delete the `metabase:` block and its comment from your local `docker-compose.override.yml`. That file is not committed, but compose fails if it names a service that no longer exists.

In `docker-compose.app.yml`, set `DATABASE_URL` exactly as for `api` above.

In `.env.example`, replace the `DATABASE_URL` line with the block below, and copy the same lines into your worktree `.env`:
```bash
# API role: owns nothing, cannot bypass row-level security (NFR-SEC-001a).
DATABASE_URL=postgresql://ptw_api:ptw_api_dev_password@localhost:5432/ptw_platform
PTW_API_PASSWORD=ptw_api_dev_password
KEYCLOAK_DB_PASSWORD=keycloak_dev_password
# MIGRATION_DATABASE_URL is never set here: the API refuses to start if it can see it. Set it for the one command:
#   MIGRATION_DATABASE_URL="postgresql://ptw_owner:$(sed -n 's/^PTW_OWNER_PASSWORD=//p' infrastructure/postgres/.env)@localhost:5432/ptw_platform" npm run db:migrate
```

In `app/src/config/configuration.ts`, replace the `database.url` default with `url: process.env.DATABASE_URL,`. `validate-env` already requires the variable, so no credential default ships in code. In `app/src/config/validate-env.ts`, change the `DATABASE_URL` insecure pattern to `/_dev_password|CHANGE_ME/i`, so the v2 local passwords (`ptw_api_dev_password` and the others) are refused in production too.

Update `app/src/database/migrate.ts`, which now runs as the owner and needs no schema import:
```ts
import { join } from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const migrationsFolder = join(__dirname, 'migrations');

async function runMigrations(): Promise<void> {
  // Runs as the owner role, in its own process. No default: this file ships in the API image, and the running
  // API must never hold an owner credential (NFR-SEC-001a).
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error('Set MIGRATION_DATABASE_URL (the owner role) for this command only');
  const pool = new Pool({ connectionString });
  console.log('Running database migrations...');
  await migrate(drizzle(pool), { migrationsFolder });
  console.log('Migrations completed.');
  await pool.end();
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
```

In `app/drizzle.config.ts`, set `url: process.env.MIGRATION_DATABASE_URL as string` and remove the fallback URL.

Create `app/src/database/runtime-guard.ts`:
```ts
import type { Pool } from 'pg';

/**
 * NFR-SEC-001a: the running API holds only its own database role, which owns nothing and cannot bypass RLS.
 * It refuses to start if it can see an owner credential or if its role is unsafe.
 */
export async function assertRuntimeDatabaseRole(pool: Pool, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  for (const name of ['MIGRATION_DATABASE_URL', 'PTW_OWNER_PASSWORD']) {
    if (env[name]) throw new Error(`${name} must not be set for the API; migrations run as a separate job (NFR-SEC-001a)`);
  }
  const { rows } = await pool.query<{ unsafe: boolean }>(`
    select r.rolsuper or r.rolbypassrls
           or exists (select 1 from pg_class c where c.relowner = r.oid and c.relnamespace = 'public'::regnamespace) as unsafe
      from pg_roles r where r.rolname = current_user`);
  if (rows[0]?.unsafe !== false) {
    throw new Error('The API database role must not be a superuser, bypass RLS or own tables (NFR-SEC-001a)');
  }
}
```

In `app/src/database/database.module.ts`, make `DatabaseModule` also implement `OnModuleInit` (import it from `@nestjs/common`), and add:
```ts
  async onModuleInit(): Promise<void> {
    await assertRuntimeDatabaseRole(this.pool);
  }
```
Add `import { assertRuntimeDatabaseRole } from './runtime-guard';` at the top of the file.

Create `app/src/database/migrations/meta/_journal.json`:
```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": []
}
```

Create `tests/helpers/global-setup.ts` (Jest transforms global setup files with ts-jest):
```ts
import { Client, Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { apiDatabaseUrl, migrationsFolder, ownerDatabaseUrl } from './db';

// Database specs need both roles. A run that cannot reach them fails, instead of passing with them skipped.
export default async function globalSetup(): Promise<void> {
  if (process.env.SKIP_DB_TESTS === '1') return;
  for (const url of [ownerDatabaseUrl, apiDatabaseUrl]) {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      await client.query('select 1');
    } catch (error) {
      const { code, message } = error as { code?: string; message: string };
      throw new Error(
        `Database tests need PostgreSQL at ${url.replace(/:[^:@/]+@/, ':***@')} (${code ?? message}). ` +
          'Start it, set DATABASE_URL and MIGRATION_DATABASE_URL, or set SKIP_DB_TESTS=1.',
      );
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  // Migrate once, as the owner role, before any spec runs.
  const pool = new Pool({ connectionString: ownerDatabaseUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}
```

In `app/jest.config.js`, set `globalSetup: '<rootDir>/../tests/helpers/global-setup.ts',` and delete the comment line above it. Then run `git rm tests/helpers/require-database.js`.

- [ ] **Step 4: Start the v2 database and run the tests**

Run, in the worktree (Compose project `ptw-v2`):
```bash
cp infrastructure/postgres/.env.example infrastructure/postgres/.env
docker compose up -d postgres keycloak
docker compose logs postgres | grep -i "01-roles.sh"
npm run test -w api
```
Expected:
- The log shows `running /docker-entrypoint-initdb.d/01-roles.sh`.
- `database-roles` passes with 7 tests, and every kept spec passes.
- Keycloak starts on its own database: `docker compose logs keycloak | tail -5` shows no database error.

If Postgres was started before the init script was mounted, its `ptw-v2` volume is not empty and the script will not run. In that case run `docker compose down -v` first; in this worktree that removes only `ptw-v2` volumes.

Some kept specs (for example `infra-hardening` or `security-hardening`) may assert v1 infrastructure, such as a `ptw` superuser URL or a Metabase service. Update those assertions to the v2 values; do not delete the hardening they test.

- [ ] **Step 5: Commit (only when authorised)**

```bash
git add infrastructure/postgres/init infrastructure/postgres/.env.example docker-compose.yml docker-compose.app.yml \
  docker-compose.caddy.yml .env.example app/src/database/migrate.ts app/src/database/runtime-guard.ts app/src/config \
  app/src/database/database.module.ts app/drizzle.config.ts app/src/database/migrations/meta/_journal.json \
  app/jest.config.js tests/helpers/db.ts tests/helpers/global-setup.ts tests/database-roles.spec.ts
git status --short   # require-database.js staged as deleted; infrastructure/postgres/.env must not appear
git commit -m "v2: owner, API and Keycloak roles; owner credentials kept out of the API, which checks on start (NFR-SEC-001a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Request context, context validity and the organisations table

**Files:**
- Create: `app/src/database/context.ts`
- Create: `app/src/database/schema/columns.ts`, `app/src/database/schema/tenancy.ts`
- Create: `app/src/database/migrations/0000_context.sql`
- Create: `tests/helpers/fixtures.ts`, `tests/database-context.spec.ts`
- Modify:
  - Database: `app/src/database/database.module.ts`, `app/src/database/schema/index.ts`, `_journal.json`.
  - API: `app/src/modules/system/system.service.ts`, `app/eslint.config.mjs`.
  - Tests: `tests/helpers/db.ts`.

**Interfaces:**
- Consumes: the roles and guard from Task 2.
- Produces in `app/src/database/context.ts`:
  - `type Database = NodePgDatabase<typeof schema>`
  - `type Tx` (a Drizzle transaction)
  - `type ActingRole = 'user' | 'platform_admin' | 'job'`
  - `interface DbContext { tenantId: string | null; personId: string | null; legalEntityIds: readonly string[]; actingRole: ActingRole }`
  - `UUID_PATTERN: RegExp`
  - `runInContext<T>(db: Database, ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T>`
  - `jobContext(tenantId: string): DbContext`
- Produces `ContextDb` (in `database.module.ts`), an injectable with:
  - `run<T>(ctx, fn)`
  - `ping(): Promise<void>`

  It is the module's only export: neither the raw connection nor the pool is exported.
- Produces in SQL:
  - `app_tenant_id()`, `app_person_id()`, `app_legal_entity_ids()`, `app_acting_role()`
  - `app_context_complete()`: every setting present, with `none` for an explicitly empty value
  - `app_context_valid()`: complete and of the right shape for the acting role; Tasks 6 and 7 replace it
  - the migration helper `app_apply_tenant_policy(regclass)`
  - the table `organisations`
- Produces in the tests:
  - In `tests/helpers/db.ts`:
    - `connectApi(max?) → { pool, db }` and `connectOwner() → Pool`
    - `userCtx(tenantId, personId, legalEntityIds)`, `platformCtx`, `noTenantJobCtx`
    - `pgCode(error)` and `pgErrorCode(promise)`
  - In `tests/helpers/fixtures.ts`:
    - `short()` and `insertOrganisation(owner, kind?) → id`
    - `TenantGraph { tenantId; kind; personId; legalEntityId }`
    - `createTenantGraph(owner, kind?)` and `ctxOf(graph)`

- [ ] **Step 1: Write the failing test**

Append to `tests/helpers/db.ts`, and move the new `import` lines to the top of the file:
```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../app/src/database/schema';
import type { Database, DbContext } from '../../app/src/database/context';

/** The API role. Specs query through runInContext, exactly as the API does. */
export function connectApi(max = 4): { pool: Pool; db: Database } {
  const pool = new Pool({ connectionString: apiDatabaseUrl, max });
  return { pool, db: drizzle(pool, { schema }) };
}

/** The owner role (BYPASSRLS), for migrations and fixtures only. */
export function connectOwner(): Pool {
  return new Pool({ connectionString: ownerDatabaseUrl });
}

export const userCtx = (tenantId: string, personId: string, legalEntityIds: string[]): DbContext => ({
  tenantId,
  personId,
  legalEntityIds,
  actingRole: 'user',
});
export const platformCtx: DbContext = { tenantId: null, personId: null, legalEntityIds: [], actingRole: 'platform_admin' };
export const noTenantJobCtx: DbContext = { tenantId: null, personId: null, legalEntityIds: [], actingRole: 'job' };

/** SQLSTATE of a pg error, whether or not Drizzle wrapped it. */
export function pgCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

export async function pgErrorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return pgCode(error) ?? String(error);
  }
}
```

Create `tests/helpers/fixtures.ts`:
```ts
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import type { DbContext } from '../../app/src/database/context';
import { userCtx } from './db';

export const short = (): string => randomUUID().slice(0, 8);

export async function insertOrganisation(owner: Pool, kind: 'organisation' | 'agency' = 'organisation'): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into organisations (kind, slug, name) values ($1, $2, $3) returning id`,
    [kind, `t-${short()}`, `Test ${kind} ${short()}`],
  );
  return rows[0].id;
}

export interface TenantGraph {
  tenantId: string;
  kind: 'organisation' | 'agency';
  /** An active person with an account. Random until Task 7 creates person records. */
  personId: string;
  /** The person's employer legal entity. Random until Task 6 creates legal entities. */
  legalEntityId: string;
}

/** One row in every tenant table, so the isolation suite can test each table. Each new table adds its row here. */
export async function createTenantGraph(owner: Pool, kind: 'organisation' | 'agency' = 'organisation'): Promise<TenantGraph> {
  const tenantId = await insertOrganisation(owner, kind);
  return { tenantId, kind, personId: randomUUID(), legalEntityId: randomUUID() };
}

/** A valid user context for the graph's person. */
export const ctxOf = (g: TenantGraph): DbContext => userCtx(g.tenantId, g.personId, [g.legalEntityId]);
```

Create `tests/database-context.spec.ts`:
```ts
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { runInContext } from '../app/src/database/context';
import { connectApi, connectOwner, pgErrorCode, platformCtx } from './helpers/db';
import { createTenantGraph, ctxOf, TenantGraph } from './helpers/fixtures';

describe('Request context (NFR-SEC-008)', () => {
  const owner = connectOwner();
  const api = connectApi(1); // one connection: every transaction below reuses it
  let a: TenantGraph;
  let b: TenantGraph;

  const visibleOrganisations = async () =>
    (await api.pool.query<{ n: number }>('select count(*)::int as n from organisations')).rows[0].n;

  beforeAll(async () => {
    a = await createTenantGraph(owner);
    b = await createTenantGraph(owner);
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('sets the context for the transaction only', async () => {
    const inside = await runInContext(api.db, ctxOf(a), async (tx) =>
      (await tx.execute(sql`select current_setting('app.tenant_id', true) as tenant`)).rows[0],
    );
    expect(inside).toEqual({ tenant: a.tenantId });
    const after = await api.pool.query(`select current_setting('app.tenant_id', true) as tenant`);
    expect(after.rows[0].tenant ?? '').toBe('');
  });

  it('shows a tenant only its own organisation', async () => {
    const ids = await runInContext(api.db, ctxOf(a), async (tx) =>
      (await tx.execute<{ id: string }>(sql`select id from organisations`)).rows.map((r) => r.id),
    );
    expect(ids).toEqual([a.tenantId]);
  });

  it('shows nothing without a context, including after a transaction that failed', async () => {
    expect(await visibleOrganisations()).toBe(0);
    await expect(
      runInContext(api.db, ctxOf(a), async () => {
        throw new Error('request failed halfway');
      }),
    ).rejects.toThrow('request failed halfway');
    expect(await visibleOrganisations()).toBe(0);
  });

  it('lets only a platform admin list and create organisations', async () => {
    const seen = await runInContext(api.db, platformCtx, async (tx) =>
      (await tx.execute<{ n: number }>(sql`select count(*)::int as n from organisations where id in (${a.tenantId}, ${b.tenantId})`)).rows[0].n,
    );
    expect(seen).toBe(2);
    const create = (ctx: typeof platformCtx) =>
      runInContext(api.db, ctx, (tx) =>
        tx.execute(sql`insert into organisations (kind, slug, name) values ('organisation', ${`p-${randomUUID().slice(0, 8)}`}, 'Created')`),
      );
    expect(await pgErrorCode(create(ctxOf(a)))).toBe('42501');
    expect(await pgErrorCode(create(platformCtx))).toBeUndefined();
  });

  it('rejects context values that are not UUIDs, and user contexts missing a tenant, person or legal entity', async () => {
    const user = (over: Partial<ReturnType<typeof ctxOf>>) => ({ ...ctxOf(a), ...over });
    await expect(runInContext(api.db, user({ tenantId: "x' or true --" }), async () => 1)).rejects.toThrow('UUIDs');
    await expect(runInContext(api.db, user({ tenantId: null }), async () => 1)).rejects.toThrow('tenant, a person and a legal entity');
    await expect(runInContext(api.db, user({ personId: null }), async () => 1)).rejects.toThrow('tenant, a person and a legal entity');
    await expect(runInContext(api.db, user({ legalEntityIds: [] }), async () => 1)).rejects.toThrow('tenant, a person and a legal entity');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w api -- tests/database-context`
Expected: FAIL. TypeScript reports that `../app/src/database/context` cannot be found.

- [ ] **Step 3: Implement the context, the migration and the schema**

Create `app/src/database/context.ts`:
```ts
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export type ActingRole = 'user' | 'platform_admin' | 'job';

/** The request or job context every query runs under (NFR-SEC-008). The database checks it again (app_context_valid). */
export interface DbContext {
  tenantId: string | null;
  personId: string | null;
  legalEntityIds: readonly string[];
  actingRole: ActingRole;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidContext(ctx: DbContext): void {
  const ids = [ctx.tenantId, ctx.personId, ...ctx.legalEntityIds].filter((id): id is string => id !== null);
  if (!ids.every((id) => UUID_PATTERN.test(id))) throw new Error('Database context IDs must be UUIDs');
  if (ctx.actingRole === 'user' && (!ctx.tenantId || !ctx.personId || ctx.legalEntityIds.length === 0)) {
    throw new Error('A user context needs a tenant, a person and a legal entity');
  }
  if (ctx.actingRole === 'platform_admin' && ctx.tenantId) throw new Error('A platform admin context has no tenant');
}

/** An explicitly empty setting. An unset or '' setting means "missing", and a context with a missing setting is no context. */
const NONE = 'none';

/**
 * Runs fn in a transaction whose first statement sets all four settings with set_config(..., true). The
 * settings end with the transaction, so a pooled connection never carries them into the next request.
 * RLS policies read them; an incomplete or inconsistent context matches no rows.
 */
export async function runInContext<T>(db: Database, ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  assertValidContext(ctx);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select
      set_config('app.tenant_id', ${ctx.tenantId ?? NONE}, true),
      set_config('app.person_id', ${ctx.personId ?? NONE}, true),
      set_config('app.legal_entity_ids', ${ctx.legalEntityIds.length ? ctx.legalEntityIds.join(',') : NONE}, true),
      set_config('app.acting_role', ${ctx.actingRole}, true)`);
    return fn(tx);
  });
}

export const jobContext = (tenantId: string): DbContext => ({
  tenantId,
  personId: null,
  legalEntityIds: [],
  actingRole: 'job',
});
```

Replace `app/src/database/database.module.ts` with:
```ts
import { Global, Inject, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { Database, DbContext, Tx, runInContext } from './context';
import { assertRuntimeDatabaseRole } from './runtime-guard';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';
export const DATABASE_POOL = 'DATABASE_POOL';

/** The only way feature code reaches the database: every call is a context transaction (NFR-SEC-008). */
@Injectable()
export class ContextDb {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  run<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return runInContext(this.db, ctx, fn);
  }

  /** Health check only: a round trip that reads no table. */
  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool =>
        new Pool({
          connectionString: configService.get<string>('database.url'),
          max: configService.get<number>('database.poolMax') ?? 20,
          idleTimeoutMillis: configService.get<number>('database.poolIdleTimeoutMs') ?? 30000,
          connectionTimeoutMillis: configService.get<number>('database.poolConnectionTimeoutMs') ?? 5000,
        }),
    },
    {
      provide: DATABASE_CONNECTION,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
    ContextDb,
  ],
  // Neither the raw connection nor the pool is exported: feature code cannot query outside a context.
  exports: [ContextDb],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await assertRuntimeDatabaseRole(this.pool);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
```

In `app/src/modules/system/system.service.ts`:
- Replace the constructor parameter `@Inject(DATABASE_POOL) private readonly pool: Pool,` with `private readonly db: ContextDb,`.
- Replace `await this.pool.query('SELECT 1');` with `await this.db.ping();`.
- Change the database import to `import { ContextDb } from '../../database/database.module';`, and remove the `Pool` import if nothing else uses it.

Create `app/src/database/migrations/0000_context.sql`:
```sql
-- v2 foundation (PRD §16, §18). Runs as ptw_owner. The API connects as ptw_api, which owns nothing
-- and reaches rows only through the policies below (NFR-SEC-001a).

-- Context readers (NFR-SEC-008). runInContext always sets all four settings; 'none' is an explicitly empty
-- value. An unset or '' setting is missing, which app_context_complete() rejects.
CREATE FUNCTION app_tenant_id() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(nullif(current_setting('app.tenant_id', true), ''), 'none')::uuid $$;
CREATE FUNCTION app_person_id() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(nullif(current_setting('app.person_id', true), ''), 'none')::uuid $$;
CREATE FUNCTION app_legal_entity_ids() RETURNS uuid[] LANGUAGE sql STABLE
  AS $$ SELECT coalesce(string_to_array(nullif(nullif(current_setting('app.legal_entity_ids', true), ''), 'none'), ',')::uuid[], '{}'::uuid[]) $$;
CREATE FUNCTION app_acting_role() RETURNS text LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.acting_role', true), '') $$;

-- Every setting is present (a value or 'none'). A missing setting makes any context, user, job or platform, no context.
CREATE FUNCTION app_context_complete() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.tenant_id', true), '') <> ''
     AND coalesce(current_setting('app.person_id', true), '') <> ''
     AND coalesce(current_setting('app.legal_entity_ids', true), '') <> ''
     AND coalesce(current_setting('app.acting_role', true), '') <> ''
$$;

-- Whether the transaction's context is complete and fits its acting role. Every policy requires it, so a partial
-- context is no context (NFR-SEC-008). This first version checks shape; 0001 and 0002 replace it to also
-- check that the legal entities and the person belong to the tenant.
CREATE FUNCTION app_context_valid() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app_context_complete() AND CASE app_acting_role()
    WHEN 'user' THEN app_tenant_id() IS NOT NULL AND app_person_id() IS NOT NULL AND cardinality(app_legal_entity_ids()) > 0
    WHEN 'job' THEN app_tenant_id() IS NOT NULL AND app_person_id() IS NULL
    WHEN 'platform_admin' THEN app_tenant_id() IS NULL AND app_person_id() IS NULL AND cardinality(app_legal_entity_ids()) = 0
    ELSE false
  END
$$;

-- Migration helper: ENABLE and FORCE RLS plus the standard tenant policy, for a table with tenant_id.
-- (SELECT app_context_valid()) is evaluated once per query, not per row.
CREATE FUNCTION app_apply_tenant_policy(tbl regclass) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s USING (tenant_id = app_tenant_id() AND (SELECT app_context_valid())) '
    'WITH CHECK (tenant_id = app_tenant_id() AND (SELECT app_context_valid()))', tbl);
END $$;
REVOKE EXECUTE ON FUNCTION app_apply_tenant_policy(regclass) FROM PUBLIC;

-- The API role gets row privileges on every table the owner creates; policies decide which rows.
GRANT USAGE ON SCHEMA public TO ptw_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ptw_api;

CREATE TABLE organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('organisation', 'agency')),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  name text NOT NULL,
  industry text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trial', 'active', 'read_only', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations FORCE ROW LEVEL SECURITY;
-- A tenant sees its own row. The platform admin sees every tenant's row (names, status, plans) and creates tenants.
CREATE POLICY organisation_read ON organisations FOR SELECT
  USING ((SELECT app_context_valid()) AND (id = app_tenant_id() OR app_acting_role() = 'platform_admin'));
CREATE POLICY organisation_create ON organisations FOR INSERT
  WITH CHECK ((SELECT app_context_valid()) AND app_acting_role() = 'platform_admin');
CREATE POLICY organisation_update ON organisations FOR UPDATE
  USING ((SELECT app_context_valid()) AND (id = app_tenant_id() OR app_acting_role() = 'platform_admin'))
  WITH CHECK ((SELECT app_context_valid()) AND (id = app_tenant_id() OR app_acting_role() = 'platform_admin'));
```

Replace `entries` in `app/src/database/migrations/meta/_journal.json` with:
```json
  "entries": [
    { "idx": 0, "version": "7", "when": 1791072000000, "tag": "0000_context", "breakpoints": true }
  ]
```

Create `app/src/database/schema/columns.ts`:
```ts
import { timestamp } from 'drizzle-orm/pg-core';

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
```

Create `app/src/database/schema/tenancy.ts`:
```ts
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';

// SQL in migrations/ is the source of truth (policies, grants, composite keys); these definitions type queries.
export const organisations = pgTable('organisations', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['organisation', 'agency'] }).notNull(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  industry: text('industry'),
  status: text('status', { enum: ['trial', 'active', 'read_only', 'suspended'] }).notNull().default('active'),
  ...timestamps,
});
```

Replace `app/src/database/schema/index.ts` with:
```ts
export * from './tenancy';
```

- [ ] **Step 4: Add the lint rule against setting the context anywhere else**

In `app/eslint.config.mjs`, add these two constants above `export default`:
```js
// NFR-SEC-008: only runInContext may set app.* settings, and only transaction-locally.
const contextSelectors = [
  { selector: 'TemplateElement[value.raw=/set_config|\\bset\\s+(session\\s+|local\\s+)?app\\./i]', message: 'Only runInContext (src/database/context.ts) may set app.* settings (NFR-SEC-008).' },
  { selector: 'Literal[value=/set_config|\\bset\\s+(session\\s+|local\\s+)?app\\./i]', message: 'Only runInContext (src/database/context.ts) may set app.* settings (NFR-SEC-008).' },
];
```
Then add this object as the last argument of `tseslint.config(...)`:
```js
  {
    files: ['src/**/*.ts'],
    ignores: ['src/database/context.ts'],
    rules: { 'no-restricted-syntax': ['error', ...contextSelectors] },
  },
```

Check that the rule fires:
```bash
printf "import { sql } from 'drizzle-orm';\nexport const probe = sql\`SET app.tenant_id = 'x'\`;\n" > app/src/lint-probe.ts
(cd app && npx eslint src/lint-probe.ts); rm app/src/lint-probe.ts
```
Expected: one error, "Only runInContext (src/database/context.ts) may set app.* settings". If ESLint reports a selector parse error instead, use a regex without the `i` flag, `[sS][eE][tT]`, and check again.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -w api -- tests/database-context tests/database-roles && npm run lint -w api && npm run build -w api`
Expected: PASS, 11 tests. Lint and build pass.

- [ ] **Step 6: Commit (only when authorised)**

```bash
git add app/src/database app/src/modules/system/system.service.ts app/eslint.config.mjs \
  tests/helpers/db.ts tests/helpers/fixtures.ts tests/database-context.spec.ts
git commit -m "v2: transaction-local context checked by every policy; organisations; no raw pool export (NFR-SEC-008)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Schema security test

**Files:**
- Create: `tests/schema-security.spec.ts`

**Interfaces:**
- Consumes: `apiDatabaseUrl` (Task 2).
- Produces the CI schema test of NFR-SEC-001a. Later tasks extend two of its lists:
  - `APPEND_ONLY`, extended by Tasks 9, 10, 13 and 14;
  - `FULL_RECORD_COLUMNS`, extended by Task 7.

- [ ] **Step 1: Write the test**

Create `tests/schema-security.spec.ts`:
```ts
import { Pool } from 'pg';
import { apiDatabaseUrl } from './helpers/db';

/** Tables the API may only INSERT into and SELECT from (NFR-SEC-001a, FR-AUD-003). Later tasks add to it. */
const APPEND_ONLY: string[] = [];

/** Full-record-only columns the API role must not select directly (FR-PRV-005). Later tasks add to it. */
const FULL_RECORD_COLUMNS: [string, string][] = [];

// NFR-SEC-001a: "A CI schema test, run as the API role, fails if any application table lacks FORCE RLS
// or a policy, or if the API role is a superuser, has BYPASSRLS or owns a table."
describe('Schema security (NFR-SEC-001a)', () => {
  const pool = new Pool({ connectionString: apiDatabaseUrl });

  afterAll(() => pool.end());

  it('runs as the API role, which is neither a superuser nor able to bypass RLS', async () => {
    const { rows } = await pool.query(
      `select current_user as name, rolsuper as super, rolbypassrls as bypass from pg_roles where rolname = current_user`,
    );
    expect(rows[0]).toEqual({ name: 'ptw_api', super: false, bypass: false });
  });

  it('finds every application table owned by someone else, with ENABLE and FORCE RLS and a policy', async () => {
    const { rows } = await pool.query<{ table: string; owner: string; rls: boolean; forced: boolean; policies: number }>(`
      select c.relname as table, pg_get_userbyid(c.relowner) as owner,
             c.relrowsecurity as rls, c.relforcerowsecurity as forced,
             (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
       order by 1`);
    expect(rows.length).toBeGreaterThan(0);
    const problems = rows.filter((r) => r.owner === 'ptw_api' || !r.rls || !r.forced || r.policies === 0);
    expect(problems).toEqual([]);
  });

  it('gives the API only INSERT and SELECT on append-only tables', async () => {
    const problems: string[] = [];
    for (const table of APPEND_ONLY) {
      const { rows } = await pool.query(
        `select has_table_privilege(current_user, $1, 'INSERT') as ins, has_table_privilege(current_user, $1, 'SELECT') as sel,
                has_table_privilege(current_user, $1, 'UPDATE') as upd, has_table_privilege(current_user, $1, 'DELETE') as del,
                has_table_privilege(current_user, $1, 'TRUNCATE') as trunc`,
        [table],
      );
      const p = rows[0];
      if (!p.ins || !p.sel || p.upd || p.del || p.trunc) problems.push(`${table}: ${JSON.stringify(p)}`);
    }
    expect(problems).toEqual([]);
  });

  it('does not let the API select full-record-only columns directly', async () => {
    const problems: string[] = [];
    for (const [table, column] of FULL_RECORD_COLUMNS) {
      const { rows } = await pool.query(`select has_column_privilege(current_user, $1, $2, 'SELECT') as sel`, [table, column]);
      if (rows[0].sel) problems.push(`${table}.${column} is selectable`);
    }
    expect(problems).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm run test -w api -- tests/schema-security`
Expected: PASS, 4 tests. `organisations` is the only table, and it meets every rule.

To check that the test can fail, run as the owner:
```bash
docker compose exec -T postgres psql -U ptw_owner -d ptw_platform -c 'alter table organisations no force row level security'
npm run test -w api -- tests/schema-security
docker compose exec -T postgres psql -U ptw_owner -d ptw_platform -c 'alter table organisations force row level security'
```
Expected: the middle run FAILS, listing `organisations` with `forced: false`; after the last command the test passes again.

- [ ] **Step 3: Commit (only when authorised)**

```bash
git add tests/schema-security.spec.ts
git commit -m "v2: CI schema test run as the API role (NFR-SEC-001a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Isolation suite

The suite reads the table list from the catalogue and tries every check on every table. A new table therefore fails CI until it has a policy, a fixture row and a classification. It also sets incomplete contexts directly, bypassing `runInContext`'s checks, to prove that the database itself denies them.

**Files:**
- Create: `tests/isolation.spec.ts`

**Interfaces:**
- Consumes:
  - from Task 3: `runInContext`, `createTenantGraph` and `ctxOf`;
  - the database helpers: `connectApi`, `connectOwner`, `noTenantJobCtx`, `platformCtx`, `pgCode` and `pgErrorCode`.
- Produces three things that later tasks extend:
  - `ACCOUNT_SCOPED`, extended by Task 7;
  - `CROSS_TENANT`, extended by Task 12;
  - `incompleteContexts()`, extended by Tasks 6 and 7.

- [ ] **Step 1: Write the suite**

Create `tests/isolation.spec.ts`:
```ts
import { sql, SQL } from 'drizzle-orm';
import { DbContext, runInContext } from '../app/src/database/context';
import { Client, PoolClient } from 'pg';
import { apiDatabaseUrl, connectApi, connectOwner, noTenantJobCtx, pgCode, pgErrorCode, platformCtx } from './helpers/db';
import { createTenantGraph, ctxOf, TenantGraph } from './helpers/fixtures';

/**
 * Tables without a tenant_id column, and how each is scoped. A table that is neither tenant-keyed nor
 * listed here fails the suite, so every new table is classified on purpose (NFR-SEC-001).
 */
const ACCOUNT_SCOPED: string[] = [];
const CROSS_TENANT: Record<string, string[]> = {};

interface TenantTable {
  table: string;
  key: string;
}

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

describe('Tenant isolation suite (NFR-SEC-001, NFR-SEC-008, PRD §21 criterion 4)', () => {
  const owner = connectOwner();
  const api = connectApi();
  let a: TenantGraph; // the tenant whose rows everyone else tries to reach
  let b: TenantGraph; // an agency (Task 12 engages it with a)
  let x: TenantGraph; // an unrelated organisation
  const tables: TenantTable[] = [];
  const unclassified: string[] = [];

  beforeAll(async () => {
    a = await createTenantGraph(owner);
    b = await createTenantGraph(owner, 'agency');
    x = await createTenantGraph(owner);
    const { rows } = await owner.query<{ table: string; has_tenant_id: boolean }>(`
      select c.relname as table,
             exists (select 1 from pg_attribute t where t.attrelid = c.oid and t.attname = 'tenant_id' and not t.attisdropped) as has_tenant_id
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
       order by 1`);
    for (const r of rows) {
      if (r.table === 'organisations') tables.push({ table: r.table, key: 'id' });
      else if (r.has_tenant_id) tables.push({ table: r.table, key: 'tenant_id' });
      else if (!ACCOUNT_SCOPED.includes(r.table) && !(r.table in CROSS_TENANT)) unclassified.push(r.table);
    }
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  const count = (ctx: DbContext, t: TenantTable, tenantId: string) =>
    runInContext(api.db, ctx, async (tx) =>
      (await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from ${sql.identifier(t.table)} where ${sql.identifier(t.key)} = ${tenantId}`,
      )).rows[0].n,
    );

  /** "rows:N" or "code:SQLSTATE". */
  const attempt = async (ctx: DbContext, query: SQL): Promise<string> => {
    try {
      const result = await runInContext(api.db, ctx, (tx) => tx.execute(query));
      return `rows:${result.rowCount ?? 0}`;
    } catch (error) {
      return `code:${pgCode(error)}`;
    }
  };

  /** A copy of one of tenant a's rows, for insert attempts. */
  const rowOfA = async (t: TenantTable) =>
    (await owner.query(`select to_jsonb(r) as row from ${q(t.table)} r where ${q(t.key)} = $1 limit 1`, [a.tenantId])).rows[0].row;

  type Settings = Record<string, string>;

  /** Runs a query on this client as the API role with exactly these app.* settings, bypassing runInContext's checks. */
  const rawOn = async (client: PoolClient | Client, settings: Settings, query: string, params: unknown[]) => {
    try {
      await client.query('begin');
      for (const [name, value] of Object.entries(settings)) {
        await client.query('select set_config($1, $2, true)', [`app.${name}`, value]);
      }
      return await client.query(query, params);
    } finally {
      await client.query('rollback').catch(() => undefined);
    }
  };
  const withRawSettings = async (settings: Settings, query: string, params: unknown[]) => {
    const client = await api.pool.connect();
    try {
      return await rawOn(client, settings, query, params);
    } finally {
      client.release();
    }
  };

  /** Complete, valid contexts as runInContext would set them ('none' is an explicitly empty value). */
  const fullUser = (): Settings => ({ tenant_id: a.tenantId, person_id: a.personId, legal_entity_ids: a.legalEntityId, acting_role: 'user' });
  const fullJob = (): Settings => ({ tenant_id: a.tenantId, person_id: 'none', legal_entity_ids: 'none', acting_role: 'job' });
  const fullPlatform = (): Settings => ({ tenant_id: 'none', person_id: 'none', legal_entity_ids: 'none', acting_role: 'platform_admin' });
  const without = (settings: Settings, name: string): Settings => Object.fromEntries(Object.entries(settings).filter(([key]) => key !== name));

  /** Contexts that claim tenant a but are incomplete or inconsistent: the database must treat each as no context. Later tasks add cases. */
  const incompleteContexts = (): [string, Settings][] => [
    ...['tenant_id', 'person_id', 'legal_entity_ids', 'acting_role'].flatMap((name): [string, Settings][] => [
      [`user missing ${name}`, without(fullUser(), name)],
      [`job missing ${name}`, without(fullJob(), name)],
      [`platform admin missing ${name}`, without(fullPlatform(), name)],
    ]),
    ['job with only tenant and acting role', { tenant_id: a.tenantId, acting_role: 'job' }],
    ['platform admin with only acting role', { acting_role: 'platform_admin' }],
    ['user with person "none"', { ...fullUser(), person_id: 'none' }],
    ['user with legal entities "none"', { ...fullUser(), legal_entity_ids: 'none' }],
    ['job carrying a person', { ...fullJob(), person_id: a.personId }],
    ['platform admin carrying a tenant', { ...fullPlatform(), tenant_id: a.tenantId }],
    ['unknown acting role', { ...fullUser(), acting_role: 'admin' }],
  ];

  const outsiders = (): [string, DbContext][] => [
    ['agency b', ctxOf(b)],
    ['organisation x', ctxOf(x)],
    ['job without tenant', noTenantJobCtx],
  ];

  it('classifies every table', () => {
    expect(unclassified).toEqual([]);
  });

  it('gives every tenant table a fixture row that its own tenant can see', async () => {
    const problems: string[] = [];
    for (const t of tables) {
      if ((await count(ctxOf(a), t, a.tenantId)) < 1) {
        problems.push(`${t.table}: tenant a cannot see its own fixture row (extend createTenantGraph)`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('hides every tenant row from other tenants, jobs without a tenant and the platform admin', async () => {
    const problems: string[] = [];
    for (const t of tables) {
      const viewers = t.table === 'organisations' ? outsiders() : [...outsiders(), ['platform admin', platformCtx] as [string, DbContext]];
      for (const [who, ctx] of viewers) {
        const n = await count(ctx, t, a.tenantId);
        if (n !== 0) problems.push(`${t.table}: ${who} sees ${n} row(s) of tenant a`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('treats an incomplete or inconsistent context as no context, for reads and writes', async () => {
    const problems: string[] = [];
    for (const t of tables) {
      const row = await rowOfA(t);
      for (const [name, settings] of incompleteContexts()) {
        const { rows } = await withRawSettings(settings, `select count(*)::int as n from ${q(t.table)} where ${q(t.key)} = $1`, [a.tenantId]);
        if (rows[0].n !== 0) problems.push(`${t.table}: "${name}" reads ${rows[0].n} row(s)`);
        const code = await pgErrorCode(
          withRawSettings(settings, `insert into ${q(t.table)} select * from jsonb_populate_record(null::${q(t.table)}, $1::jsonb)`, [JSON.stringify(row)]),
        );
        if (code !== '42501') problems.push(`${t.table}: "${name}" insert gave ${code ?? 'no error'}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('still lets complete user, job and platform contexts read what they should', async () => {
    const problems: string[] = [];
    for (const t of tables) {
      const n = async (settings: Settings) =>
        (await withRawSettings(settings, `select count(*)::int as n from ${q(t.table)} where ${q(t.key)} = $1`, [a.tenantId])).rows[0].n;
      if ((await n(fullUser())) < 1) problems.push(`${t.table}: full user context reads nothing`);
      if ((await n(fullJob())) < 1) problems.push(`${t.table}: full job context reads nothing`);
      const platform = await n(fullPlatform());
      if (platform !== (t.table === 'organisations' ? 1 : 0)) problems.push(`${t.table}: full platform context reads ${platform}`);
    }
    expect(problems).toEqual([]);
  });

  it('denies the partial job and platform contexts on a fresh and on a reused connection', async () => {
    const partial: [string, Settings][] = [
      ['job with only tenant and acting role', { tenant_id: a.tenantId, acting_role: 'job' }],
      ['platform admin with only acting role', { acting_role: 'platform_admin' }],
    ];
    // Only tables that exist at this point: the catalogue list grows as later tasks add tables.
    const reads = tables.map((t) => `select count(*)::int as n from ${q(t.table)} where ${q(t.key)} = $1`);
    const reused = new Client({ connectionString: apiDatabaseUrl });
    await reused.connect();
    const problems: string[] = [];
    try {
      // A complete transaction first, so the settings exist on this connection (as '') afterwards.
      await rawOn(reused, fullUser(), 'select 1', []);
      for (const [name, settings] of partial) {
        for (const query of reads) {
          const fresh = new Client({ connectionString: apiDatabaseUrl });
          await fresh.connect();
          try {
            for (const [label, client] of [['fresh', fresh], ['reused', reused]] as [string, Client][]) {
              const { rows } = await rawOn(client, settings, query, [a.tenantId]);
              if (rows[0].n !== 0) problems.push(`"${name}" on a ${label} connection: ${query} gave ${rows[0].n}`);
            }
          } finally {
            await fresh.end();
          }
        }
      }
    } finally {
      await reused.end();
    }
    expect(problems).toEqual([]);
  });

  it("refuses updates and deletes of another tenant's rows", async () => {
    const problems: string[] = [];
    for (const t of tables) {
      const T = sql.identifier(t.table);
      const K = sql.identifier(t.key);
      for (const [who, ctx] of outsiders()) {
        for (const [op, query] of [
          ['update', sql`update ${T} set ${K} = ${K} where ${K} = ${a.tenantId}`],
          ['delete', sql`delete from ${T} where ${K} = ${a.tenantId}`],
        ] as [string, SQL][]) {
          const outcome = await attempt(ctx, query);
          if (outcome !== 'rows:0' && outcome !== 'code:42501') problems.push(`${t.table}: ${who} ${op} gave ${outcome}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('refuses inserting a row into another tenant', async () => {
    const problems: string[] = [];
    for (const t of tables) {
      const row = await rowOfA(t);
      const T = sql.identifier(t.table);
      for (const [who, ctx] of outsiders()) {
        // RLS WITH CHECK runs before unique and foreign-key checks, so a copy of a's row must fail with 42501.
        const code = await pgErrorCode(
          runInContext(api.db, ctx, (tx) =>
            tx.execute(sql`insert into ${T} select * from jsonb_populate_record(null::${T}, ${JSON.stringify(row)}::jsonb)`),
          ),
        );
        if (code !== '42501') problems.push(`${t.table}: ${who} insert gave ${code ?? 'no error'}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('refuses moving an own row into another tenant', async () => {
    const problems: string[] = [];
    for (const t of tables) {
      const T = sql.identifier(t.table);
      const K = sql.identifier(t.key);
      const code = await pgErrorCode(
        runInContext(api.db, ctxOf(x), (tx) => tx.execute(sql`update ${T} set ${K} = ${a.tenantId} where ${K} = ${x.tenantId}`)),
      );
      if (code !== '42501') problems.push(`${t.table}: moving x's row to a gave ${code ?? 'no error'}`);
    }
    expect(problems).toEqual([]);
  });

  it('leaves nothing behind on a reused pooled connection, even after a failed transaction', async () => {
    const single = connectApi(1);
    const problems: string[] = [];
    try {
      for (const t of tables) {
        await runInContext(single.db, ctxOf(a), (tx) => tx.execute(sql`select 1 from ${sql.identifier(t.table)} limit 1`));
        await runInContext(single.db, ctxOf(a), async () => {
          throw new Error('rolled back');
        }).catch(() => undefined);
        const nextTenant = await runInContext(single.db, ctxOf(x), async (tx) =>
          (await tx.execute<{ n: number }>(
            sql`select count(*)::int as n from ${sql.identifier(t.table)} where ${sql.identifier(t.key)} = ${a.tenantId}`,
          )).rows[0].n,
        );
        const noContext = (await single.pool.query<{ n: number }>(`select count(*)::int as n from ${q(t.table)}`)).rows[0].n;
        if (nextTenant !== 0 || noContext !== 0) problems.push(`${t.table}: next tenant ${nextTenant}, no context ${noContext}`);
      }
    } finally {
      await single.pool.end();
    }
    expect(problems).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm run test -w api -- tests/isolation`
Expected: PASS, 10 tests, over the one table `organisations`.

To check that the suite fails on a leaking policy, run as the owner:
```bash
docker compose exec -T postgres psql -U ptw_owner -d ptw_platform -c "create policy leak on organisations for select using (app_tenant_id() is not null)"
npm run test -w api -- tests/isolation
docker compose exec -T postgres psql -U ptw_owner -d ptw_platform -c "drop policy leak on organisations"
```
Expected: the middle run FAILS on both the "tenant only" incomplete context and "organisation x sees 1 row(s) of tenant a".

- [ ] **Step 3: Commit (only when authorised)**

```bash
git add tests/isolation.spec.ts
git commit -m "v2: catalogue-driven isolation suite incl. incomplete contexts (NFR-SEC-001, 008, criterion 4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Legal entities, departments and plants

Only the columns Phase 1 needs. Phase 2 adds addresses, tax ID, the reporting parent (FR-LE-002), places, themes and numbering.

**Files:**
- Create: `app/src/database/migrations/0001_structure.sql`
- Create: `tests/structure.spec.ts`
- Modify: `app/src/database/schema/tenancy.ts`, `_journal.json`, `tests/helpers/fixtures.ts`, `tests/isolation.spec.ts`

**Interfaces:**
- Consumes: `app_apply_tenant_policy` and `app_context_valid` (Task 3).
- Produces:
  - **Tables:**
    - `legal_entities`, `departments` and `plants`, each unique on `(tenant_id, id)`;
    - departments and plants are also unique on `(tenant_id, id, legal_entity_id)`, which Task 8's composite keys use;
    - Drizzle `legalEntities`, `departments` and `plants`.
  - **Context check:** `app_context_valid()` now also requires every listed legal entity to belong to the tenant. It becomes SECURITY DEFINER so it can read `legal_entities` without recursing through that table's own policy.
  - **Fixtures:**
    - `insertLegalEntity(owner, tenantId) → id`
    - `insertDepartment(owner, tenantId, legalEntityId) → id`
    - `insertPlant(owner, tenantId, legalEntityId) → id`
    - `TenantGraph.legalEntityId` becomes real, and the graph gains `departmentId` and `plantId`.

- [ ] **Step 1: Write the failing tests**

Create `tests/structure.spec.ts`:
```ts
import { connectOwner, pgErrorCode } from './helpers/db';
import { insertLegalEntity, insertOrganisation } from './helpers/fixtures';

describe('Legal entities and plants', () => {
  const owner = connectOwner();

  afterAll(() => owner.end());

  it("refuses a plant that points at another tenant's legal entity", async () => {
    const tenantA = await insertOrganisation(owner);
    const tenantB = await insertOrganisation(owner);
    const entityOfA = await insertLegalEntity(owner, tenantA);
    const code = await pgErrorCode(
      owner.query(
        `insert into plants (tenant_id, legal_entity_id, name, code, time_zone) values ($1, $2, 'Pune', 'PUN', 'Asia/Kolkata')`,
        [tenantB, entityOfA],
      ),
    );
    expect(code).toBe('23503');
  });
});
```

In `tests/isolation.spec.ts`, add these entries to the array returned by `incompleteContexts()`:
```ts
    ["user listing another tenant's legal entity", { ...fullUser(), legal_entity_ids: `${a.legalEntityId},${x.legalEntityId}` }],
    ["job listing another tenant's legal entity", { ...fullJob(), legal_entity_ids: x.legalEntityId }],
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -w api -- tests/structure tests/isolation`
Expected: FAIL. TypeScript reports `insertLegalEntity` is not exported.

- [ ] **Step 3: Implement**

Create `app/src/database/migrations/0001_structure.sql`:
```sql
-- PRD §3.2: an organisation has legal entities; a legal entity has departments and plants.
-- Child rows reference parents by (tenant_id, id), so a row can never point into another tenant.
CREATE TABLE legal_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organisations (id),
  legal_name text NOT NULL,
  short_code text NOT NULL CHECK (short_code ~ '^[A-Z0-9]{2,10}$'),
  country char(2) NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, short_code)
);
SELECT app_apply_tenant_policy('legal_entities');

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, legal_entity_id),
  UNIQUE (legal_entity_id, name),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id)
);
SELECT app_apply_tenant_policy('departments');

CREATE TABLE plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9]{2,10}$'),
  time_zone text NOT NULL,
  status text NOT NULL DEFAULT 'setting_up' CHECK (status IN ('setting_up', 'live', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, legal_entity_id),
  UNIQUE (legal_entity_id, code),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id)
);
SELECT app_apply_tenant_policy('plants');

-- Context validity now also requires every listed legal entity to belong to the tenant. SECURITY DEFINER
-- (owner, BYPASSRLS) so reading legal_entities here does not recurse through that table's own policy.
CREATE OR REPLACE FUNCTION app_context_valid() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT app_context_complete() AND CASE app_acting_role()
    WHEN 'user' THEN app_tenant_id() IS NOT NULL AND app_person_id() IS NOT NULL
      AND cardinality(app_legal_entity_ids()) > 0
      AND NOT EXISTS (SELECT unnest(app_legal_entity_ids()) EXCEPT SELECT id FROM public.legal_entities WHERE tenant_id = app_tenant_id())
    WHEN 'job' THEN app_tenant_id() IS NOT NULL AND app_person_id() IS NULL
      AND NOT EXISTS (SELECT unnest(app_legal_entity_ids()) EXCEPT SELECT id FROM public.legal_entities WHERE tenant_id = app_tenant_id())
    WHEN 'platform_admin' THEN app_tenant_id() IS NULL AND app_person_id() IS NULL AND cardinality(app_legal_entity_ids()) = 0
    ELSE false
  END
$$;
```

Append to `entries` in `_journal.json`:
```json
    { "idx": 1, "version": "7", "when": 1791072060000, "tag": "0001_structure", "breakpoints": true }
```

Append to `app/src/database/schema/tenancy.ts`:
```ts
export const legalEntities = pgTable('legal_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalName: text('legal_name').notNull(),
  shortCode: text('short_code').notNull(),
  country: text('country').notNull(),
  status: text('status', { enum: ['active', 'retired'] }).notNull().default('active'),
  ...timestamps,
});

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'retired'] }).notNull().default('active'),
  ...timestamps,
});

export const plants = pgTable('plants', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  timeZone: text('time_zone').notNull(),
  status: text('status', { enum: ['setting_up', 'live', 'retired'] }).notNull().default('setting_up'),
  ...timestamps,
});
```

Add these to `tests/helpers/fixtures.ts`, and replace `TenantGraph` and `createTenantGraph` with the versions below:
```ts
export async function insertLegalEntity(owner: Pool, tenantId: string): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into legal_entities (tenant_id, legal_name, short_code, country) values ($1, $2, $3, 'IN') returning id`,
    [tenantId, `Entity ${short()}`, `LE${short().slice(0, 4).toUpperCase()}`],
  );
  return rows[0].id;
}

export async function insertDepartment(owner: Pool, tenantId: string, legalEntityId: string): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into departments (tenant_id, legal_entity_id, name) values ($1, $2, $3) returning id`,
    [tenantId, legalEntityId, `Department ${short()}`],
  );
  return rows[0].id;
}

export async function insertPlant(owner: Pool, tenantId: string, legalEntityId: string): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into plants (tenant_id, legal_entity_id, name, code, time_zone) values ($1, $2, $3, $4, 'Asia/Kolkata') returning id`,
    [tenantId, legalEntityId, `Plant ${short()}`, `P${short().slice(0, 4).toUpperCase()}`],
  );
  return rows[0].id;
}

export interface TenantGraph {
  tenantId: string;
  kind: 'organisation' | 'agency';
  /** An active person with an account. Random until Task 7 creates person records. */
  personId: string;
  /** The person's employer legal entity. */
  legalEntityId: string;
  departmentId: string;
  plantId: string;
}

/** One row in every tenant table, so the isolation suite can test each table. Each new table adds its row here. */
export async function createTenantGraph(owner: Pool, kind: 'organisation' | 'agency' = 'organisation'): Promise<TenantGraph> {
  const tenantId = await insertOrganisation(owner, kind);
  const legalEntityId = await insertLegalEntity(owner, tenantId);
  const departmentId = await insertDepartment(owner, tenantId, legalEntityId);
  const plantId = await insertPlant(owner, tenantId, legalEntityId);
  return { tenantId, kind, personId: randomUUID(), legalEntityId, departmentId, plantId };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run test -w api -- tests/structure tests/isolation tests/schema-security tests/database-context`
Expected: PASS. The isolation suite now covers four tables, and the incomplete-context list includes the two foreign-legal-entity cases.

- [ ] **Step 5: Commit (only when authorised)**

```bash
git add app/src/database tests/structure.spec.ts tests/helpers/fixtures.ts tests/isolation.spec.ts
git commit -m "v2: legal entities, departments and plants; contexts must name legal entities of their tenant

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Accounts and person records

**Files:**
- Create: `app/src/database/migrations/0002_people.sql`, `app/src/database/schema/people.ts`
- Create: `tests/people.spec.ts`
- Modify: `app/src/database/schema/index.ts`, `_journal.json`, `tests/helpers/fixtures.ts`, `tests/isolation.spec.ts`, `tests/schema-security.spec.ts`

**Interfaces:**
- Consumes: `legal_entities` (Task 6).
- Produces:
  - **`accounts` table:** global, with no tenant column. A tenant can read an account only if the account holds a person record in that tenant. Accounts are created at sign-in in Phase 1b, never by a tenant request.
  - **`people` table:**
    - unique on `(tenant_id, id)`, with the constraint `crew_only_people_have_no_account`;
    - the API role may select only the assignment-card and status columns. `email` and `phone` are full-record columns, which it cannot select (FR-PRV-005).
  - **Context check:** `app_context_valid()` now also requires a user's person to be an active person of the tenant.
  - **Drizzle:** `accounts` and `people`.
  - **Fixtures:**
    - `insertAccount(owner) → id`
    - `insertPerson(owner, tenantId, legalEntityId, { accountId?, email? }) → { personId, accountId }`
    - `TenantGraph.personId` becomes real, and the graph gains `accountId` and `crewOnlyPersonId`.

- [ ] **Step 1: Write the failing tests**

Create `tests/people.spec.ts`:
```ts
import { sql } from 'drizzle-orm';
import { runInContext } from '../app/src/database/context';
import { connectApi, connectOwner, pgErrorCode, userCtx } from './helpers/db';
import { insertAccount, insertLegalEntity, insertOrganisation, insertPerson } from './helpers/fixtures';

describe('Accounts and person records (FR-PPL-001, 004, 005; FR-PRV-005)', () => {
  const owner = connectOwner();
  const api = connectApi();

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('refuses an account on a crew-only person (no email)', async () => {
    const tenant = await insertOrganisation(owner);
    const entity = await insertLegalEntity(owner, tenant);
    const accountId = await insertAccount(owner);
    expect(await pgErrorCode(insertPerson(owner, tenant, entity, { accountId, email: null }))).toBe('23514');
  });

  it('refuses an employer from another tenant', async () => {
    const tenantA = await insertOrganisation(owner);
    const tenantB = await insertOrganisation(owner);
    const entityOfA = await insertLegalEntity(owner, tenantA);
    expect(await pgErrorCode(insertPerson(owner, tenantB, entityOfA))).toBe('23503');
  });

  it('lets one account hold person records in two tenants, each seeing only its own', async () => {
    const tenantA = await insertOrganisation(owner);
    const tenantX = await insertOrganisation(owner, 'agency');
    const entityA = await insertLegalEntity(owner, tenantA);
    const entityX = await insertLegalEntity(owner, tenantX);
    const accountId = await insertAccount(owner);
    const inA = await insertPerson(owner, tenantA, entityA, { accountId });
    const inX = await insertPerson(owner, tenantX, entityX, { accountId });
    const recordsSeenBy = (tenantId: string, personId: string, entity: string) =>
      runInContext(api.db, userCtx(tenantId, personId, [entity]), async (tx) =>
        (await tx.execute<{ id: string }>(sql`select id from people where account_id = ${accountId}`)).rows.map((r) => r.id),
      );
    expect(await recordsSeenBy(tenantA, inA.personId, entityA)).toEqual([inA.personId]);
    expect(await recordsSeenBy(tenantX, inX.personId, entityX)).toEqual([inX.personId]);
  });

  it('shows colleagues the assignment card but never the contact details (FR-PRV-005)', async () => {
    const tenant = await insertOrganisation(owner);
    const entity = await insertLegalEntity(owner, tenant);
    const viewer = (await insertPerson(owner, tenant, entity)).personId;
    const subject = (await insertPerson(owner, tenant, entity)).personId;
    const as = (query: ReturnType<typeof sql>) => runInContext(api.db, userCtx(tenant, viewer, [entity]), (tx) => tx.execute(query));
    expect((await as(sql`select full_name, designation from people where id = ${subject}`)).rows).toHaveLength(1);
    expect(await pgErrorCode(as(sql`select email from people where id = ${subject}`))).toBe('42501');
    expect(await pgErrorCode(as(sql`select phone from people where id = ${subject}`))).toBe('42501');
  });
});
```

In `tests/isolation.spec.ts`, make three changes:
- Set `const ACCOUNT_SCOPED: string[] = ['accounts'];`.
- Add `let leftPersonId: string;` beside `let x`, and add this at the end of `beforeAll`:
```ts
    leftPersonId = (await insertPerson(owner, a.tenantId, a.legalEntityId)).personId;
    await owner.query(`update people set status = 'left', left_on = current_date where id = $1`, [leftPersonId]);
```
  Add `insertPerson` to the fixtures import, and add `userCtx` to the db helpers import.
- Add these entries to the array returned by `incompleteContexts()`:
```ts
    ['user whose person belongs to another tenant', { ...fullUser(), person_id: x.personId }],
    ['user whose person has left', { ...fullUser(), person_id: leftPersonId }],
    ['user whose person does not exist', { ...fullUser(), person_id: x.tenantId }],
```

Then add this test:
```ts
  it('shows an account only to tenants where it holds a person record, and lets no tenant create one', async () => {
    const seen = (ctx: DbContext) =>
      runInContext(api.db, ctx, async (tx) =>
        (await tx.execute<{ n: number }>(sql`select count(*)::int as n from accounts where id = ${a.accountId}`)).rows[0].n,
      );
    expect(await seen(ctxOf(a))).toBe(1);
    for (const [, ctx] of [...outsiders(), ['platform admin', platformCtx] as [string, DbContext]]) {
      expect(await seen(ctx)).toBe(0);
    }
    expect(await seen(userCtx(a.tenantId, x.personId, [a.legalEntityId]))).toBe(0);
    const create = runInContext(api.db, ctxOf(a), (tx) =>
      tx.execute(sql`insert into accounts (keycloak_subject) values (${`s-${a.tenantId}`})`),
    );
    expect(await pgErrorCode(create)).toBe('42501');
  });
```

In `tests/schema-security.spec.ts`, set:
```ts
const FULL_RECORD_COLUMNS: [string, string][] = [['people', 'email'], ['people', 'phone']];
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -w api -- tests/people tests/isolation`
Expected: FAIL. TypeScript reports `insertAccount` and `insertPerson` are not exported.

- [ ] **Step 3: Implement**

Create `app/src/database/migrations/0002_people.sql`:
```sql
-- FR-PPL-004: one account per human (the Keycloak identity), holding person records in one or more tenants.
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_subject text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- FR-PPL-001: a person record has exactly one employer, a legal entity of its own tenant.
-- FR-PPL-005 (D31): email is the sign-in identity, required for every record linked to an account and never
-- deleted by a consent withdrawal; phone is an optional contact detail. A record with no account is crew-only.
CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employer_legal_entity_id uuid NOT NULL,
  employment_type text NOT NULL CHECK (employment_type IN ('employee', 'contractor')),
  account_id uuid REFERENCES accounts (id),
  full_name text NOT NULL,
  email text CHECK (email = lower(email)),
  phone text,
  designation text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  left_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, account_id),
  UNIQUE (tenant_id, email),
  FOREIGN KEY (tenant_id, employer_legal_entity_id) REFERENCES legal_entities (tenant_id, id),
  CONSTRAINT crew_only_people_have_no_account CHECK (email IS NOT NULL OR account_id IS NULL),
  CONSTRAINT left_people_have_a_date CHECK ((status = 'left') = (left_on IS NOT NULL))
);
SELECT app_apply_tenant_policy('people');

-- FR-PRV-005: contact details belong to the full record. The API role can select the assignment-card and
-- status columns only; contact details are read through app_person_contact by PersonalDataService (Task 14).
REVOKE SELECT ON people FROM ptw_api;
GRANT SELECT (id, tenant_id, employer_legal_entity_id, employment_type, account_id, full_name, designation,
              status, left_on, created_at, updated_at) ON people TO ptw_api;

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
-- A tenant sees an account only through a person record the account holds in that tenant.
-- No write policy: accounts are created at sign-in by a SECURITY DEFINER function (Phase 1b).
CREATE POLICY member_accounts_read ON accounts FOR SELECT
  USING ((SELECT app_context_valid())
         AND EXISTS (SELECT 1 FROM people p WHERE p.account_id = accounts.id AND p.tenant_id = app_tenant_id()));

-- Context validity now also requires a user's person to be an active person of the tenant.
CREATE OR REPLACE FUNCTION app_context_valid() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT app_context_complete() AND CASE app_acting_role()
    WHEN 'user' THEN app_tenant_id() IS NOT NULL
      AND cardinality(app_legal_entity_ids()) > 0
      AND NOT EXISTS (SELECT unnest(app_legal_entity_ids()) EXCEPT SELECT id FROM public.legal_entities WHERE tenant_id = app_tenant_id())
      AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = app_person_id() AND p.tenant_id = app_tenant_id() AND p.status = 'active')
    WHEN 'job' THEN app_tenant_id() IS NOT NULL AND app_person_id() IS NULL
      AND NOT EXISTS (SELECT unnest(app_legal_entity_ids()) EXCEPT SELECT id FROM public.legal_entities WHERE tenant_id = app_tenant_id())
    WHEN 'platform_admin' THEN app_tenant_id() IS NULL AND app_person_id() IS NULL AND cardinality(app_legal_entity_ids()) = 0
    ELSE false
  END
$$;
```

Append to `entries` in `_journal.json`:
```json
    { "idx": 2, "version": "7", "when": 1791072120000, "tag": "0002_people", "breakpoints": true }
```

Create `app/src/database/schema/people.ts`:
```ts
import { date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  keycloakSubject: text('keycloak_subject').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// email (the sign-in identity, D31) and phone (optional contact) are not selectable by the API role (FR-PRV-005):
// always select explicit columns from people.
export const people = pgTable('people', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  employerLegalEntityId: uuid('employer_legal_entity_id').notNull(),
  employmentType: text('employment_type', { enum: ['employee', 'contractor'] }).notNull(),
  accountId: uuid('account_id'),
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  designation: text('designation'),
  status: text('status', { enum: ['active', 'left'] }).notNull().default('active'),
  leftOn: date('left_on'),
  ...timestamps,
});
```

Add `export * from './people';` to `app/src/database/schema/index.ts`.

Add these to `tests/helpers/fixtures.ts`:
```ts
export async function insertAccount(owner: Pool): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into accounts (keycloak_subject) values ($1) returning id`,
    [randomUUID()],
  );
  return rows[0].id;
}

/**
 * accountId: undefined creates a new account, null makes a crew-only person.
 * email: defaults to a generated address when the person has an account, otherwise null.
 */
export async function insertPerson(
  owner: Pool,
  tenantId: string,
  legalEntityId: string,
  opts: { accountId?: string | null; email?: string | null } = {},
): Promise<{ personId: string; accountId: string | null }> {
  const accountId = opts.accountId === undefined ? await insertAccount(owner) : opts.accountId;
  const email = opts.email !== undefined ? opts.email : accountId ? `p-${short()}@example.test` : null;
  const { rows } = await owner.query<{ id: string }>(
    `insert into people (tenant_id, employer_legal_entity_id, employment_type, account_id, full_name, email)
     values ($1, $2, 'employee', $3, $4, $5) returning id`,
    [tenantId, legalEntityId, accountId, `Person ${short()}`, email],
  );
  return { personId: rows[0].id, accountId };
}
```

In `TenantGraph`:
- Replace the `personId` comment with `/** An active person with an account. */`.
- Add `accountId: string;` and `crewOnlyPersonId: string;`.

In `createTenantGraph`, replace the `return` line with:
```ts
  const { personId, accountId } = await insertPerson(owner, tenantId, legalEntityId);
  const { personId: crewOnlyPersonId } = await insertPerson(owner, tenantId, legalEntityId, { accountId: null });
  return { tenantId, kind, personId, accountId: accountId as string, crewOnlyPersonId, legalEntityId, departmentId, plantId };
```

- [ ] **Step 4: Run the tests**

Run: `npm run test -w api -- tests/people tests/isolation tests/schema-security tests/database-context tests/structure`
Expected: PASS.

- [ ] **Step 5: Commit (only when authorised)**

```bash
git add app/src/database tests/people.spec.ts tests/helpers/fixtures.ts tests/isolation.spec.ts tests/schema-security.spec.ts
git commit -m "v2: accounts and person records; contact columns not selectable; context person must belong to the tenant

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Roles, assignments and permission checks

**Files:**
- Create: `packages/shared/src/permissions.ts`
- Create: `app/src/database/migrations/0003_access.sql`, `app/src/database/schema/access.ts`
- Create: `app/src/modules/access/access.module.ts`, `app/src/modules/access/permission.service.ts`
- Create: `tests/permissions.spec.ts`, `tests/helpers/services.ts`
- Modify: `packages/shared/src/index.ts`, `app/src/database/schema/index.ts`, `_journal.json`, `app/src/app.module.ts`, `tests/helpers/fixtures.ts`

**Interfaces:**
- Consumes: `people`, `plants`, `departments` and `legal_entities` (Tasks 6 and 7).
- Produces, in `@ptw/shared`:
  - `PERMISSIONS` (37 keys) and `type Permission`;
  - `DEFAULT_ROLES` (`{ key, name, permissions }[]`, 5 items) and `type DefaultRoleKey`;
  - `ADMIN_ROLES` and `type AdminRole`.
- Produces in the API:
  - Tables `roles`, `plant_assignments` and `admin_assignments`, exposed as Drizzle `roles`, `plantAssignments` and `adminAssignments`.
  - `PermissionService.holds(tx: Tx, personId: string, permission: Permission, plantId: string, departmentId: string | null): Promise<boolean>`
  - `PermissionService.isLegalEntityAdmin(tx: Tx, personId: string, legalEntityId: string): Promise<boolean>`
  - `AccessModule`, which exports `PermissionService`.
- Produces in the tests:
  - Fixtures `insertDefaultRoles(owner, tenantId, legalEntityId) → Record<DefaultRoleKey, string>`, `assignRole(owner, {...})` and `makeAdmin(owner, {...})`.
  - `services()` in `tests/helpers/services.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/helpers/services.ts`:
```ts
import { PermissionService } from '../../app/src/modules/access/permission.service';

/** Services wired by hand, as Nest would wire them. Later tasks add theirs. */
export function services() {
  const permissions = new PermissionService();
  return { permissions };
}
```

Create `tests/permissions.spec.ts`:
```ts
import { randomUUID } from 'crypto';
import { DEFAULT_ROLES, PERMISSIONS } from '@ptw/shared';
import { runInContext } from '../app/src/database/context';
import { connectApi, connectOwner, pgErrorCode, userCtx } from './helpers/db';
import {
  assignRole,
  insertDefaultRoles,
  insertDepartment,
  insertLegalEntity,
  insertOrganisation,
  insertPerson,
  insertPlant,
  makeAdmin,
} from './helpers/fixtures';
import { services } from './helpers/services';

describe('Permissions (FR-ROL-001, FR-ROL-007)', () => {
  const owner = connectOwner();
  const api = connectApi();
  const { permissions } = services();
  let tenant: string;
  let entity: string;
  let plant: string;
  let otherPlant: string;
  let department: string;
  let otherDepartment: string;
  let roleIds: Record<string, string>;
  let approver: string;
  let departmentApprover: string;
  let admin: string;
  let viewer: string; // the person whose context the checks run in

  const holds = (personId: string, permission: (typeof PERMISSIONS)[number], plantId: string, departmentId: string | null) =>
    runInContext(api.db, userCtx(tenant, viewer, [entity]), (tx) => permissions.holds(tx, personId, permission, plantId, departmentId));

  beforeAll(async () => {
    tenant = await insertOrganisation(owner);
    entity = await insertLegalEntity(owner, tenant);
    plant = await insertPlant(owner, tenant, entity);
    otherPlant = await insertPlant(owner, tenant, entity);
    department = await insertDepartment(owner, tenant, entity);
    otherDepartment = await insertDepartment(owner, tenant, entity);
    roleIds = await insertDefaultRoles(owner, tenant, entity);
    approver = (await insertPerson(owner, tenant, entity)).personId;
    departmentApprover = (await insertPerson(owner, tenant, entity)).personId;
    admin = (await insertPerson(owner, tenant, entity)).personId;
    viewer = (await insertPerson(owner, tenant, entity)).personId;
    await assignRole(owner, { tenantId: tenant, personId: approver, plantId: plant, legalEntityId: entity, roleId: roleIds.PTW_PERMIT_APPROVER });
    await assignRole(owner, {
      tenantId: tenant, personId: departmentApprover, plantId: plant, legalEntityId: entity,
      roleId: roleIds.PTW_PERMIT_APPROVER, departmentId: department,
    });
    await makeAdmin(owner, { tenantId: tenant, personId: admin, role: 'TENANT_ORG_ADMIN' });
    await makeAdmin(owner, { tenantId: tenant, personId: admin, role: 'LEGAL_ORG_ADMIN', legalEntityId: entity });
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('lists 37 unique permissions, and the five default roles use only them', () => {
    expect(new Set(PERMISSIONS).size).toBe(37);
    expect(DEFAULT_ROLES).toHaveLength(5);
    for (const role of DEFAULT_ROLES) for (const p of role.permissions) expect(PERMISSIONS).toContain(p);
  });

  it('stores a role holding every permission, and refuses an unknown one', async () => {
    const insert = (perms: string[]) =>
      owner.query(`insert into roles (tenant_id, legal_entity_id, name, permissions) values ($1, $2, $3, $4)`, [tenant, entity, `R ${randomUUID()}`, perms]);
    expect(await pgErrorCode(insert([...PERMISSIONS]))).toBeUndefined();
    expect(await pgErrorCode(insert(['fly_plane']))).toBe('23514');
  });

  it('grants a role permission only at the assigned plant', async () => {
    expect(await holds(approver, 'approve', plant, null)).toBe(true);
    expect(await holds(approver, 'approve', plant, department)).toBe(true);
    expect(await holds(approver, 'issue_permit', plant, null)).toBe(false);
    expect(await holds(approver, 'approve', otherPlant, null)).toBe(false);
  });

  it('limits a department-scoped assignment to its department', async () => {
    expect(await holds(departmentApprover, 'approve', plant, department)).toBe(true);
    expect(await holds(departmentApprover, 'approve', plant, otherDepartment)).toBe(false);
    expect(await holds(departmentApprover, 'approve', plant, null)).toBe(false);
  });

  it('gives admin roles no permit permission anywhere (FR-ROL-007)', async () => {
    for (const p of PERMISSIONS) expect(await holds(admin, p, plant, null)).toBe(false);
    const isAdmin = await runInContext(api.db, userCtx(tenant, viewer, [entity]), (tx) => permissions.isLegalEntityAdmin(tx, admin, entity));
    expect(isAdmin).toBe(true);
  });

  it('grants nothing through a retired role or to a person who has left', async () => {
    const leaver = (await insertPerson(owner, tenant, entity)).personId;
    await assignRole(owner, { tenantId: tenant, personId: leaver, plantId: plant, legalEntityId: entity, roleId: roleIds.PTW_SAFETY_OFFICER });
    expect(await holds(leaver, 'safety_check', plant, null)).toBe(true);
    await owner.query(`update people set status = 'left', left_on = current_date where id = $1`, [leaver]);
    expect(await holds(leaver, 'safety_check', plant, null)).toBe(false);

    const retiring = (await insertPerson(owner, tenant, entity)).personId;
    await assignRole(owner, { tenantId: tenant, personId: retiring, plantId: plant, legalEntityId: entity, roleId: roleIds.PTW_PERMIT_EXECUTOR });
    await owner.query(`update roles set status = 'retired' where id = $1`, [roleIds.PTW_PERMIT_EXECUTOR]);
    expect(await holds(retiring, 'record_progress', plant, null)).toBe(false);
    await owner.query(`update roles set status = 'active' where id = $1`, [roleIds.PTW_PERMIT_EXECUTOR]);
  });

  it("refuses a role assignment whose role belongs to another legal entity than the plant's", async () => {
    const secondEntity = await insertLegalEntity(owner, tenant);
    const foreignRoles = await insertDefaultRoles(owner, tenant, secondEntity);
    const code = await pgErrorCode(
      assignRole(owner, { tenantId: tenant, personId: approver, plantId: plant, legalEntityId: entity, roleId: foreignRoles.PTW_PERMIT_APPROVER }),
    );
    expect(code).toBe('23503');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -w api -- tests/permissions`
Expected: FAIL. TypeScript reports that `PERMISSIONS` is not exported from `@ptw/shared` and that `permission.service` cannot be found.

- [ ] **Step 3: Implement**

Create `packages/shared/src/permissions.ts`:
```ts
/** FR-ROL-001: the fixed permission list. A role is a named subset of it. */
export const PERMISSIONS = [
  'raise_permit', 'edit_permit', 'accept_permit', 'add_site_details', 'manage_crew', 'check_crew_in_out',
  'accept_substitute', 'fill_check_sheets', 'safety_check', 'record_gas_test', 'perform_isolation',
  'verify_isolation', 'restore_isolation', 'verify_restoration', 'approve', 'defer', 'send_back', 'reject',
  'issue_permit', 'record_progress', 'accept_days_progress', 'resume', 'revalidate_day', 'request_extension',
  'approve_extension', 'renew_permit', 'cancel_permit', 'report_completion', 'accept_closure',
  'hand_over_permit_duty', 'report_incident', 'decide_near_miss', 'investigate_incident', 'close_incident',
  'review_simops_conflict', 'acknowledge_low_simops_conflict', 'view_reports',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** PRD §5.2: the default permit roles. Keys survive renaming (FR-ROL-002); names are what people see. */
export const DEFAULT_ROLES = [
  {
    key: 'PTW_PERMIT_COORDINATOR',
    name: 'Permit coordinator',
    permissions: [
      'raise_permit', 'edit_permit', 'fill_check_sheets', 'issue_permit', 'accept_substitute', 'accept_days_progress',
      'request_extension', 'cancel_permit', 'acknowledge_low_simops_conflict', 'accept_closure', 'hand_over_permit_duty',
      'report_incident', 'view_reports',
    ],
  },
  {
    key: 'PTW_PERMIT_RECEIVER',
    name: 'Permit receiver',
    permissions: [
      'accept_permit', 'add_site_details', 'manage_crew', 'check_crew_in_out', 'fill_check_sheets', 'perform_isolation',
      'record_progress', 'revalidate_day', 'report_completion', 'restore_isolation', 'hand_over_permit_duty',
      'report_incident',
    ],
  },
  {
    key: 'PTW_PERMIT_APPROVER',
    name: 'Permit approver',
    permissions: [
      'approve', 'defer', 'send_back', 'reject', 'resume', 'approve_extension', 'renew_permit', 'cancel_permit',
      'decide_near_miss', 'review_simops_conflict', 'report_incident', 'view_reports',
    ],
  },
  {
    key: 'PTW_SAFETY_OFFICER',
    name: 'Safety officer',
    permissions: [
      'safety_check', 'record_gas_test', 'verify_isolation', 'verify_restoration', 'revalidate_day', 'resume',
      'cancel_permit', 'review_simops_conflict', 'investigate_incident', 'close_incident', 'report_incident',
      'view_reports',
    ],
  },
  { key: 'PTW_PERMIT_EXECUTOR', name: 'Permit executor', permissions: ['record_progress', 'report_incident'] },
] as const satisfies ReadonlyArray<{ key: string; name: string; permissions: readonly Permission[] }>;
export type DefaultRoleKey = (typeof DEFAULT_ROLES)[number]['key'];

/** PRD §5.1: fixed admin roles. Not in the role editor; never hold permit permissions (FR-ROL-007). */
export const ADMIN_ROLES = ['TENANT_ORG_ADMIN', 'LEGAL_ORG_ADMIN'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
```

Add `export * from './permissions';` to `packages/shared/src/index.ts`.

Create `app/src/database/migrations/0003_access.sql`:
```sql
-- PRD §5: permit roles are permission sets per legal entity; people hold them per plant, optionally per department.
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  key text CHECK (key IN ('PTW_PERMIT_COORDINATOR', 'PTW_PERMIT_RECEIVER', 'PTW_PERMIT_APPROVER', 'PTW_SAFETY_OFFICER', 'PTW_PERMIT_EXECUTOR')),
  name text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}' CHECK (permissions <@ ARRAY[
    'raise_permit', 'edit_permit', 'accept_permit', 'add_site_details', 'manage_crew', 'check_crew_in_out',
    'accept_substitute', 'fill_check_sheets', 'safety_check', 'record_gas_test', 'perform_isolation',
    'verify_isolation', 'restore_isolation', 'verify_restoration', 'approve', 'defer', 'send_back', 'reject',
    'issue_permit', 'record_progress', 'accept_days_progress', 'resume', 'revalidate_day', 'request_extension',
    'approve_extension', 'renew_permit', 'cancel_permit', 'report_completion', 'accept_closure',
    'hand_over_permit_duty', 'report_incident', 'decide_near_miss', 'investigate_incident', 'close_incident',
    'review_simops_conflict', 'acknowledge_low_simops_conflict', 'view_reports'
  ]::text[]),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, legal_entity_id),
  UNIQUE (legal_entity_id, key),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id)
);
SELECT app_apply_tenant_policy('roles');

-- The plant's legal entity is stored so the role and department are forced to belong to it.
CREATE TABLE plant_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  plant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  role_id uuid NOT NULL,
  department_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (person_id, plant_id, role_id, department_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id),
  FOREIGN KEY (tenant_id, plant_id, legal_entity_id) REFERENCES plants (tenant_id, id, legal_entity_id),
  FOREIGN KEY (tenant_id, role_id, legal_entity_id) REFERENCES roles (tenant_id, id, legal_entity_id),
  FOREIGN KEY (tenant_id, department_id, legal_entity_id) REFERENCES departments (tenant_id, id, legal_entity_id)
);
CREATE INDEX plant_assignments_person_plant ON plant_assignments (person_id, plant_id);
SELECT app_apply_tenant_policy('plant_assignments');

-- PRD §5.1: admin roles are separate from permit roles and never grant a permit permission (FR-ROL-007).
CREATE TABLE admin_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('TENANT_ORG_ADMIN', 'LEGAL_ORG_ADMIN')),
  legal_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'TENANT_ORG_ADMIN') = (legal_entity_id IS NULL)),
  UNIQUE NULLS NOT DISTINCT (person_id, role, legal_entity_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id)
);
SELECT app_apply_tenant_policy('admin_assignments');
```

Append to `entries` in `_journal.json`:
```json
    { "idx": 3, "version": "7", "when": 1791072180000, "tag": "0003_access", "breakpoints": true }
```

Create `app/src/database/schema/access.ts`:
```ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  key: text('key'),
  name: text('name').notNull(),
  permissions: text('permissions').array().notNull().default([]),
  status: text('status', { enum: ['active', 'retired'] }).notNull().default('active'),
  ...timestamps,
});

export const plantAssignments = pgTable('plant_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  plantId: uuid('plant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  roleId: uuid('role_id').notNull(),
  departmentId: uuid('department_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminAssignments = pgTable('admin_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  role: text('role', { enum: ['TENANT_ORG_ADMIN', 'LEGAL_ORG_ADMIN'] }).notNull(),
  legalEntityId: uuid('legal_entity_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Add `export * from './access';` to `app/src/database/schema/index.ts`.

Create `app/src/modules/access/permission.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { Permission } from '@ptw/shared';
import type { Tx } from '../../database/context';
import { adminAssignments, people, plantAssignments, roles } from '../../database/schema';

@Injectable()
export class PermissionService {
  /**
   * Whether a person holds a permit permission at a plant, for a permit in the given department.
   * Only plant role assignments grant permit permissions; admin assignments never do (FR-ROL-007).
   * A department-scoped assignment counts only for its own department.
   */
  async holds(tx: Tx, personId: string, permission: Permission, plantId: string, departmentId: string | null): Promise<boolean> {
    const rows = await tx
      .select({ id: plantAssignments.id })
      .from(plantAssignments)
      .innerJoin(roles, eq(roles.id, plantAssignments.roleId))
      .innerJoin(people, eq(people.id, plantAssignments.personId))
      .where(
        and(
          eq(plantAssignments.personId, personId),
          eq(plantAssignments.plantId, plantId),
          eq(roles.status, 'active'),
          eq(people.status, 'active'),
          sql`${permission} = any(${roles.permissions})`,
          departmentId === null
            ? isNull(plantAssignments.departmentId)
            : or(isNull(plantAssignments.departmentId), eq(plantAssignments.departmentId, departmentId)),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /** The admin of a legal entity: manages its people and sees their full records (FR-PRV-005). */
  async isLegalEntityAdmin(tx: Tx, personId: string, legalEntityId: string): Promise<boolean> {
    const rows = await tx
      .select({ id: adminAssignments.id })
      .from(adminAssignments)
      .innerJoin(people, eq(people.id, adminAssignments.personId))
      .where(
        and(
          eq(adminAssignments.personId, personId),
          eq(adminAssignments.role, 'LEGAL_ORG_ADMIN'),
          eq(adminAssignments.legalEntityId, legalEntityId),
          eq(people.status, 'active'),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
}
```

Create `app/src/modules/access/access.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { PermissionService } from './permission.service';

@Module({ providers: [PermissionService], exports: [PermissionService] })
export class AccessModule {}
```

In `app/src/app.module.ts`, import `AccessModule` and add it to `imports` after `SystemModule`.

Add these to `tests/helpers/fixtures.ts`, putting the `@ptw/shared` import at the top of the file:
```ts
import { DEFAULT_ROLES, type AdminRole, type DefaultRoleKey } from '@ptw/shared';

export async function insertDefaultRoles(owner: Pool, tenantId: string, legalEntityId: string): Promise<Record<DefaultRoleKey, string>> {
  const ids = {} as Record<DefaultRoleKey, string>;
  for (const role of DEFAULT_ROLES) {
    const { rows } = await owner.query<{ id: string }>(
      `insert into roles (tenant_id, legal_entity_id, key, name, permissions) values ($1, $2, $3, $4, $5) returning id`,
      [tenantId, legalEntityId, role.key, role.name, [...role.permissions]],
    );
    ids[role.key] = rows[0].id;
  }
  return ids;
}

export async function assignRole(
  owner: Pool,
  a: { tenantId: string; personId: string; plantId: string; legalEntityId: string; roleId: string; departmentId?: string },
): Promise<void> {
  await owner.query(
    `insert into plant_assignments (tenant_id, person_id, plant_id, legal_entity_id, role_id, department_id) values ($1, $2, $3, $4, $5, $6)`,
    [a.tenantId, a.personId, a.plantId, a.legalEntityId, a.roleId, a.departmentId ?? null],
  );
}

export async function makeAdmin(
  owner: Pool,
  a: { tenantId: string; personId: string; role: AdminRole; legalEntityId?: string },
): Promise<void> {
  await owner.query(
    `insert into admin_assignments (tenant_id, person_id, role, legal_entity_id) values ($1, $2, $3, $4)`,
    [a.tenantId, a.personId, a.role, a.legalEntityId ?? null],
  );
}
```

In `createTenantGraph`, before `return`, add:
```ts
  const roleIds = await insertDefaultRoles(owner, tenantId, legalEntityId);
  await assignRole(owner, { tenantId, personId, plantId, legalEntityId, roleId: roleIds.PTW_PERMIT_COORDINATOR });
  await makeAdmin(owner, { tenantId, personId, role: 'LEGAL_ORG_ADMIN', legalEntityId });
```

- [ ] **Step 4: Run the tests**

Run: `npm run test -w api -- tests/permissions tests/isolation tests/schema-security && npm run build -w api`
Expected: PASS. The isolation suite covers 8 tables.

- [ ] **Step 5: Commit (only when authorised)**

```bash
git add packages/shared/src app/src/database app/src/modules/access app/src/app.module.ts \
  tests/permissions.spec.ts tests/helpers/services.ts tests/helpers/fixtures.ts
git commit -m "v2: permit roles as permission sets, plant and admin assignments, permission checks (FR-ROL-001, 007)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Audit writer

**Files:**
- Create: `app/src/database/migrations/0004_audit.sql`, `app/src/database/schema/audit.ts`
- Create: `app/src/modules/audit/audit.module.ts`, `app/src/modules/audit/audit-writer.ts`
- Create: `tests/audit.spec.ts`
- Modify: `app/src/database/schema/index.ts`, `_journal.json`, `app/src/app.module.ts`, `tests/schema-security.spec.ts`, `tests/helpers/fixtures.ts`, `tests/helpers/services.ts`

**Interfaces:**
- Consumes: `DbContext` and `Tx` (Task 3).
- Produces:
  - Table `audit_events` (append-only for the API), exposed as Drizzle `auditEvents`.
  - `auditChanges(event) → Record<string, { before; after } | 'changed'>` and `REDACTED_FIELDS: Record<string, readonly string[]>`.
  - `AuditWriter.record(tx: Tx, ctx: DbContext, event: AuditEvent): Promise<void>`, where `AuditEvent = { action; entityType; entityId?; legalEntityId?; onBehalfOfPersonId?; deviceId?; before?; after?; changedFields? }`.
  - `AuditModule`, which is global and exports `AuditWriter`.

**Redaction (FR-AUD-005, owner review T12-STD-01):** secrets (any name with a `password`, `secret`, `token`, `credential` or `apikey` segment, or a key name such as `api_key` or `sendgrid_api_key`, singular or plural, whatever its separators or acronym-led camelCase such as `SMTPPassword`) are recorded as "changed" on every entity type and at any depth, and until counsel classifies the personal fields (O5) every non-ID field of a `person`, `people` or `account` entity is recorded as "changed" too; relaxing that needs a PRD amendment.

- [ ] **Step 1: Write the failing tests**

Create `tests/audit.spec.ts`:
```ts
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { runInContext } from '../app/src/database/context';
import { auditChanges } from '../app/src/modules/audit/audit-writer';
import { connectApi, connectOwner, pgErrorCode } from './helpers/db';
import { createTenantGraph, ctxOf, TenantGraph } from './helpers/fixtures';
import { services } from './helpers/services';

describe('Audit (FR-AUD-001 to 003, 005)', () => {
  const owner = connectOwner();
  const api = connectApi();
  const { audit } = services();
  let t: TenantGraph;

  beforeAll(async () => {
    t = await createTenantGraph(owner);
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('keeps safety values, drops unchanged fields and records personal fields only as changed', () => {
    expect(
      auditChanges({
        entityType: 'person',
        before: { designation: 'Fitter', phone: '+91 98000 00000', status: 'active' },
        after: { designation: 'Supervisor', phone: '+91 98000 11111', status: 'active' },
        changedFields: ['blood_group'],
      }),
    ).toEqual({ designation: 'changed', phone: 'changed', blood_group: 'changed' });
    expect(auditChanges({ entityType: 'gas_reading', before: { o2: 20.9 }, after: { o2: 19.1 } })).toEqual({
      o2: { before: 20.9, after: 19.1 },
    });

    // FR-AUD-005 fails closed: redaction does not depend on the entity type, the key's spelling or its nesting.
    expect(auditChanges({ entityType: 'account', before: { phone: '+91 1' }, after: { phone: '+91 2' } })).toEqual({
      phone: 'changed',
    });
    expect(auditChanges({ entityType: 'person', before: { bloodGroup: 'A+' }, after: { bloodGroup: 'B+' } })).toEqual({
      bloodGroup: 'changed',
    });
    expect(
      auditChanges({ entityType: 'person', before: { profile: { phone: '+91 1' } }, after: { profile: { phone: '+91 2' } } }),
    ).toEqual({ profile: 'changed' });
    expect(
      auditChanges({ entityType: 'person', before: { contacts: [{ Email: 'a@x.test' }] }, after: { contacts: [] } }),
    ).toEqual({ contacts: 'changed' });
    expect(auditChanges({ entityType: 'person', before: { profile: { phone: '+91 1' } }, after: { profile: { phone: '+91 1' } } })).toEqual({});

    // An absent field and null are the same value: no change, so no false "phone changed".
    expect(auditChanges({ entityType: 'person', before: {}, after: { phone: null, note: null } })).toEqual({});
    expect(auditChanges({ entityType: 'person', before: { phone: undefined, note: undefined }, after: {} })).toEqual({});
  });

  // FR-AUD-005: "Secrets (email-server passwords, keys) are recorded as 'changed', never as values."
  it('records secrets as changed on any entity type and at any depth, and keeps safety values', () => {
    const secrets = [
      'smtpPassword', 'smtp_password', 'apiKey', 'access_token', 'clientSecret',
      // Separators other than "_", prefixed compound names and the other secret words.
      'x-api-key', 'X-Api-Key', 'smtp.password', 'smtp password', 'sendgrid_api_key', 'tls_private_key', 's3_access_key',
      'webhook_signing_key', 'hmac_key', 'kms_key', 'api_keys', 'sendgrid_api_keys', 'keys', 'secrets', 'db_pwd', 'authorization', 'bearerToken',
      // Acronym-led camelCase, and plurals of the compound names.
      'SMTPPassword', 'JWTSecret', 'APIToken', 'private_keys', 'encryption_keys',
    ];
    const changes = auditChanges({
      entityType: 'email_server',
      before: { host: 'old.mail', ...Object.fromEntries(secrets.map((k) => [k, 'old-sentinel'])) },
      after: { host: 'new.mail', ...Object.fromEntries(secrets.map((k) => [k, 'new-sentinel'])) },
    });
    expect(changes).toEqual({
      host: { before: 'old.mail', after: 'new.mail' },
      ...Object.fromEntries(secrets.map((k) => [k, 'changed'])),
    });
    expect(JSON.stringify(changes)).not.toContain('sentinel');
    const nested = [
      auditChanges({ entityType: 'settings', before: { config: { key: 'old-sentinel' } }, after: { config: { key: 'new-sentinel' } } }),
      auditChanges({ entityType: 'email_server', before: { servers: [{ password: 'old-sentinel' }] }, after: { servers: [] } }),
      auditChanges({
        entityType: 'webhook',
        before: { headers: { 'x-api-key': 'old-sentinel' } },
        after: { headers: { 'x-api-key': 'new-sentinel', 'smtp.password': 'new-sentinel' } },
      }),
      // A create event: the only secret is in `after`.
      auditChanges({ entityType: 'settings', before: {}, after: { config: { key: 'new-sentinel' } } }),
    ];
    expect(nested).toEqual([{ config: 'changed' }, { servers: 'changed' }, { headers: 'changed' }, { config: 'changed' }]);
    expect(JSON.stringify(nested)).not.toContain('sentinel');

    // LOTO safety values keep their before and after: a "key" inside a name is not a secret.
    const before: Record<string, unknown> = {
      o2: 20.9, isolation_point: 'V-101', lock_key_number: 'K-7', lock_key: 'K-7', lock_keys: ['K-7'], gas_test_pass: 'pass', hazard: 'H2S',
      control: 'Blind flange', decision: 'approved', starts_at: '2026-10-05T08:00:00Z',
    };
    const after: Record<string, unknown> = {
      o2: 19.1, isolation_point: 'V-102', lock_key_number: 'K-9', lock_key: 'K-9', lock_keys: ['K-9', 'K-10'], gas_test_pass: 'fail', hazard: 'Steam',
      control: 'Double block', decision: 'deferred', starts_at: '2026-10-05T09:00:00Z',
    };
    expect(auditChanges({ entityType: 'isolation', before, after })).toEqual(
      Object.fromEntries(Object.keys(before).map((k) => [k, { before: before[k], after: after[k] }])),
    );
  });

  // Interim rule until counsel classifies the personal fields (O5): a person or account keeps only its IDs.
  it('records every non-ID field of a person or account as changed, and personal names on any entity type', () => {
    expect(
      auditChanges({
        entityType: 'person',
        before: { full_name: 'A. Rao', status: 'active', employer_legal_entity_id: 'le-1', employerLegalEntityId: 'le-1' },
        after: { full_name: 'A. Rao-Iyer', status: 'left', employer_legal_entity_id: 'le-2', employerLegalEntityId: 'le-2' },
      }),
    ).toEqual({
      full_name: 'changed',
      status: 'changed',
      employer_legal_entity_id: { before: 'le-1', after: 'le-2' },
      employerLegalEntityId: { before: 'le-1', after: 'le-2' },
    });
    expect(auditChanges({ entityType: 'account', before: { status: 'active' }, after: { status: 'disabled' } })).toEqual({
      status: 'changed',
    });
    // IDs keep their values in any spelling, including acronym-led ones.
    expect(
      auditChanges({ entityType: 'person', before: { personID: 'p-1', legalEntityID: 'le-1' }, after: { personID: 'p-2', legalEntityID: 'le-2' } }),
    ).toEqual({ personID: { before: 'p-1', after: 'p-2' }, legalEntityID: { before: 'le-1', after: 'le-2' } });
    // The personal entity type is matched on its normalised form, so spelling and plurals do not escape the rule.
    for (const entityType of ['people', 'Person', 'PERSON', 'accounts']) {
      expect(
        auditChanges({
          entityType,
          before: { full_name: 'A. Rao', status: 'active', employer_legal_entity_id: 'le-1' },
          after: { full_name: 'A. Rao-Iyer', status: 'left', employer_legal_entity_id: 'le-2' },
        }),
      ).toEqual({ full_name: 'changed', status: 'changed', employer_legal_entity_id: { before: 'le-1', after: 'le-2' } });
    }
    expect(auditChanges({ entityType: 'permit', before: { full_name: 'A' }, after: { full_name: 'B' } })).toEqual({
      full_name: 'changed',
    });
    expect(
      auditChanges({ entityType: 'permit', before: { crew: [{ designation: 'Fitter' }] }, after: { crew: [] } }),
    ).toEqual({ crew: 'changed' });
  });

  it('writes in the action transaction, so a rolled-back action leaves no audit event', async () => {
    const ctx = ctxOf(t);
    const kept = `test.kept.${randomUUID()}`;
    const dropped = `test.dropped.${randomUUID()}`;
    await runInContext(api.db, ctx, (tx) => audit.record(tx, ctx, { action: kept, entityType: 'test', deviceId: 'device-1' }));
    await expect(
      runInContext(api.db, ctx, async (tx) => {
        await audit.record(tx, ctx, { action: dropped, entityType: 'test' });
        throw new Error('action failed');
      }),
    ).rejects.toThrow('action failed');
    const { rows } = await owner.query(
      `select action, actor_person_id, device_id from audit_events where action in ($1, $2)`,
      [kept, dropped],
    );
    expect(rows).toEqual([{ action: kept, actor_person_id: t.personId, device_id: 'device-1' }]);
  });

  it('cannot be edited or deleted by the API (FR-AUD-003)', async () => {
    for (const statement of [
      sql`update audit_events set action = 'tampered' where tenant_id = ${t.tenantId}`,
      sql`delete from audit_events where tenant_id = ${t.tenantId}`,
    ]) {
      expect(await pgErrorCode(runInContext(api.db, ctxOf(t), (tx) => tx.execute(statement)))).toBe('42501');
    }
  });
});
```

Replace `tests/helpers/services.ts` with:
```ts
import { PermissionService } from '../../app/src/modules/access/permission.service';
import { AuditWriter } from '../../app/src/modules/audit/audit-writer';

/** Services wired by hand, as Nest would wire them. Later tasks add theirs. */
export function services() {
  const permissions = new PermissionService();
  const audit = new AuditWriter();
  return { permissions, audit };
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -w api -- tests/audit`
Expected: FAIL. TypeScript reports that `audit-writer` cannot be found.

- [ ] **Step 3: Implement**

Create `app/src/database/migrations/0004_audit.sql`:
```sql
-- FR-AUD-001 to 003: who, on whose behalf, when, from which device, what changed. No foreign keys to the
-- records described, so audit outlives them. The API may only insert and read (NFR-SEC-001a).
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organisations (id),
  legal_entity_id uuid,
  actor_person_id uuid,
  on_behalf_of_person_id uuid,
  device_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_entity ON audit_events (tenant_id, entity_type, entity_id, occurred_at);
SELECT app_apply_tenant_policy('audit_events');
REVOKE UPDATE, DELETE ON audit_events FROM ptw_api;
```

Append to `entries` in `_journal.json`:
```json
    { "idx": 4, "version": "7", "when": 1791072240000, "tag": "0004_audit", "breakpoints": true }
```

Create `app/src/database/schema/audit.ts`:
```ts
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id'),
  actorPersonId: uuid('actor_person_id'),
  onBehalfOfPersonId: uuid('on_behalf_of_person_id'),
  deviceId: text('device_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Add `export * from './audit';` to `app/src/database/schema/index.ts`.

Create `app/src/modules/audit/audit-writer.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { DbContext, Tx } from '../../database/context';
import { auditEvents } from '../../database/schema';

/**
 * FR-AUD-005: fields whose values never reach audit. A change is recorded as "changed". Redaction fails closed:
 * the union of these names applies to every entity type, to camelCase spellings, and to any field that holds
 * one at any depth. Add the names of a new kind of personal value here.
 */
export const REDACTED_FIELDS: Record<string, readonly string[]> = {
  person: [
    'email', 'phone', 'blood_group', 'health_conditions', 'emergency_contacts', 'identity_document_number',
    'employment_history', 'full_name', 'designation',
  ],
};

/**
 * FR-AUD-005: secrets are recorded as "changed", never as values. Names are matched after camelCase is split and
 * every run of non-alphanumeric characters becomes `_`. A name is a secret when one of its `_` segments is in
 * SECRET_WORDS, or it equals a SECRET_NAMES entry, or it ends with `_` and an entry other than bare `key` or
 * `keys`, singular or plural (`sendgrid_api_key`, `private_keys`). `lock_key`, `lock_keys` and `lock_key_number` are
 * LOTO safety fields and keep their values, as do `pass` and `pin` names such as `gas_test_pass`. When a new kind
 * of secret appears, add its name here.
 */
const SECRET_WORDS = new Set([
  'password', 'passwd', 'pwd', 'passphrase', 'secret', 'token', 'credential', 'credentials', 'apikey', 'authorization',
  'bearer',
]);
const SECRET_NAMES = new Set([
  'key', 'keys', 'api_key', 'api_keys', 'private_key', 'secret_key', 'access_key', 'wrapped_key', 'data_key',
  'encryption_key', 'signing_key', 'master_key', 'hmac_key', 'kms_key', 'secrets', 'tokens', 'passwords',
]);

/**
 * Interim rule until counsel classifies the personal fields (O5): for these entity types, matched on the normalised
 * name (`people`, `Person`, `accounts`), only the IDs keep their values and every other field is recorded as
 * "changed". Relaxing it needs a PRD amendment.
 */
const PERSONAL_ENTITY = /^(person|people|account)s?$/;

const REDACTED = new Set(Object.values(REDACTED_FIELDS).flat());
/** `SMTPPassword` and `personID` split at the acronym boundary too; every run of other characters becomes `_`. */
const snake = (key: string): string =>
  key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
// A SECRET_NAMES entry, alone or after `_`, with an optional plural `s`. Bare `key` and `keys` only count as whole names.
const SECRET_SUFFIX = new RegExp(`(^|_)(${[...SECRET_NAMES].filter((n) => !/^keys?$/.test(n)).join('|')})s?$`);
const isSecret = (name: string): boolean =>
  SECRET_NAMES.has(name) || SECRET_SUFFIX.test(name) || name.split('_').some((word) => SECRET_WORDS.has(word));
const isRedacted = (key: string): boolean => REDACTED.has(snake(key)) || isSecret(snake(key));
const isId = (key: string): boolean => /(^|_)id$/.test(snake(key));
const holdsRedacted = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && Object.entries(value).some(([key, v]) => isRedacted(key) || holdsRedacted(v));

export type AuditChange = { before: unknown; after: unknown } | 'changed';

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string;
  legalEntityId?: string;
  onBehalfOfPersonId?: string;
  deviceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** Fields that changed but whose values the caller does not pass. Always recorded as "changed". */
  changedFields?: readonly string[];
}

export function auditChanges(
  event: Pick<AuditEvent, 'entityType' | 'before' | 'after' | 'changedFields'>,
): Record<string, AuditChange> {
  const before = event.before ?? {};
  const after = event.after ?? {};
  const personal = PERSONAL_ENTITY.test(snake(event.entityType));
  const changes: Record<string, AuditChange> = {};
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const [was, now] = [before[field] ?? null, after[field] ?? null];
    if (JSON.stringify(was) === JSON.stringify(now)) continue;
    const redacted = (personal && !isId(field)) || isRedacted(field) || holdsRedacted(was) || holdsRedacted(now);
    changes[field] = redacted ? 'changed' : { before: was, after: now };
  }
  for (const field of event.changedFields ?? []) changes[field] = 'changed';
  return changes;
}

/** Writes in the caller's transaction: if the action rolls back, its audit event does too (FR-AUD-001 to 003). */
@Injectable()
export class AuditWriter {
  async record(tx: Tx, ctx: DbContext, event: AuditEvent): Promise<void> {
    if (!ctx.tenantId) throw new Error('An audit event needs a tenant context');
    await tx.insert(auditEvents).values({
      tenantId: ctx.tenantId,
      legalEntityId: event.legalEntityId ?? null,
      actorPersonId: ctx.personId,
      onBehalfOfPersonId: event.onBehalfOfPersonId ?? null,
      deviceId: event.deviceId ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      changes: auditChanges(event),
    });
  }
}
```

Create `app/src/modules/audit/audit.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { AuditWriter } from './audit-writer';

@Global()
@Module({ providers: [AuditWriter], exports: [AuditWriter] })
export class AuditModule {}
```

In `app/src/app.module.ts`, import `AuditModule` and add it to `imports` before `AccessModule`.

Make two test changes:
- In `tests/schema-security.spec.ts`, set `const APPEND_ONLY: string[] = ['audit_events'];`.
- In `createTenantGraph` (`tests/helpers/fixtures.ts`), before `return`, add:
```ts
  await owner.query(`insert into audit_events (tenant_id, action, entity_type) values ($1, 'fixture.created', 'fixture')`, [tenantId]);
```

- [ ] **Step 4: Run the tests**

Run: `npm run test -w api -- tests/audit tests/isolation tests/schema-security`
Expected: PASS.

- [ ] **Step 5: Commit (only when authorised)**

```bash
git add app/src/database app/src/modules/audit app/src/app.module.ts tests/audit.spec.ts \
  tests/schema-security.spec.ts tests/helpers/fixtures.ts tests/helpers/services.ts
git commit -m "v2: append-only audit writer in the action transaction, personal values redacted (FR-AUD-001 to 005)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Key service and tenant data keys

**Files:**
- Create: `app/src/modules/privacy/key.service.ts`, `app/src/modules/privacy/field-crypto.ts`, `app/src/modules/privacy/tenant-key.service.ts`
- Create: `app/src/database/migrations/0005_tenant_data_keys.sql`, `app/src/database/schema/privacy.ts`
- Create: `tests/key-service.spec.ts`
- Modify:
  - Compose and environment: `docker-compose.yml`, `docker-compose.app.yml`, `.env.example`.
  - API: `app/src/config/configuration.ts`, `app/src/config/validate-env.ts`, `app/src/database/schema/index.ts`, `_journal.json`.
  - Tests: `tests/helpers/global-setup.ts`, `tests/helpers/services.ts`, `tests/helpers/fixtures.ts`, `tests/schema-security.spec.ts`.

**Interfaces:**
- Consumes: `Tx` (Task 3).
- Produces:
  - `KeyService`: `createDataKey(): Promise<string>` returns a wrapped key; `unwrap(wrapped: string): Promise<Buffer>` returns 32 bytes.
  - Field crypto:
    - `encryptField(key: Buffer, keyVersion: number, plaintext: string, aad: string): Buffer`
    - `decryptField(key: Buffer, blob: Buffer, aad: string): string`
    - `keyVersionOf(blob: Buffer): number`
  - `TenantKeyService`:
    - `current(tx: Tx, tenantId: string): Promise<{ version: number; key: Buffer }>`
    - `byVersion(tx: Tx, tenantId: string, version: number): Promise<Buffer>`
  - Table `tenant_data_keys` (append-only), exposed as Drizzle `tenantDataKeys`.
  - Configuration keys `keyService.url`, `keyService.token` and `keyService.keyName`.
- Neither `KeyService` nor `TenantKeyService` is exported outside the privacy module (Task 14 builds it).

- [ ] **Step 1: Add OpenBao to compose**

**Approved by the owner (O2).** Check that the image tag exists with `docker pull quay.io/openbao/openbao:2.2`. If it does not, use the newest 2.x tag listed at quay.io/repository/openbao/openbao.

Add to `docker-compose.yml` under `services:`:
```yaml
  # NFR-SEC-003 master key. Dev mode keeps keys in memory, so restarting it makes encrypted values unreadable:
  # local, disposable test data only. The Phase 3 pilot runs OpenBao with persistent storage, an unseal
  # procedure and an application token limited to datakey and decrypt on this key.
  openbao:
    image: quay.io/openbao/openbao:2.2
    command: server -dev -dev-listen-address=0.0.0.0:8200 -dev-root-token-id=${KEY_SERVICE_TOKEN:-dev-only-token}
    cap_add: [IPC_LOCK]
    ports:
      - "8200:8200"

  openbao-init:
    image: quay.io/openbao/openbao:2.2
    depends_on: [openbao]
    restart: "no"
    environment:
      BAO_ADDR: http://openbao:8200
      BAO_TOKEN: ${KEY_SERVICE_TOKEN:-dev-only-token}
      VAULT_ADDR: http://openbao:8200
      VAULT_TOKEN: ${KEY_SERVICE_TOKEN:-dev-only-token}
    entrypoint:
      - /bin/sh
      - -c
      - |
        until bao status >/dev/null 2>&1; do sleep 1; done
        bao secrets enable transit || true
        bao write -f transit/keys/ptw-master type=aes256-gcm96 || true
```

Add to the `api` environment in `docker-compose.yml` and in `docker-compose.app.yml`:
```yaml
      KEY_SERVICE_URL: http://openbao:8200
      KEY_SERVICE_TOKEN: ${KEY_SERVICE_TOKEN:-dev-only-token}
```
In `docker-compose.yml` only, also add to `api.depends_on`:
```yaml
      openbao-init:
        condition: service_completed_successfully
```

Add to `.env.example` and to your worktree `.env`:
```bash
# NFR-SEC-003 key service (OpenBao Transit). The master key never leaves it; this token is an access credential.
KEY_SERVICE_URL=http://localhost:8200
KEY_SERVICE_TOKEN=dev-only-token
KEY_SERVICE_KEY_NAME=ptw-master
```

Run: `docker compose up -d openbao openbao-init && docker compose logs openbao-init`
Expected: the log shows `Success! Enabled the transit secrets engine` and `Success! Data written to: transit/keys/ptw-master`.

- [ ] **Step 2: Write the failing tests**

Create `tests/key-service.spec.ts`:
```ts
import { randomBytes } from 'crypto';
import { runInContext } from '../app/src/database/context';
import { decryptField, encryptField, keyVersionOf } from '../app/src/modules/privacy/field-crypto';
import { connectApi, connectOwner, userCtx } from './helpers/db';
import { insertLegalEntity, insertOrganisation, insertPerson } from './helpers/fixtures';
import { services } from './helpers/services';

describe('Field encryption (NFR-SEC-003)', () => {
  const key = randomBytes(32);

  it('round-trips with the same record ID and records the key version', () => {
    const blob = encryptField(key, 3, 'O+', 'person-1:blood_group');
    expect(keyVersionOf(blob)).toBe(3);
    expect(blob.includes(Buffer.from('O+'))).toBe(false);
    expect(decryptField(key, blob, 'person-1:blood_group')).toBe('O+');
  });

  it('refuses a value moved to another record or field, or tampered with', () => {
    const blob = encryptField(key, 1, 'O+', 'person-1:blood_group');
    expect(() => decryptField(key, blob, 'person-2:blood_group')).toThrow();
    expect(() => decryptField(key, blob, 'person-1:health_conditions')).toThrow();
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptField(key, tampered, 'person-1:blood_group')).toThrow();
  });
});

describe('Tenant data keys (NFR-SEC-003)', () => {
  const owner = connectOwner();
  const api = connectApi();
  const { keys, tenantKeys } = services();

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  const freshTenant = async () => {
    const tenantId = await insertOrganisation(owner);
    const entity = await insertLegalEntity(owner, tenantId);
    const { personId } = await insertPerson(owner, tenantId, entity);
    return { tenantId, ctx: userCtx(tenantId, personId, [entity]) };
  };

  it('gets a 256-bit data key wrapped by the master key', async () => {
    const wrapped = await keys.createDataKey();
    expect(wrapped).toMatch(/^vault:v\d+:/);
    expect(await keys.unwrap(wrapped)).toHaveLength(32);
  });

  it('creates version 1 once, even when two requests ask at the same time (Review Focus 4)', async () => {
    const { tenantId, ctx } = await freshTenant();
    const [first, second] = await Promise.all([
      runInContext(api.db, ctx, (tx) => tenantKeys.current(tx, tenantId)),
      runInContext(api.db, ctx, (tx) => tenantKeys.current(tx, tenantId)),
    ]);
    expect(first.version).toBe(1);
    expect(second.version).toBe(1);
    expect(first.key.equals(second.key)).toBe(true);
    const { rows } = await owner.query(`select wrapped_key from tenant_data_keys where tenant_id = $1`, [tenantId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].wrapped_key.includes(first.key.toString('base64'))).toBe(false);
    expect(rows[0].wrapped_key.includes(first.key.toString('hex'))).toBe(false);
  });
});
```

Replace `tests/helpers/services.ts` with:
```ts
import { ConfigService } from '@nestjs/config';
import { PermissionService } from '../../app/src/modules/access/permission.service';
import { AuditWriter } from '../../app/src/modules/audit/audit-writer';
import { KeyService } from '../../app/src/modules/privacy/key.service';
import { TenantKeyService } from '../../app/src/modules/privacy/tenant-key.service';

export const keyServiceConfig: Record<string, string> = {
  'keyService.url': process.env.KEY_SERVICE_URL ?? 'http://localhost:8200',
  'keyService.token': process.env.KEY_SERVICE_TOKEN ?? 'dev-only-token',
  'keyService.keyName': process.env.KEY_SERVICE_KEY_NAME ?? 'ptw-master',
};

export const configFrom = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;

/** Services wired by hand, as Nest would wire them. Later tasks add theirs. */
export function services(keyConfig: Record<string, string> = keyServiceConfig) {
  const permissions = new PermissionService();
  const audit = new AuditWriter();
  const keys = new KeyService(configFrom(keyConfig));
  const tenantKeys = new TenantKeyService(keys);
  return { permissions, audit, keys, tenantKeys };
}
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npm run test -w api -- tests/key-service`
Expected: FAIL. TypeScript reports that `field-crypto` cannot be found.

- [ ] **Step 4: Implement**

Create `app/src/modules/privacy/field-crypto.ts`:
```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// NFR-SEC-003: AES-256-GCM with "<record id>:<field>" as associated data, so a value cannot be moved to
// another record or field. Layout: key version (4 bytes) | IV (12) | tag (16) | ciphertext.

export function encryptField(key: Buffer, keyVersion: number, plaintext: string, aad: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const version = Buffer.alloc(4);
  version.writeUInt32BE(keyVersion);
  return Buffer.concat([version, iv, cipher.getAuthTag(), body]);
}

export function keyVersionOf(blob: Buffer): number {
  return blob.readUInt32BE(0);
}

export function decryptField(key: Buffer, blob: Buffer, aad: string): string {
  const decipher = createDecipheriv('aes-256-gcm', key, blob.subarray(4, 16));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(blob.subarray(16, 32));
  return Buffer.concat([decipher.update(blob.subarray(32)), decipher.final()]).toString('utf8');
}
```

Create `app/src/modules/privacy/key.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Data keys through the managed key service (OpenBao/Vault Transit). The master key never leaves it.
 * The API can get a new wrapped data key and unwrap one, and nothing else (NFR-SEC-003).
 */
@Injectable()
export class KeyService {
  // ponytail: in-process cache, one entry per tenant key version, 5-minute life. Never Redis.
  private readonly unwrapped = new Map<string, { key: Buffer; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  async createDataKey(): Promise<string> {
    const data = await this.call(`datakey/wrapped/${this.keyName()}`, { bits: 256 });
    return data.ciphertext as string;
  }

  async unwrap(wrapped: string): Promise<Buffer> {
    const hit = this.unwrapped.get(wrapped);
    if (hit && hit.expiresAt > Date.now()) return hit.key;
    const data = await this.call(`decrypt/${this.keyName()}`, { ciphertext: wrapped });
    const key = Buffer.from(data.plaintext as string, 'base64');
    if (key.length !== 32) throw new Error('Key service returned a data key of the wrong length');
    this.unwrapped.set(wrapped, { key, expiresAt: Date.now() + 5 * 60_000 });
    return key;
  }

  private keyName(): string {
    return this.config.get<string>('keyService.keyName') ?? 'ptw-master';
  }

  private async call(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.config.get<string>('keyService.url')}/v1/transit/${path}`, {
      method: 'POST',
      headers: { 'X-Vault-Token': this.config.get<string>('keyService.token') ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Key service refused ${path.split('/')[0]} (${response.status})`);
    return ((await response.json()) as { data: Record<string, unknown> }).data;
  }
}
```

Create `app/src/database/migrations/0005_tenant_data_keys.sql`:
```sql
-- NFR-SEC-003: one data key per tenant and version, stored only wrapped by the master key.
-- Append-only for the API: a wrapped key is never overwritten, because losing it loses the data.
CREATE TABLE tenant_data_keys (
  tenant_id uuid NOT NULL REFERENCES organisations (id),
  version integer NOT NULL CHECK (version > 0),
  wrapped_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, version)
);
SELECT app_apply_tenant_policy('tenant_data_keys');
REVOKE UPDATE, DELETE ON tenant_data_keys FROM ptw_api;
```

Append to `entries` in `_journal.json`:
```json
    { "idx": 5, "version": "7", "when": 1791072300000, "tag": "0005_tenant_data_keys", "breakpoints": true }
```

Create `app/src/database/schema/privacy.ts`:
```ts
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Primary key (tenant_id, version) lives in the SQL migration; queries here need only the columns.
export const tenantDataKeys = pgTable('tenant_data_keys', {
  tenantId: uuid('tenant_id').notNull(),
  version: integer('version').notNull(),
  wrappedKey: text('wrapped_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Add `export * from './privacy';` to `app/src/database/schema/index.ts`.

Create `app/src/modules/privacy/tenant-key.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { Tx } from '../../database/context';
import { tenantDataKeys } from '../../database/schema';
import { KeyService } from './key.service';

@Injectable()
export class TenantKeyService {
  constructor(private readonly keys: KeyService) {}

  /** The tenant's newest data key, created on first use. Concurrent first uses converge on version 1. */
  async current(tx: Tx, tenantId: string): Promise<{ version: number; key: Buffer }> {
    let row = await this.latest(tx, tenantId);
    if (!row) {
      const wrappedKey = await this.keys.createDataKey();
      await tx.insert(tenantDataKeys).values({ tenantId, version: 1, wrappedKey }).onConflictDoNothing();
      row = await this.latest(tx, tenantId);
    }
    if (!row) throw new Error('Tenant data key could not be created');
    return { version: row.version, key: await this.keys.unwrap(row.wrappedKey) };
  }

  async byVersion(tx: Tx, tenantId: string, version: number): Promise<Buffer> {
    const [row] = await tx
      .select()
      .from(tenantDataKeys)
      .where(and(eq(tenantDataKeys.tenantId, tenantId), eq(tenantDataKeys.version, version)));
    if (!row) throw new Error(`Tenant data key version ${version} is missing`);
    return this.keys.unwrap(row.wrappedKey);
  }

  private async latest(tx: Tx, tenantId: string) {
    const [row] = await tx
      .select()
      .from(tenantDataKeys)
      .where(eq(tenantDataKeys.tenantId, tenantId))
      .orderBy(desc(tenantDataKeys.version))
      .limit(1);
    return row;
  }
}
```

In `app/src/config/configuration.ts`, add this property to the returned object:
```ts
  keyService: {
    url: process.env.KEY_SERVICE_URL ?? 'http://localhost:8200',
    token: process.env.KEY_SERVICE_TOKEN,
    keyName: process.env.KEY_SERVICE_KEY_NAME ?? 'ptw-master',
  },
```
In `app/src/config/validate-env.ts`, add `'KEY_SERVICE_URL'` and `'KEY_SERVICE_TOKEN'` to `REQUIRED_ENV_VARS`.

In `tests/helpers/global-setup.ts`, after the database loop, add:
```ts
  const keyServiceUrl = process.env.KEY_SERVICE_URL ?? 'http://localhost:8200';
  const health = await fetch(`${keyServiceUrl}/v1/sys/health`).catch(() => undefined);
  if (!health?.ok) {
    throw new Error(`Tests need the key service at ${keyServiceUrl}. Run: docker compose up -d openbao openbao-init`);
  }
```

Make two more test changes:
- In `tests/schema-security.spec.ts`, set `APPEND_ONLY` to `['audit_events', 'tenant_data_keys']`.
- In `createTenantGraph`, before `return`, add the line below. The fixture key is not a usable key, so specs that encrypt build their own tenant and never call `createTenantGraph`:
```ts
  await owner.query(`insert into tenant_data_keys (tenant_id, version, wrapped_key) values ($1, 1, 'vault:v1:fixture-not-a-key')`, [tenantId]);
```

- [ ] **Step 5: Run the tests**

Run: `npm run test -w api`
Expected: PASS for the whole suite. Some kept specs (`production-readiness-backend`, `security-hardening`) may build a complete environment for `validate-env`. If one now fails because `KEY_SERVICE_URL` or `KEY_SERVICE_TOKEN` is missing, add the two variables to that spec's environment.

- [ ] **Step 6: Commit (only when authorised)**

```bash
git add docker-compose.yml docker-compose.app.yml .env.example app/src/config app/src/database app/src/modules/privacy \
  tests/key-service.spec.ts tests/helpers tests/schema-security.spec.ts
git commit -m "v2: per-tenant data keys wrapped by an OpenBao Transit master key, AES-256-GCM fields (NFR-SEC-003)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Tenant-scoped jobs

**Files:**
- Create: `app/src/database/migrations/0006_job_tenants.sql`, `app/src/infrastructure/queue/tenant-job.ts`
- Create: `tests/tenant-jobs.spec.ts`
- Modify: `app/src/database/context.ts`, `app/src/database/database.module.ts`, `app/src/infrastructure/queue/queue.service.ts`, `_journal.json`, `tests/helpers/global-setup.ts`

**Interfaces:**
- Consumes: `runInContext`, `jobContext` and `UUID_PATTERN` (Task 3).
- Produces:
  - SQL `app_tenant_ids_for_jobs()`: SECURITY DEFINER, executable only by `ptw_api`.
  - `forEachTenant(db: Database, fn: (tx: Tx, tenantId: string) => Promise<void>): Promise<void>`, also available as `ContextDb.forEachTenant(fn)`.
  - `assertIdsOnly(payload)` and `type TenantJobPayload`.
  - `DEFAULT_JOB_OPTIONS` (failed jobs removed at final failure) and `QueueService.enqueueTenantJob(name: string, payload: Record<string, unknown>): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/tenant-jobs.spec.ts`:
```ts
import { randomUUID } from 'crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { sql } from 'drizzle-orm';
import { forEachTenant } from '../app/src/database/context';
import { DEFAULT_JOB_OPTIONS } from '../app/src/infrastructure/queue/queue.service';
import { assertIdsOnly } from '../app/src/infrastructure/queue/tenant-job';
import { connectApi, connectOwner } from './helpers/db';
import { createTenantGraph, TenantGraph } from './helpers/fixtures';

const connection = { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) };

describe('Tenant-scoped jobs (NFR-SEC-008)', () => {
  const owner = connectOwner();
  const api = connectApi();
  let a: TenantGraph;
  let x: TenantGraph;

  beforeAll(async () => {
    a = await createTenantGraph(owner);
    x = await createTenantGraph(owner);
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('accepts only the tenant ID and record IDs in a job payload', () => {
    expect(() => assertIdsOnly({ tenantId: randomUUID(), permitId: randomUUID() })).not.toThrow();
    expect(() => assertIdsOnly({ tenantId: randomUUID(), name: 'Asha Rao' })).toThrow('record ID');
    expect(() => assertIdsOnly({ tenantId: randomUUID(), email: 'asha@example.test' })).toThrow('record ID');
    expect(() => assertIdsOnly({ tenantId: randomUUID(), attempts: 3 })).toThrow('record ID');
    expect(() => assertIdsOnly({ permitId: randomUUID() })).toThrow('tenantId');
  });

  it('removes a failed job as soon as it finally fails, so none is kept beyond 7 days on an idle queue', async () => {
    const name = `retention-${randomUUID()}`;
    const queue = new Queue(name, { connection, defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 1 } });
    const events = new QueueEvents(name, { connection });
    const worker = new Worker(name, async () => {
      throw new Error('handler failed');
    }, { connection });
    try {
      await events.waitUntilReady();
      // Listen before adding, so a job that fails at once is not missed.
      const failed = new Promise<string>((resolve) => events.on('failed', ({ jobId }) => resolve(jobId)));
      const job = await queue.add('fails', { tenantId: randomUUID() });
      expect(await failed).toBe(job.id);
      expect(await queue.getJob(job.id as string)).toBeUndefined();
      expect(await queue.getJobCounts('failed')).toEqual({ failed: 0 });
    } finally {
      await worker.close();
      await events.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it("visits each tenant under its own context, and one tenant's failure does not stop the others", async () => {
    const seen = new Map<string, { own: number; foreign: number }>();
    const run = forEachTenant(api.db, async (tx, tenantId) => {
      if (tenantId === a.tenantId) throw new Error('tenant a failed');
      const { rows } = await tx.execute<{ own: number; foreign: number }>(sql`
        select count(*) filter (where tenant_id = ${tenantId})::int as own,
               count(*) filter (where tenant_id <> ${tenantId})::int as foreign
          from legal_entities`);
      seen.set(tenantId, rows[0]);
    });
    await expect(run).rejects.toBeInstanceOf(AggregateError);
    expect(seen.get(x.tenantId)).toEqual({ own: 1, foreign: 0 });
    expect(seen.has(a.tenantId)).toBe(false);
  });
});
```

In `tests/helpers/global-setup.ts`, add `import { connect } from 'net';` at the top, and add this after the key service check:
```ts
  const redisUp = await new Promise<boolean>((resolve) => {
    const socket = connect(Number(process.env.REDIS_PORT ?? 6379), process.env.REDIS_HOST ?? 'localhost');
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
  if (!redisUp) throw new Error('Tests need Redis. Run: docker compose up -d redis');
```

- [ ] **Step 2: Run them to verify they fail**

Run: `docker compose up -d redis && npm run test -w api -- tests/tenant-jobs`
Expected: FAIL. TypeScript reports that `forEachTenant` and `DEFAULT_JOB_OPTIONS` are not exported and that `tenant-job` cannot be found.

- [ ] **Step 3: Implement**

Create `app/src/database/migrations/0006_job_tenants.sql`:
```sql
-- NFR-SEC-008: the single source of tenant IDs for jobs that span tenants. Each tenant is then processed
-- under its own context with the API role; no job uses a bypass role for tenant data.
CREATE FUNCTION app_tenant_ids_for_jobs() RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$ SELECT id FROM public.organisations ORDER BY id $$;
REVOKE EXECUTE ON FUNCTION app_tenant_ids_for_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_tenant_ids_for_jobs() TO ptw_api;
```

Append to `entries` in `_journal.json`:
```json
    { "idx": 6, "version": "7", "when": 1791072360000, "tag": "0006_job_tenants", "breakpoints": true }
```

Append to `app/src/database/context.ts`:
```ts
/** Runs fn once per tenant, each under that tenant's own job context. One tenant's failure does not stop the others. */
export async function forEachTenant(db: Database, fn: (tx: Tx, tenantId: string) => Promise<void>): Promise<void> {
  const { rows } = await db.execute<{ id: string }>(sql`select id from app_tenant_ids_for_jobs() as id`);
  const failures: unknown[] = [];
  for (const { id } of rows) {
    try {
      await runInContext(db, jobContext(id), (tx) => fn(tx, id));
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw new AggregateError(failures, `${failures.length} tenant(s) failed`);
}
```

In `ContextDb` (`database.module.ts`), add this method and add `forEachTenant` to its import from `./context`:
```ts
  /** Cross-tenant job sweeps (NFR-SEC-008). */
  forEachTenant(fn: (tx: Tx, tenantId: string) => Promise<void>): Promise<void> {
    return forEachTenant(this.db, fn);
  }
```

Create `app/src/infrastructure/queue/tenant-job.ts`:
```ts
import { UUID_PATTERN } from '../../database/context';

/** NFR-SEC-008: a job payload carries the tenant ID and record IDs only, never names, contact or health data. */
export type TenantJobPayload = { tenantId: string } & Record<string, string>;

export function assertIdsOnly(payload: Record<string, unknown>): asserts payload is TenantJobPayload {
  if (typeof payload.tenantId !== 'string') throw new Error('A job payload needs tenantId');
  for (const [field, value] of Object.entries(payload)) {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw new Error(`Job payload field "${field}" must be a record ID`);
    }
  }
}
```

Make three changes in `app/src/infrastructure/queue/queue.service.ts`:
- Add `import type { JobsOptions } from 'bullmq';` and `import { assertIdsOnly } from './tenant-job';`.
- Export the options and use them:
```ts
// NFR-SEC-008: failed jobs are kept for at most 7 days. Age-based removal in BullMQ is lazy (it runs only when
// another job finishes), so a quiet queue could keep one longer; removing at final failure meets the bound.
// The worker's 'failed' handler logs the job name, ID and error, which is what remains for investigation.
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: true,
};
```
  Replace the inline `defaultJobOptions: { ... }` with `defaultJobOptions: DEFAULT_JOB_OPTIONS`.
- Add the method:
```ts
  /** The only way to enqueue tenant work: payloads are checked to hold record IDs only (NFR-SEC-008). */
  async enqueueTenantJob(name: string, payload: Record<string, unknown>): Promise<void> {
    assertIdsOnly(payload);
    await this.queue.add(name, payload);
  }
```

- [ ] **Step 4: Run the tests**

Run: `npm run test -w api -- tests/tenant-jobs tests/isolation && npm run build -w api`
Expected: PASS.

- [ ] **Step 5: Commit (only when authorised)**

```bash
git add app/src/database app/src/infrastructure/queue tests/tenant-jobs.spec.ts tests/helpers/global-setup.ts
git commit -m "v2: tenant-scoped job runner, ID-only payloads, failed jobs removed at final failure (NFR-SEC-008)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Agency-path skeleton

This task covers PRD §19 Phase 1, "agency-path policy skeleton with a test fixture of one agency and one client". It adds the engagement tables and the predicate that the agency read policy will use. The policy that lets an agency read a client permit arrives with permits (Phases 3 and 4). Until then the generic suite proves that an agency reads nothing of its client.

**Files:**
- Create: `app/src/database/migrations/0007_engagements.sql`
- Create: `tests/agency-path.spec.ts`
- Modify: `app/src/database/schema/tenancy.ts`, `_journal.json`, `tests/helpers/fixtures.ts`, `tests/isolation.spec.ts`

**Interfaces:**
- Consumes: `organisations`, `legal_entities`, `plants` and `people` (Tasks 3, 6 and 7).
- Produces:
  - Tables `engagements` and `engagement_plants`, cross-tenant: the client writes, and both parties read. Exposed as Drizzle `engagements` and `engagementPlants`.
  - SQL predicate `app_agency_covers_plant(plant_id uuid) → boolean`: true when the request tenant is an agency with an active engagement covering that plant today. Phase 4 adds wind-down; Phase 3 moves the date to the test clock.
  - Fixture `engage(owner, client: TenantGraph, agency: TenantGraph, opts?) → engagementId`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/helpers/fixtures.ts`:
```ts
export async function engage(
  owner: Pool,
  client: TenantGraph,
  agency: TenantGraph,
  opts: { status?: string; startsInDays?: number; endsInDays?: number; plantIds?: string[] } = {},
): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into engagements (client_tenant_id, client_legal_entity_id, agency_tenant_id, status, starts_on, ends_on)
     values ($1, $2, $3, $4, current_date + $5::int, current_date + $6::int) returning id`,
    [client.tenantId, client.legalEntityId, agency.tenantId, opts.status ?? 'active', opts.startsInDays ?? -1, opts.endsInDays ?? 30],
  );
  for (const plantId of opts.plantIds ?? [client.plantId]) {
    await owner.query(`insert into engagement_plants (engagement_id, client_tenant_id, plant_id) values ($1, $2, $3)`, [
      rows[0].id,
      client.tenantId,
      plantId,
    ]);
  }
  return rows[0].id;
}
```

Create `tests/agency-path.spec.ts`:
```ts
import { sql } from 'drizzle-orm';
import { runInContext } from '../app/src/database/context';
import { connectApi, connectOwner, pgCode, pgErrorCode } from './helpers/db';
import { createTenantGraph, ctxOf, engage, insertPlant, TenantGraph } from './helpers/fixtures';

describe('Agency path skeleton (NFR-SEC-002, PRD §19 Phase 1)', () => {
  const owner = connectOwner();
  const api = connectApi();
  let client: TenantGraph;
  let agency: TenantGraph;
  let otherAgency: TenantGraph;
  let uncoveredPlant: string;
  let engagementId: string;

  const covers = (who: TenantGraph, plantId: string) =>
    runInContext(api.db, ctxOf(who), async (tx) =>
      (await tx.execute<{ ok: boolean }>(sql`select app_agency_covers_plant(${plantId}) as ok`)).rows[0].ok,
    );

  beforeAll(async () => {
    client = await createTenantGraph(owner);
    agency = await createTenantGraph(owner, 'agency');
    otherAgency = await createTenantGraph(owner, 'agency');
    uncoveredPlant = await insertPlant(owner, client.tenantId, client.legalEntityId);
    engagementId = await engage(owner, client, agency);
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('covers only the engaged plant, only for the engaged agency', async () => {
    expect(await covers(agency, client.plantId)).toBe(true);
    expect(await covers(agency, uncoveredPlant)).toBe(false);
    expect(await covers(otherAgency, client.plantId)).toBe(false);
  });

  it('stops covering when the engagement ends or has not started', async () => {
    await owner.query(`update engagements set status = 'ended' where id = $1`, [engagementId]);
    expect(await covers(agency, client.plantId)).toBe(false);
    await owner.query(`update engagements set status = 'active', starts_on = current_date + 1 where id = $1`, [engagementId]);
    expect(await covers(agency, client.plantId)).toBe(false);
    await owner.query(`update engagements set starts_on = current_date - 1 where id = $1`, [engagementId]);
  });

  it('lets the agency read its engagement but not change it', async () => {
    const seen = await runInContext(api.db, ctxOf(agency), async (tx) =>
      (await tx.execute<{ n: number }>(sql`select count(*)::int as n from engagements where id = ${engagementId}`)).rows[0].n,
    );
    expect(seen).toBe(1);
    const outcome = await runInContext(api.db, ctxOf(agency), (tx) =>
      tx.execute(sql`update engagements set ends_on = ends_on + 365 where id = ${engagementId}`),
    ).then((r) => `rows:${r.rowCount}`, (e) => `code:${pgCode(e)}`);
    expect(['rows:0', 'code:42501']).toContain(outcome);
  });

  it("gives the client no rows when it selects every column of any agency table (criterion 4)", async () => {
    const { rows: tables } = await owner.query<{ table: string }>(`
      select c.relname as table from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and exists (select 1 from pg_attribute t where t.attrelid = c.oid and t.attname = 'tenant_id' and not t.attisdropped)`);
    const problems: string[] = [];
    for (const { table } of tables) {
      // A table with full-record columns refuses `select *` outright (42501); any other must return no rows.
      const outcome = await runInContext(api.db, ctxOf(client), (tx) =>
        tx.execute(sql`select * from ${sql.identifier(table)} where tenant_id = ${agency.tenantId}`),
      ).then((r) => `rows:${r.rows.length}`, (e) => `code:${pgCode(e)}`);
      if (outcome !== 'rows:0' && outcome !== 'code:42501') problems.push(`${table}: ${outcome}`);
    }
    expect(problems).toEqual([]);
    expect(
      await pgErrorCode(runInContext(api.db, ctxOf(client), (tx) => tx.execute(sql`select email, phone from people where tenant_id = ${agency.tenantId}`))),
    ).toBe('42501');
  });
});
```

Make two changes in `tests/isolation.spec.ts`:
- Set `const CROSS_TENANT: Record<string, string[]> = { engagements: ['client_tenant_id', 'agency_tenant_id'], engagement_plants: ['client_tenant_id'] };`.
- In `beforeAll`, after the three `createTenantGraph` calls, add `await engage(owner, a, b);`, and add `engage` to the fixtures import.

Then add this test:
```ts
  it('shows an engagement only to its client and its agency', async () => {
    const problems: string[] = [];
    for (const [table, columns] of Object.entries(CROSS_TENANT)) {
      const where = sql.join(columns.map((c) => sql`${sql.identifier(c)} = ${a.tenantId}`), sql` or `);
      const n = async (ctx: DbContext) =>
        runInContext(api.db, ctx, async (tx) =>
          (await tx.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)} where ${where}`)).rows[0].n,
        );
      if ((await n(ctxOf(a))) < 1) problems.push(`${table}: client cannot see it`);
      if ((await n(ctxOf(b))) < 1) problems.push(`${table}: agency cannot see it`);
      for (const [who, ctx] of [['organisation x', ctxOf(x)], ['job without tenant', noTenantJobCtx], ['platform admin', platformCtx]] as [string, DbContext][]) {
        const seen = await n(ctx);
        if (seen !== 0) problems.push(`${table}: ${who} sees ${seen}`);
      }
    }
    expect(problems).toEqual([]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -w api -- tests/agency-path tests/isolation`
Expected: FAIL with `relation "engagements" does not exist`.

- [ ] **Step 3: Implement**

Create `app/src/database/migrations/0007_engagements.sql`:
```sql
-- FR-AGY-004 skeleton: the link between a client organisation and an agency. Phase 4 adds work types,
-- nominated receivers, invitations and wind-down. Both parties read it; only the client writes it.
CREATE TABLE engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES organisations (id),
  client_legal_entity_id uuid NOT NULL,
  agency_tenant_id uuid NOT NULL REFERENCES organisations (id),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'declined', 'ended', 'ended_now')),
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_tenant_id, id),
  FOREIGN KEY (client_tenant_id, client_legal_entity_id) REFERENCES legal_entities (tenant_id, id),
  CHECK (client_tenant_id <> agency_tenant_id)
);
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements FORCE ROW LEVEL SECURITY;
CREATE POLICY engagement_parties_read ON engagements FOR SELECT
  USING ((SELECT app_context_valid()) AND app_tenant_id() IN (client_tenant_id, agency_tenant_id));
CREATE POLICY engagement_client_insert ON engagements FOR INSERT
  WITH CHECK ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());
CREATE POLICY engagement_client_update ON engagements FOR UPDATE
  USING ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id())
  WITH CHECK ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());
CREATE POLICY engagement_client_delete ON engagements FOR DELETE
  USING ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());

CREATE TABLE engagement_plants (
  engagement_id uuid NOT NULL,
  client_tenant_id uuid NOT NULL,
  plant_id uuid NOT NULL,
  PRIMARY KEY (engagement_id, plant_id),
  FOREIGN KEY (client_tenant_id, engagement_id) REFERENCES engagements (client_tenant_id, id),
  FOREIGN KEY (client_tenant_id, plant_id) REFERENCES plants (tenant_id, id)
);
ALTER TABLE engagement_plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_plants FORCE ROW LEVEL SECURITY;
CREATE POLICY engagement_plants_parties_read ON engagement_plants FOR SELECT
  USING ((SELECT app_context_valid())
         AND (client_tenant_id = app_tenant_id()
              OR EXISTS (SELECT 1 FROM engagements e WHERE e.id = engagement_id AND e.agency_tenant_id = app_tenant_id())));
CREATE POLICY engagement_plants_client_insert ON engagement_plants FOR INSERT
  WITH CHECK ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());
CREATE POLICY engagement_plants_client_update ON engagement_plants FOR UPDATE
  USING ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id())
  WITH CHECK ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());
CREATE POLICY engagement_plants_client_delete ON engagement_plants FOR DELETE
  USING ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());

-- NFR-SEC-002 (a) building block: the request tenant is an agency with an active engagement covering this
-- client plant today. Used by the agency read policies on permits (Phases 3 and 4). Phase 4 adds wind-down;
-- Phase 3 replaces current_date with the test clock (NFR-TST-001).
CREATE FUNCTION app_agency_covers_plant(p_plant_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM engagements e
      JOIN engagement_plants ep ON ep.engagement_id = e.id
     WHERE ep.plant_id = p_plant_id
       AND e.agency_tenant_id = app_tenant_id()
       AND e.status = 'active'
       AND current_date BETWEEN e.starts_on AND e.ends_on)
$$;
```

Append to `entries` in `_journal.json`:
```json
    { "idx": 7, "version": "7", "when": 1791072420000, "tag": "0007_engagements", "breakpoints": true }
```

Append to `app/src/database/schema/tenancy.ts`, adding `date` and `timestamp` to its imports. The primary key `(engagement_id, plant_id)` lives in the SQL migration only:
```ts
export const engagements = pgTable('engagements', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientTenantId: uuid('client_tenant_id').notNull(),
  clientLegalEntityId: uuid('client_legal_entity_id').notNull(),
  agencyTenantId: uuid('agency_tenant_id').notNull(),
  status: text('status', { enum: ['invited', 'active', 'declined', 'ended', 'ended_now'] }).notNull().default('invited'),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const engagementPlants = pgTable('engagement_plants', {
  engagementId: uuid('engagement_id').notNull(),
  clientTenantId: uuid('client_tenant_id').notNull(),
  plantId: uuid('plant_id').notNull(),
});
```

- [ ] **Step 4: Run the tests**

Run: `npm run test -w api -- tests/agency-path tests/isolation tests/schema-security`
Expected: PASS.

- [ ] **Step 5: Commit (only when authorised)**

```bash
git add app/src/database tests/agency-path.spec.ts tests/isolation.spec.ts tests/helpers/fixtures.ts
git commit -m "v2: engagement tables and agency coverage predicate; client and agency fixture (NFR-SEC-002 skeleton)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Lawful basis, privacy notices and consent

**Gate (O5, PRD §22 R4).** Do not start this task until counsel's accepted outcome is recorded in `.planning/2026-10-03-prd-restructure/findings.md`.
- The outcome covers the lawful basis per data category, the notice text and the translations.
- If counsel changed the PRD, the PRD is amended and approved first, and this task follows the amended text.
- Step 1 checks this.

**Files:**
- Create: `packages/shared/src/privacy.ts`
- Create: `app/src/database/migrations/0008_consent.sql`
- Create: `app/src/modules/privacy/sensitive-fields.ts`, `app/src/modules/privacy/consent.service.ts`
- Create: `tests/consent.spec.ts`
- Modify:
  - Shared: `packages/shared/src/index.ts`.
  - Database: `app/src/database/schema/people.ts`, `app/src/database/schema/privacy.ts`, `_journal.json`.
  - Tests: `tests/helpers/fixtures.ts`, `tests/helpers/services.ts`, `tests/schema-security.spec.ts`.

**Interfaces:**
- Consumes:
  - `PermissionService.isLegalEntityAdmin` (Task 8)
  - `AuditWriter.record` (Task 9)
- Produces, in `@ptw/shared`:
  - `DATA_CATEGORIES` and `type DataCategory`
  - `LAWFUL_BASES` and `type LawfulBasis`
  - `DEFAULT_LAWFUL_BASES`
- Produces, as tables:
  - `lawful_bases`
  - `privacy_notices` (append-only)
  - `consents` (append-only)
  - `person_private_data`, which Task 14 writes encrypted values into

  with Drizzle `lawfulBases`, `privacyNotices`, `consents` and `personPrivateData`.
- Produces, in `sensitive-fields.ts`:
  - `SENSITIVE_FIELDS`, `type SensitiveField`
  - `CATEGORY_FIELDS`: every stored field per data category, with `FIELD_CATEGORY` derived from it
  - `FIELD_COLUMN`
- Produces in `ConsentService`:
  - `setLawfulBasis(tx, ctx, { legalEntityId, category, purpose, bases, changeReason? }): Promise<void>`
  - `requiresConsent(tx, legalEntityId, category): Promise<boolean>`
  - `record(tx, ctx, { personId, category, noticeId, decision, signedOn?, formFileKey? }): Promise<void>`. This is the only consent operation. Any decision that leaves consent not in force deletes every stored field of the category in the same transaction, contact fields included.
  - `hasConsent(tx, personId, category): Promise<boolean>`, which uses `decisionInForce` (exported, pure):
    - it looks only at the latest decision date;
    - when every decision that day was made in the app, the last one counts;
    - when that day includes a signed form, consent counts only if every decision that day is "given".
  - `categoriesToAsk(tx, personId): Promise<DataCategory[]>`
- Produces in the test fixtures: `insertNotice(owner, tenantId, legalEntityId, version) → id`

- [ ] **Step 1: Check the counsel gate**

Run: `grep -n "Counsel review (R4)" .planning/2026-10-03-prd-restructure/findings.md`
Expected: a dated entry recording counsel's accepted outcome. If there is none, stop and report to the owner: Tasks 13 and 14 wait. If the entry changes a default in FR-PRV-001, use the amended PRD values in Step 4 instead of those shown.

- [ ] **Step 2: Write the failing tests**

Add to `tests/helpers/fixtures.ts`:
```ts
export async function insertNotice(owner: Pool, tenantId: string, legalEntityId: string, version: number): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into privacy_notices (tenant_id, legal_entity_id, version, notice_text, consent_text) values ($1, $2, $3, $4, $5) returning id`,
    [tenantId, legalEntityId, version, `Notice v${version}`, `Consent wording v${version}`],
  );
  return rows[0].id;
}
```

In `tests/helpers/services.ts`:
- Add the import `import { ConsentService } from '../../app/src/modules/privacy/consent.service';`.
- Add `const consent = new ConsentService(permissions, audit);` inside `services()`.
- Add `consent` to the returned object.

Create `tests/consent.spec.ts`:
```ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DbContext, runInContext, Tx } from '../app/src/database/context';
import { decisionInForce } from '../app/src/modules/privacy/consent.service';
import { connectApi, connectOwner, pgErrorCode, userCtx } from './helpers/db';
import {
  assignRole,
  insertDefaultRoles,
  insertLegalEntity,
  insertNotice,
  insertOrganisation,
  insertPerson,
  insertPlant,
  makeAdmin,
} from './helpers/fixtures';
import { services } from './helpers/services';

describe('Lawful basis and consent (FR-PRV-001, 002, 011)', () => {
  const owner = connectOwner();
  const api = connectApi();
  const { consent, permissions } = services();
  let tenant: string;
  let entity: string;
  let otherEntity: string;
  let noticeV1: string;
  let otherEntityNotice: string;
  let self: string;
  let crewOnly: string;
  let admin: string;
  let otherAdmin: string;
  let colleague: string;

  const ctx = (personId: string): DbContext => userCtx(tenant, personId, [entity, otherEntity]);
  const as = <T>(personId: string, fn: (tx: Tx) => Promise<T>) => runInContext(api.db, ctx(personId), fn);
  const today = () => new Date().toISOString().slice(0, 10);
  const stored = async (personId: string) =>
    (await owner.query(
      `select blood_group is not null as blood, health_conditions is not null as health, emergency_contacts is not null as contacts
         from person_private_data where person_id = $1`,
      [personId],
    )).rows[0];
  const seedPrivate = (personId: string) =>
    owner.query(
      `insert into person_private_data (person_id, tenant_id, blood_group, health_conditions, emergency_contacts)
       values ($1, $2, '\\x01', '\\x02', '\\x03')
       on conflict (person_id) do update set blood_group = '\\x01', health_conditions = '\\x02', emergency_contacts = '\\x03'`,
      [personId, tenant],
    );

  beforeAll(async () => {
    tenant = await insertOrganisation(owner);
    entity = await insertLegalEntity(owner, tenant);
    otherEntity = await insertLegalEntity(owner, tenant);
    self = (await insertPerson(owner, tenant, entity)).personId;
    crewOnly = (await insertPerson(owner, tenant, entity, { accountId: null })).personId;
    admin = (await insertPerson(owner, tenant, entity)).personId;
    otherAdmin = (await insertPerson(owner, tenant, otherEntity)).personId;
    colleague = (await insertPerson(owner, tenant, entity)).personId;
    await makeAdmin(owner, { tenantId: tenant, personId: admin, role: 'LEGAL_ORG_ADMIN', legalEntityId: entity });
    await makeAdmin(owner, { tenantId: tenant, personId: otherAdmin, role: 'LEGAL_ORG_ADMIN', legalEntityId: otherEntity });
    noticeV1 = await insertNotice(owner, tenant, entity, 1);
    otherEntityNotice = await insertNotice(owner, tenant, otherEntity, 1);
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('uses the platform defaults: blood group and health need consent, emergency contacts never do', async () => {
    const needs = (category: 'blood_group' | 'health_conditions' | 'emergency_contacts' | 'identity') =>
      as(self, (tx) => consent.requiresConsent(tx, entity, category));
    expect(await needs('blood_group')).toBe(true);
    expect(await needs('health_conditions')).toBe(true);
    expect(await needs('emergency_contacts')).toBe(false);
    expect(await needs('identity')).toBe(false);
  });

  it('changes a default only with a recorded reason, and never makes emergency contacts or the sign-in identity depend on consent', async () => {
    const set = (bases: ('consent' | 'employment' | 'vital_interest')[], category: 'health_conditions' | 'emergency_contacts' | 'sign_in', changeReason?: string) =>
      as(admin, (tx) => consent.setLawfulBasis(tx, ctx(admin), { legalEntityId: entity, category, purpose: 'Emergency care', bases, changeReason }));
    await expect(set(['employment'], 'health_conditions')).rejects.toBeInstanceOf(BadRequestException);
    await set(['employment', 'vital_interest'], 'health_conditions', 'Occupational health law, s.12');
    expect(await as(self, (tx) => consent.requiresConsent(tx, entity, 'health_conditions'))).toBe(false);
    await set(['consent'], 'health_conditions');
    expect(await pgErrorCode(set(['consent'], 'emergency_contacts', 'Counsel advice'))).toBe('23514');
    expect(await pgErrorCode(set(['consent'], 'sign_in', 'Counsel advice'))).toBe('23514');
  });

  it('records in-app consent against the notice shown, and an admin record only with the signed form and its date', async () => {
    await as(self, (tx) => consent.record(tx, ctx(self), { personId: self, category: 'blood_group', noticeId: noticeV1, decision: 'given' }));
    expect(await as(self, (tx) => consent.hasConsent(tx, self, 'blood_group'))).toBe(true);

    const adminRecord = (extra: { formFileKey?: string; signedOn?: string }) =>
      as(admin, (tx) => consent.record(tx, ctx(admin), { personId: crewOnly, category: 'blood_group', noticeId: noticeV1, decision: 'given', ...extra }));
    await expect(adminRecord({ signedOn: today() })).rejects.toBeInstanceOf(BadRequestException);
    await expect(adminRecord({ formFileKey: 'forms/crew-1.pdf' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(adminRecord({ formFileKey: 'forms/crew-1.pdf', signedOn: '2999-01-01' })).rejects.toBeInstanceOf(BadRequestException);
    await adminRecord({ formFileKey: 'forms/crew-1.pdf', signedOn: today() });
    const { rows } = await owner.query(`select method, decided_on::text as decided from consents where person_id = $1`, [crewOnly]);
    expect(rows).toEqual([{ method: 'admin_form', decided: today() }]);
  });

  it("refuses consent recorded by anyone else, against another entity's notice, or for data that does not rely on consent", async () => {
    for (const actor of [colleague, otherAdmin]) {
      await expect(
        as(actor, (tx) => consent.record(tx, ctx(actor), { personId: self, category: 'blood_group', noticeId: noticeV1, decision: 'given', formFileKey: 'f.pdf', signedOn: today() })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    await expect(
      as(self, (tx) => consent.record(tx, ctx(self), { personId: self, category: 'blood_group', noticeId: otherEntityNotice, decision: 'given' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    for (const category of ['emergency_contacts', 'sign_in'] as const) {
      await expect(
        as(self, (tx) => consent.record(tx, ctx(self), { personId: self, category, noticeId: noticeV1, decision: 'withdrawn' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('deletes consent-based data at once on every withdrawing decision, and keeps data that does not rely on consent', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    for (const category of ['blood_group', 'health_conditions'] as const) {
      await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category, noticeId: noticeV1, decision: 'given' }));
    }
    await seedPrivate(person);
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'withdrawn' }));
    expect(await stored(person)).toEqual({ blood: false, health: true, contacts: true });
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'health_conditions', noticeId: noticeV1, decision: 'withheld' }));
    expect(await stored(person)).toEqual({ blood: false, health: false, contacts: true });

    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'given' }));
    await seedPrivate(person);
    await as(admin, (tx) =>
      consent.record(tx, ctx(admin), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'withdrawn', formFileKey: 'forms/w.pdf', signedOn: today() }),
    );
    expect((await stored(person)).blood).toBe(false);
  });

  it('keeps the decision date order: an older signed form entered later does not restore withdrawn consent', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'withdrawn' }));
    const lastWeek = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    await owner.query(`update privacy_notices set published_at = now() - interval '30 days' where id = $1`, [noticeV1]);
    await as(admin, (tx) =>
      consent.record(tx, ctx(admin), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'given', formFileKey: 'forms/old.pdf', signedOn: lastWeek }),
    );
    expect(await as(person, (tx) => consent.hasConsent(tx, person, 'blood_group'))).toBe(false);
  });

  it('never lets a same-day signed form override a timed decision it cannot be ordered against (R2-SPEC-01)', () => {
    const at = (hhmm: string) => new Date(`2026-10-04T${hhmm}:00Z`);
    // Form signed at 09:00 (time unknown to us), withdrawal in the app at 12:00, form uploaded at 16:00.
    expect(decisionInForce([
      { decision: 'withdrawn', decidedAt: at('12:00'), version: 1 },
      { decision: 'given', decidedAt: null, version: 1 },
    ])?.given).toBe(false);
    // All decisions in the app: the last one counts, so changing one's mind the same day works.
    expect(decisionInForce([
      { decision: 'withdrawn', decidedAt: at('10:00'), version: 1 },
      { decision: 'given', decidedAt: at('12:00'), version: 1 },
    ])?.given).toBe(true);
    expect(decisionInForce([{ decision: 'given', decidedAt: null, version: 1 }])?.given).toBe(true);
    expect(decisionInForce([])).toBeNull();
  });

  it('gives the same answer for two in-app decisions at the same millisecond, in either row order (R3-SPEC-02)', () => {
    const tie = new Date('2026-10-04T12:00:00.123Z');
    const grant = { decision: 'given' as const, decidedAt: tie, version: 1 };
    const withdrawal = { decision: 'withdrawn' as const, decidedAt: tie, version: 1 };
    expect(decisionInForce([grant, withdrawal])?.given).toBe(false);
    expect(decisionInForce([withdrawal, grant])?.given).toBe(false);
    // One millisecond apart, the later decision counts.
    expect(decisionInForce([withdrawal, { ...grant, decidedAt: new Date(tie.getTime() + 1) }])?.given).toBe(true);
    expect(decisionInForce([grant, grant])?.given).toBe(true);
  });

  it('keeps a same-day in-app withdrawal in force when a form signed that morning is uploaded later', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'given' }));
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'withdrawn' }));
    await as(admin, (tx) =>
      consent.record(tx, ctx(admin), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'given', formFileKey: 'forms/morning.pdf', signedOn: today() }),
    );
    expect(await as(person, (tx) => consent.hasConsent(tx, person, 'blood_group'))).toBe(false);
  });

  it('deletes only optional contact details when a permit-duty holder withdraws contact consent; sign-in, access and duties stay (D31)', async () => {
    await as(otherAdmin, (tx) =>
      consent.setLawfulBasis(tx, ctx(otherAdmin), { legalEntityId: otherEntity, category: 'contact', purpose: 'Contact', bases: ['consent'], changeReason: 'Counsel advice' }),
    );
    const { personId: coordinator, accountId } = await insertPerson(owner, tenant, otherEntity);
    const plant = await insertPlant(owner, tenant, otherEntity);
    const roleIds = await insertDefaultRoles(owner, tenant, otherEntity);
    await assignRole(owner, { tenantId: tenant, personId: coordinator, plantId: plant, legalEntityId: otherEntity, roleId: roleIds.PTW_PERMIT_COORDINATOR });
    await owner.query(`update people set phone = '+91 98000 77777' where id = $1`, [coordinator]);
    const elsewhere = await insertOrganisation(owner);
    const { personId: elsewherePerson } = await insertPerson(owner, elsewhere, await insertLegalEntity(owner, elsewhere), { accountId });
    await owner.query(`update people set phone = '+91 98000 66666' where id = $1`, [elsewherePerson]);
    const decide = (decision: 'given' | 'withdrawn') =>
      as(coordinator, (tx) => consent.record(tx, ctx(coordinator), { personId: coordinator, category: 'contact', noticeId: otherEntityNotice, decision }));
    await decide('given');
    await seedPrivate(coordinator);
    await decide('withdrawn');
    const { rows } = await owner.query(`select id, email is not null as signs_in, phone, account_id from people where id in ($1, $2)`, [coordinator, elsewherePerson]);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId[coordinator]).toMatchObject({ signs_in: true, phone: null, account_id: accountId });
    expect(byId[elsewherePerson]).toMatchObject({ signs_in: true, phone: '+91 98000 66666', account_id: accountId });
    // The context still passes the database's membership check, and the role still grants its permit duties.
    expect(await as(coordinator, (tx) => permissions.holds(tx, coordinator, 'issue_permit', plant, null))).toBe(true);
    expect((await stored(coordinator)).contacts).toBe(true); // emergency contacts rely on employment and vital interest
  });

  it('attributes consent to the wording actually shown or signed, and asks again after new wording (FR-PRV-011)', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'health_conditions', noticeId: noticeV1, decision: 'withheld' }));
    const noticeV2 = await insertNotice(owner, tenant, entity, 2);
    // The screen still showed version 1 when the person tapped "Give consent": recorded under version 1.
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'given' }));
    const { rows } = await owner.query(
      `select n.version from consents c join privacy_notices n on n.id = c.notice_id where c.person_id = $1 and c.category = 'blood_group'`,
      [person],
    );
    expect(rows).toEqual([{ version: 1 }]);
    expect(await as(person, (tx) => consent.categoriesToAsk(tx, person))).toEqual(['blood_group', 'health_conditions']);
    expect(await as(person, (tx) => consent.hasConsent(tx, person, 'blood_group'))).toBe(true);
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV2, decision: 'given' }));
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'health_conditions', noticeId: noticeV2, decision: 'withheld' }));
    expect(await as(person, (tx) => consent.categoriesToAsk(tx, person))).toEqual([]);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npm run test -w api -- tests/consent`
Expected: FAIL. TypeScript reports that `consent.service` cannot be found.

- [ ] **Step 4: Implement**

Create `packages/shared/src/privacy.ts`:
```ts
/** FR-PRV-001: personal-data categories, each with a purpose and lawful basis per legal entity or agency. */
export const DATA_CATEGORIES = [
  'identity', 'sign_in', 'contact', 'emergency_contacts', 'blood_group', 'health_conditions', 'employment_history',
  'checkin_location', 'photo',
] as const;
export type DataCategory = (typeof DATA_CATEGORIES)[number];

export const LAWFUL_BASES = ['legal_obligation', 'employment', 'vital_interest', 'consent'] as const;
export type LawfulBasis = (typeof LAWFUL_BASES)[number];

/** FR-PRV-001 platform defaults (as approved after counsel review, O5). An admin changes one only after recording the legal reason. */
export const DEFAULT_LAWFUL_BASES: Partial<Record<DataCategory, readonly LawfulBasis[]>> = {
  blood_group: ['consent'],
  health_conditions: ['consent'],
  emergency_contacts: ['employment', 'vital_interest'],
  // D31: sign-in, tenant access and the account identity used for segregation of duties need it.
  sign_in: ['employment'],
};
```
Add `export * from './privacy';` to `packages/shared/src/index.ts`.

Create `app/src/database/migrations/0008_consent.sql`:
```sql
-- FR-PRV-001: purpose and lawful basis per data category, per legal entity (or agency legal entity).
CREATE TABLE lawful_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('identity', 'sign_in', 'contact', 'emergency_contacts', 'blood_group', 'health_conditions', 'employment_history', 'checkin_location', 'photo')),
  purpose text NOT NULL,
  bases text[] NOT NULL CHECK (cardinality(bases) > 0 AND bases <@ ARRAY['legal_obligation', 'employment', 'vital_interest', 'consent']::text[]),
  change_reason text,
  updated_by_person_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legal_entity_id, category),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id),
  FOREIGN KEY (tenant_id, updated_by_person_id) REFERENCES people (tenant_id, id),
  -- Emergency contacts (FR-PRV-001) and the sign-in identity (D31) never depend on consent.
  CONSTRAINT required_data_never_needs_consent CHECK (category NOT IN ('emergency_contacts', 'sign_in') OR NOT ('consent' = ANY (bases)))
);
SELECT app_apply_tenant_policy('lawful_bases');

-- Versioned wording. A published version never changes; new wording is a new version.
CREATE TABLE privacy_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  notice_text text NOT NULL,
  consent_text text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (legal_entity_id, version),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id)
);
SELECT app_apply_tenant_policy('privacy_notices');
REVOKE UPDATE, DELETE ON privacy_notices FROM ptw_api;

-- FR-PRV-002: every consent decision is kept, bound to the wording version shown or signed. decided_on is the
-- day the person decided; decided_at is the moment, known only for in-app decisions (a signed form has a date,
-- not a time). recorded_at is when the server received it and is never used to order decisions.
-- The decision in force comes from the latest decided_on: the last timed decision that day, or, if that day
-- has a form, "given" only when every decision that day is "given" (ConsentService.decisionInForce).
CREATE TABLE consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('identity', 'sign_in', 'contact', 'emergency_contacts', 'blood_group', 'health_conditions', 'employment_history', 'checkin_location', 'photo')),
  notice_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('given', 'withheld', 'withdrawn')),
  method text NOT NULL CHECK (method IN ('in_app', 'admin_form')),
  form_file_key text,
  decided_on date NOT NULL,
  decided_at timestamptz,
  recorded_by_person_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id),
  FOREIGN KEY (tenant_id, notice_id) REFERENCES privacy_notices (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by_person_id) REFERENCES people (tenant_id, id),
  CONSTRAINT admin_recorded_consent_has_form CHECK (method <> 'admin_form' OR form_file_key IS NOT NULL),
  CONSTRAINT only_in_app_decisions_are_timed CHECK ((method = 'in_app') = (decided_at IS NOT NULL))
);
CREATE INDEX consents_by_day ON consents (person_id, category, decided_on DESC);
SELECT app_apply_tenant_policy('consents');
REVOKE UPDATE, DELETE ON consents FROM ptw_api;

-- NFR-SEC-003: sensitive person fields, encrypted by the application (Task 14). Consent-based columns are
-- cleared by ConsentService whenever consent stops being in force.
CREATE TABLE person_private_data (
  person_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  blood_group bytea,
  health_conditions bytea,
  emergency_contacts bytea,
  identity_document_number bytea,
  employment_history bytea,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id)
);
SELECT app_apply_tenant_policy('person_private_data');
```

Append to `entries` in `_journal.json`:
```json
    { "idx": 8, "version": "7", "when": 1791072480000, "tag": "0008_consent", "breakpoints": true }
```

Append to `app/src/database/schema/privacy.ts` (its imports already cover these columns; add `date`):
```ts
export const lawfulBases = pgTable('lawful_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  category: text('category').notNull(),
  purpose: text('purpose').notNull(),
  bases: text('bases').array().notNull(),
  changeReason: text('change_reason'),
  updatedByPersonId: uuid('updated_by_person_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const privacyNotices = pgTable('privacy_notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  version: integer('version').notNull(),
  noticeText: text('notice_text').notNull(),
  consentText: text('consent_text').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});

export const consents = pgTable('consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  category: text('category').notNull(),
  noticeId: uuid('notice_id').notNull(),
  decision: text('decision', { enum: ['given', 'withheld', 'withdrawn'] }).notNull(),
  method: text('method', { enum: ['in_app', 'admin_form'] }).notNull(),
  formFileKey: text('form_file_key'),
  decidedOn: date('decided_on').notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  recordedByPersonId: uuid('recorded_by_person_id').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Append to `app/src/database/schema/people.ts`, adding `customType` to its imports:
```ts
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const personPrivateData = pgTable('person_private_data', {
  personId: uuid('person_id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  bloodGroup: bytea('blood_group'),
  healthConditions: bytea('health_conditions'),
  emergencyContacts: bytea('emergency_contacts'),
  identityDocumentNumber: bytea('identity_document_number'),
  employmentHistory: bytea('employment_history'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Create `app/src/modules/privacy/sensitive-fields.ts`:
```ts
import type { DataCategory } from '@ptw/shared';
import type { personPrivateData } from '../../database/schema';

/** NFR-SEC-003: the encrypted person fields, each with its FR-PRV-001 data category and column. */
export const SENSITIVE_FIELDS = [
  'blood_group', 'health_conditions', 'emergency_contacts', 'identity_document_number', 'employment_history',
] as const;
export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

/**
 * Every stored field of each data category, so a withdrawing decision deletes all of it (FR-PRV-002):
 * encrypted fields in person_private_data and plain columns on people. A category with no stored field in
 * Phase 1a lists none; the phase that first stores such data (photos, check-in locations) adds it here.
 * Record<DataCategory, …> makes the list complete at compile time.
 */
export const CATEGORY_FIELDS: Record<DataCategory, { encrypted: readonly SensitiveField[]; people: readonly ('email' | 'phone')[] }> = {
  identity: { encrypted: ['identity_document_number'], people: [] },
  sign_in: { encrypted: [], people: ['email'] }, // D31: never consent-based (CHECK on lawful_bases), so never deleted by a withdrawal
  contact: { encrypted: [], people: ['phone'] }, // optional contact details only (D31)
  emergency_contacts: { encrypted: ['emergency_contacts'], people: [] }, // never consent-based (CHECK on lawful_bases)
  blood_group: { encrypted: ['blood_group'], people: [] },
  health_conditions: { encrypted: ['health_conditions'], people: [] },
  employment_history: { encrypted: ['employment_history'], people: [] },
  checkin_location: { encrypted: [], people: [] },
  photo: { encrypted: [], people: [] },
};

export const FIELD_CATEGORY = Object.fromEntries(
  (Object.entries(CATEGORY_FIELDS) as [DataCategory, (typeof CATEGORY_FIELDS)[DataCategory]][]).flatMap(([category, fields]) =>
    fields.encrypted.map((field) => [field, category]),
  ),
) as Record<SensitiveField, DataCategory>;

export const FIELD_COLUMN = {
  blood_group: 'bloodGroup',
  health_conditions: 'healthConditions',
  emergency_contacts: 'emergencyContacts',
  identity_document_number: 'identityDocumentNumber',
  employment_history: 'employmentHistory',
} as const satisfies Record<SensitiveField, keyof typeof personPrivateData.$inferSelect>;
```

Create `app/src/modules/privacy/consent.service.ts`:
```ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DATA_CATEGORIES, DEFAULT_LAWFUL_BASES, type DataCategory, type LawfulBasis } from '@ptw/shared';
import type { DbContext, Tx } from '../../database/context';
import { consents, lawfulBases, people, personPrivateData, privacyNotices } from '../../database/schema';
import { PermissionService } from '../access/permission.service';
import { AuditWriter } from '../audit/audit-writer';
import { CATEGORY_FIELDS, FIELD_COLUMN } from './sensitive-fields';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Decision = { decision: 'given' | 'withheld' | 'withdrawn'; decidedAt: Date | null; version: number };

/**
 * The decision in force, from the decisions made on the latest decision date. Only decisions that cannot be
 * ordered against each other decide, and consent is in force only if all of them are "given":
 * - a day with a signed form (date only, no time): every decision that day decides;
 * - otherwise: the decisions at the day's latest instant decide (usually one; two at the same millisecond tie).
 * A same-day withdrawal therefore always wins against a form or a tie, whatever the row order. Server receipt
 * time is never used as the order of the person's decisions (FR-PRV-002).
 */
export function decisionInForce(day: Decision[]): { given: boolean; version: number } | null {
  if (day.length === 0) return null;
  const untimed = day.some((d) => d.decidedAt === null);
  const latest = untimed ? 0 : Math.max(...day.map((d) => (d.decidedAt as Date).getTime()));
  const deciding = untimed ? day : day.filter((d) => (d.decidedAt as Date).getTime() === latest);
  return { given: deciding.every((d) => d.decision === 'given'), version: Math.min(...deciding.map((d) => d.version)) };
}

@Injectable()
export class ConsentService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly audit: AuditWriter,
  ) {}

  /** FR-PRV-001: purpose and lawful basis per category. Changing a platform default needs a recorded reason. */
  async setLawfulBasis(
    tx: Tx,
    ctx: DbContext,
    input: { legalEntityId: string; category: DataCategory; purpose: string; bases: LawfulBasis[]; changeReason?: string },
  ): Promise<void> {
    await this.requireLegalEntityAdmin(tx, ctx, input.legalEntityId);
    const platformDefault = DEFAULT_LAWFUL_BASES[input.category];
    const differs = platformDefault !== undefined && [...platformDefault].sort().join() !== [...input.bases].sort().join();
    if (differs && !input.changeReason?.trim()) {
      throw new BadRequestException('Record the legal reason before changing the platform default');
    }
    const [before] = await tx
      .select()
      .from(lawfulBases)
      .where(and(eq(lawfulBases.legalEntityId, input.legalEntityId), eq(lawfulBases.category, input.category)));
    const values = {
      tenantId: ctx.tenantId as string,
      legalEntityId: input.legalEntityId,
      category: input.category,
      purpose: input.purpose,
      bases: input.bases,
      changeReason: input.changeReason ?? null,
      updatedByPersonId: ctx.personId as string,
      updatedAt: new Date(),
    };
    await tx.insert(lawfulBases).values(values).onConflictDoUpdate({ target: [lawfulBases.legalEntityId, lawfulBases.category], set: values });
    await this.audit.record(tx, ctx, {
      action: 'lawful_basis.set',
      entityType: 'lawful_basis',
      legalEntityId: input.legalEntityId,
      before: before ? { category: before.category, purpose: before.purpose, bases: before.bases } : {},
      after: { category: input.category, purpose: input.purpose, bases: input.bases, change_reason: input.changeReason ?? null },
    });
  }

  async requiresConsent(tx: Tx, legalEntityId: string, category: DataCategory): Promise<boolean> {
    const [row] = await tx
      .select({ bases: lawfulBases.bases })
      .from(lawfulBases)
      .where(and(eq(lawfulBases.legalEntityId, legalEntityId), eq(lawfulBases.category, category)));
    return (row?.bases ?? DEFAULT_LAWFUL_BASES[category] ?? []).includes('consent');
  }

  /**
   * FR-PRV-002, the only consent operation. Recorded by the person in the app against the notice they were
   * shown, or by their employer's admin from the signed form (wording version, signature date, file). Any
   * decision that leaves consent not in force deletes the data that relies on it, in this transaction.
   * The person row is locked, so this serialises with PersonalDataService.write.
   */
  async record(
    tx: Tx,
    ctx: DbContext,
    input: {
      personId: string;
      category: DataCategory;
      noticeId: string;
      decision: 'given' | 'withheld' | 'withdrawn';
      signedOn?: string;
      formFileKey?: string;
    },
  ): Promise<void> {
    const [subject] = await tx
      .select({ id: people.id, tenantId: people.tenantId, employerLegalEntityId: people.employerLegalEntityId })
      .from(people)
      .where(eq(people.id, input.personId))
      .for('update');
    if (!subject) throw new NotFoundException('Person not found');
    const self = ctx.personId === subject.id;
    if (!self) await this.requireLegalEntityAdmin(tx, ctx, subject.employerLegalEntityId);
    if (!(await this.requiresConsent(tx, subject.employerLegalEntityId, input.category))) {
      throw new BadRequestException(`${input.category.replace(/_/g, ' ')} does not rely on consent`);
    }
    const [notice] = await tx
      .select({ id: privacyNotices.id, version: privacyNotices.version, legalEntityId: privacyNotices.legalEntityId, publishedAt: privacyNotices.publishedAt })
      .from(privacyNotices)
      .where(eq(privacyNotices.id, input.noticeId));
    if (!notice || notice.legalEntityId !== subject.employerLegalEntityId) {
      throw new BadRequestException("That privacy notice is not the employer's");
    }
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    let decidedOn = today;
    if (!self) {
      if (!input.formFileKey) throw new BadRequestException('Attach the signed consent form');
      if (!input.signedOn || !DATE.test(input.signedOn)) throw new BadRequestException('Give the date the form was signed');
      if (input.signedOn > today || input.signedOn < notice.publishedAt.toISOString().slice(0, 10)) {
        throw new BadRequestException('The signature date must be between the notice publication and today');
      }
      decidedOn = input.signedOn;
    }
    await tx.insert(consents).values({
      tenantId: subject.tenantId,
      personId: subject.id,
      category: input.category,
      noticeId: notice.id,
      decision: input.decision,
      method: self ? 'in_app' : 'admin_form',
      formFileKey: self ? null : (input.formFileKey ?? null),
      decidedOn,
      decidedAt: self ? now : null,
      recordedByPersonId: ctx.personId as string,
    });
    await this.audit.record(tx, ctx, {
      action: `consent.${input.decision}`,
      entityType: 'person',
      entityId: subject.id,
      after: { category: input.category, notice_version: notice.version, decided_on: decidedOn },
    });
    if (!(await this.hasConsent(tx, subject.id, input.category))) {
      await this.deleteDependentData(tx, ctx, subject.id, input.category);
      // Telling the employer's admin (FR-PRV-002) arrives with notifications in Phase 2.
    }
  }

  async hasConsent(tx: Tx, personId: string, category: DataCategory): Promise<boolean> {
    return decisionInForce(await this.latestDay(tx, personId, category))?.given ?? false;
  }

  /** FR-PRV-011: consent categories whose decision in force was made under older wording (or never made). */
  async categoriesToAsk(tx: Tx, personId: string): Promise<DataCategory[]> {
    const [subject] = await tx
      .select({ employerLegalEntityId: people.employerLegalEntityId })
      .from(people)
      .where(eq(people.id, personId));
    if (!subject) throw new NotFoundException('Person not found');
    const [notice] = await tx
      .select({ version: privacyNotices.version })
      .from(privacyNotices)
      .where(eq(privacyNotices.legalEntityId, subject.employerLegalEntityId))
      .orderBy(desc(privacyNotices.version))
      .limit(1);
    if (!notice) return [];
    const ask: DataCategory[] = [];
    for (const category of DATA_CATEGORIES) {
      if (!(await this.requiresConsent(tx, subject.employerLegalEntityId, category))) continue;
      const inForce = decisionInForce(await this.latestDay(tx, personId, category));
      if (!inForce || inForce.version < notice.version) ask.push(category);
    }
    return ask;
  }

  /** The decisions made on the latest decision date, with the wording version each was made under. */
  private async latestDay(tx: Tx, personId: string, category: DataCategory): Promise<Decision[]> {
    const rows = await tx
      .select({ decision: consents.decision, decidedOn: consents.decidedOn, decidedAt: consents.decidedAt, version: privacyNotices.version })
      .from(consents)
      .innerJoin(privacyNotices, eq(privacyNotices.id, consents.noticeId))
      .where(and(eq(consents.personId, personId), eq(consents.category, category)))
      .orderBy(desc(consents.decidedOn));
    return rows.filter((row) => row.decidedOn === rows[0].decidedOn);
  }

  /**
   * Deletes every stored field of the category (CATEGORY_FIELDS). Contact consent covers optional contact details
   * (phone) only. The sign-in identity never relies on consent, so the account link, tenant access, roles and
   * permit duties stay (FR-PPL-005, D31).
   */
  private async deleteDependentData(tx: Tx, ctx: DbContext, personId: string, category: DataCategory): Promise<void> {
    const fields = CATEGORY_FIELDS[category];
    const cleared: string[] = [];
    if (fields.encrypted.length) {
      const rows = await tx
        .update(personPrivateData)
        .set(Object.fromEntries(fields.encrypted.map((field) => [FIELD_COLUMN[field], null])) as Partial<typeof personPrivateData.$inferInsert>)
        .where(eq(personPrivateData.personId, personId))
        .returning({ personId: personPrivateData.personId });
      if (rows.length) cleared.push(...fields.encrypted);
    }
    if (fields.people.length) {
      const rows = await tx
        .update(people)
        .set({ ...Object.fromEntries(fields.people.map((column) => [column, null])), updatedAt: new Date() } as Partial<typeof people.$inferInsert>)
        .where(eq(people.id, personId))
        .returning({ id: people.id });
      if (rows.length) cleared.push(...fields.people);
    }
    if (cleared.length) {
      await this.audit.record(tx, ctx, { action: 'person.consent_data_deleted', entityType: 'person', entityId: personId, changedFields: cleared });
    }
  }

  private async requireLegalEntityAdmin(tx: Tx, ctx: DbContext, legalEntityId: string): Promise<void> {
    if (!ctx.personId || !(await this.permissions.isLegalEntityAdmin(tx, ctx.personId, legalEntityId))) {
      throw new ForbiddenException("Only the employer's legal-entity admin can do this");
    }
  }
}
```

Make two test changes:
- In `tests/schema-security.spec.ts`, set `APPEND_ONLY` to `['audit_events', 'tenant_data_keys', 'privacy_notices', 'consents']`.
- In `createTenantGraph`, before `return`, add:
```ts
  await owner.query(
    `insert into lawful_bases (tenant_id, legal_entity_id, category, purpose, bases, updated_by_person_id) values ($1, $2, 'contact', 'Work contact', '{employment}', $3)`,
    [tenantId, legalEntityId, personId],
  );
  const noticeId = await insertNotice(owner, tenantId, legalEntityId, 1);
  await owner.query(
    `insert into consents (tenant_id, person_id, category, notice_id, decision, method, decided_on, decided_at, recorded_by_person_id)
     values ($1, $2, 'blood_group', $3, 'given', 'in_app', current_date, now(), $2)`,
    [tenantId, personId, noticeId],
  );
  await owner.query(`insert into person_private_data (person_id, tenant_id, blood_group) values ($1, $2, '\\x00')`, [personId, tenantId]);
```

- [ ] **Step 5: Run the tests**

Run: `npm run test -w api -- tests/consent tests/isolation tests/schema-security tests/agency-path`
Expected: PASS. The agency-path catalogue check now also covers the four new tables.

- [ ] **Step 6: Commit (only when authorised)**

```bash
git add packages/shared/src app/src/database app/src/modules/privacy/consent.service.ts app/src/modules/privacy/sensitive-fields.ts \
  tests/consent.spec.ts tests/helpers tests/schema-security.spec.ts
git commit -m "v2: lawful basis, versioned notices, consent bound to the wording and date decided, withdrawal deletes at once (FR-PRV-001, 002, 011)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Personal-data service and access log

The counsel gate in Task 13 applies to this task too.

**Files:**
- Create: `app/src/database/migrations/0009_personal_data.sql`
- Create: `app/src/modules/privacy/personal-data.service.ts`, `app/src/modules/privacy/privacy.module.ts`
- Create: `tests/personal-data.spec.ts`
- Modify:
  - Database: `app/src/database/schema/privacy.ts`, `_journal.json`.
  - API: `app/src/app.module.ts`, `app/eslint.config.mjs`.
  - Tests: `tests/helpers/fixtures.ts`, `tests/helpers/services.ts`, `tests/schema-security.spec.ts`.

**Interfaces:**
- Consumes:
  - from Task 10: `TenantKeyService`, `encryptField`, `decryptField` and `keyVersionOf`;
  - from Task 13: `ConsentService.requiresConsent` and `hasConsent`, and `SENSITIVE_FIELDS`, `FIELD_CATEGORY` and `FIELD_COLUMN`;
  - `PermissionService.isLegalEntityAdmin` and `AuditWriter.record`.
- Produces:
  - `PersonalDataService`:
    - `read(tx, ctx, personId, fields: SensitiveField[]): Promise<Partial<Record<SensitiveField, string>>>`
    - `write(tx, ctx, personId, values: Partial<Record<SensitiveField, string | null>>): Promise<void>`
    - `readProfile(tx, ctx, personId): Promise<{ email: string | null; phone: string | null }>`
  - Table `personal_data_access_log` (append-only), exposed as Drizzle `personalDataAccessLog`.
  - SQL `app_person_contact(person_id)`: SECURITY DEFINER, which checks the person or employer-admin rule itself. A lint rule allows calling it only from `personal-data.service.ts`.
  - `PrivacyModule`, which exports only `ConsentService` and `PersonalDataService`.

- [ ] **Step 1: Write the failing tests**

In `tests/helpers/services.ts`:
- Add the import `import { PersonalDataService } from '../../app/src/modules/privacy/personal-data.service';`.
- Add `const personalData = new PersonalDataService(tenantKeys, consent, permissions, audit);` inside `services()`.
- Add `personalData` to the returned object.

Create `tests/personal-data.spec.ts`:
```ts
import { ForbiddenException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { runInContext, Tx } from '../app/src/database/context';
import { connectApi, connectOwner, pgErrorCode, userCtx } from './helpers/db';
import { insertLegalEntity, insertNotice, insertOrganisation, insertPerson, makeAdmin } from './helpers/fixtures';
import { keyServiceConfig, services } from './helpers/services';

describe('Personal-data service (NFR-SEC-003, FR-PRV-002, 004, 005, 008)', () => {
  const owner = connectOwner();
  const api = connectApi(6);
  const { consent, personalData } = services();
  let tenant: string;
  let entity: string;
  let otherEntity: string;
  let notice: string;
  let self: string;
  let admin: string;
  let otherAdmin: string;
  let orgAdmin: string;
  let colleague: string;
  let otherEntityColleague: string;

  const ctx = (personId: string) => userCtx(tenant, personId, [entity, otherEntity]);
  const as = <T>(personId: string, fn: (tx: Tx) => Promise<T>) => runInContext(api.db, ctx(personId), fn);
  const give = (personId: string) =>
    as(personId, (tx) => consent.record(tx, ctx(personId), { personId, category: 'blood_group', noticeId: notice, decision: 'given' }));

  beforeAll(async () => {
    tenant = await insertOrganisation(owner);
    entity = await insertLegalEntity(owner, tenant);
    otherEntity = await insertLegalEntity(owner, tenant);
    self = (await insertPerson(owner, tenant, entity)).personId;
    admin = (await insertPerson(owner, tenant, entity)).personId;
    otherAdmin = (await insertPerson(owner, tenant, otherEntity)).personId;
    orgAdmin = (await insertPerson(owner, tenant, entity)).personId;
    colleague = (await insertPerson(owner, tenant, entity)).personId;
    otherEntityColleague = (await insertPerson(owner, tenant, otherEntity)).personId;
    await makeAdmin(owner, { tenantId: tenant, personId: admin, role: 'LEGAL_ORG_ADMIN', legalEntityId: entity });
    await makeAdmin(owner, { tenantId: tenant, personId: otherAdmin, role: 'LEGAL_ORG_ADMIN', legalEntityId: otherEntity });
    await makeAdmin(owner, { tenantId: tenant, personId: orgAdmin, role: 'TENANT_ORG_ADMIN' });
    notice = await insertNotice(owner, tenant, entity, 1);
    await owner.query(`update people set phone = '+91 98000 55555' where id = $1`, [self]);
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('stores encrypted values the person can read back, and logs each view in the same transaction', async () => {
    await as(self, (tx) => personalData.write(tx, ctx(self), self, { emergency_contacts: 'Asha, +91 98000 12345' }));
    const { rows } = await owner.query(`select emergency_contacts from person_private_data where person_id = $1`, [self]);
    expect(rows[0].emergency_contacts.includes(Buffer.from('Asha'))).toBe(false);
    expect(await as(self, (tx) => personalData.read(tx, ctx(self), self, ['emergency_contacts']))).toEqual({
      emergency_contacts: 'Asha, +91 98000 12345',
    });
    const log = await owner.query(
      `select viewer_person_id, purpose, fields from personal_data_access_log where subject_person_id = $1`,
      [self],
    );
    expect(log.rows).toEqual([{ viewer_person_id: self, purpose: 'own_record', fields: ['emergency_contacts'] }]);
  });

  it('refuses blood group until consent is in force (FR-PRV-002)', async () => {
    await expect(as(self, (tx) => personalData.write(tx, ctx(self), self, { blood_group: 'B+' }))).rejects.toBeInstanceOf(ForbiddenException);
    await give(self);
    await as(self, (tx) => personalData.write(tx, ctx(self), self, { blood_group: 'B+' }));
    expect(await as(self, (tx) => personalData.read(tx, ctx(self), self, ['blood_group']))).toEqual({ blood_group: 'B+' });
  });

  it("shows sensitive fields only to the person and the employer's legal-entity admin (FR-PRV-005)", async () => {
    expect(await as(admin, (tx) => personalData.read(tx, ctx(admin), self, ['emergency_contacts']))).toEqual({
      emergency_contacts: 'Asha, +91 98000 12345',
    });
    for (const viewer of [otherAdmin, orgAdmin, colleague, otherEntityColleague]) {
      await expect(as(viewer, (tx) => personalData.read(tx, ctx(viewer), self, ['emergency_contacts']))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
  });

  it('shows contact details through the logged profile read only, to the same people (FR-PRV-005, 008)', async () => {
    expect(await as(self, (tx) => personalData.readProfile(tx, ctx(self), self))).toMatchObject({ phone: '+91 98000 55555' });
    expect(await as(admin, (tx) => personalData.readProfile(tx, ctx(admin), self))).toMatchObject({ phone: '+91 98000 55555' });
    for (const viewer of [otherAdmin, orgAdmin, colleague, otherEntityColleague]) {
      await expect(as(viewer, (tx) => personalData.readProfile(tx, ctx(viewer), self))).rejects.toBeInstanceOf(ForbiddenException);
    }
    // The assignment card stays readable to colleagues; the contact columns never are.
    expect((await as(otherEntityColleague, (tx) => tx.execute(sql`select full_name, designation from people where id = ${self}`))).rows).toHaveLength(1);
    expect(await pgErrorCode(as(colleague, (tx) => tx.execute(sql`select phone from people where id = ${self}`)))).toBe('42501');
    // Calling the database function directly does not get around the rule either.
    const direct = await as(colleague, (tx) => tx.execute(sql`select email, phone from app_person_contact(${self})`));
    expect(direct.rows).toEqual([]);
    const log = await owner.query(
      `select viewer_person_id, purpose from personal_data_access_log where subject_person_id = $1 and fields = '{email,phone}'::text[] order by viewed_at`,
      [self],
    );
    expect(log.rows).toEqual([
      { viewer_person_id: self, purpose: 'own_record' },
      { viewer_person_id: admin, purpose: 'employer_admin' },
    ]);
  });

  it('returns nothing when the access-log entry cannot be written', async () => {
    // An empty field list violates the log's CHECK, so the log write fails inside the read.
    await expect(as(self, (tx) => personalData.read(tx, ctx(self), self, []))).rejects.toThrow();
  });

  it('refuses a value copied onto another person', async () => {
    const other = (await insertPerson(owner, tenant, entity)).personId;
    await owner.query(
      `insert into person_private_data (person_id, tenant_id, emergency_contacts)
       select $1, tenant_id, emergency_contacts from person_private_data where person_id = $2`,
      [other, self],
    );
    await expect(as(other, (tx) => personalData.read(tx, ctx(other), other, ['emergency_contacts']))).rejects.toThrow();
  });

  it('stores nothing when the key service is unavailable (Review Focus 3)', async () => {
    const broken = services({ ...keyServiceConfig, 'keyService.url': 'http://localhost:1' });
    const person = (await insertPerson(owner, tenant, entity)).personId;
    await expect(
      as(person, (tx) => broken.personalData.write(tx, ctx(person), person, { emergency_contacts: 'Ravi' })),
    ).rejects.toThrow();
    const { rows } = await owner.query(`select 1 from person_private_data where person_id = $1`, [person]);
    expect(rows).toHaveLength(0);
  });

  it('refuses a health-data write after a same-day withdrawal, even when a form signed that morning is uploaded later', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    await give(person);
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: notice, decision: 'withdrawn' }));
    await as(admin, (tx) =>
      consent.record(tx, ctx(admin), {
        personId: person, category: 'blood_group', noticeId: notice, decision: 'given',
        formFileKey: 'forms/morning.pdf', signedOn: new Date().toISOString().slice(0, 10),
      }),
    );
    await expect(as(admin, (tx) => personalData.write(tx, ctx(admin), person, { blood_group: 'O-' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns no optional contact details once contact consent is withdrawn, but keeps the sign-in identity (D31)', async () => {
    await as(otherAdmin, (tx) =>
      consent.setLawfulBasis(tx, ctx(otherAdmin), { legalEntityId: otherEntity, category: 'contact', purpose: 'Contact', bases: ['consent'], changeReason: 'Counsel advice' }),
    );
    const otherNotice = await insertNotice(owner, tenant, otherEntity, 1);
    const person = (await insertPerson(owner, tenant, otherEntity)).personId;
    await owner.query(`update people set phone = '+91 98000 88888' where id = $1`, [person]);
    const decide = (decision: 'given' | 'withdrawn') =>
      as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'contact', noticeId: otherNotice, decision }));
    await decide('given');
    expect(await as(otherAdmin, (tx) => personalData.readProfile(tx, ctx(otherAdmin), person))).toMatchObject({ phone: '+91 98000 88888' });
    await decide('withdrawn');
    const profile = await as(otherAdmin, (tx) => personalData.readProfile(tx, ctx(otherAdmin), person));
    expect(profile.phone).toBeNull();
    expect(profile.email).toMatch(/@example\.test$/);
  });

  it('never keeps blood group after a withdrawal, whichever of the two commits first (Review Focus 5)', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    for (let i = 0; i < 5; i++) {
      await give(person);
      const [write, withdraw] = await Promise.allSettled([
        as(admin, (tx) => personalData.write(tx, ctx(admin), person, { blood_group: 'AB-' })),
        as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: notice, decision: 'withdrawn' })),
      ]);
      expect(withdraw.status).toBe('fulfilled');
      if (write.status === 'rejected') expect(write.reason).toBeInstanceOf(ForbiddenException);
      const { rows } = await owner.query(`select blood_group from person_private_data where person_id = $1`, [person]);
      expect(rows[0]?.blood_group ?? null).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -w api -- tests/personal-data`
Expected: FAIL. TypeScript reports that `personal-data.service` cannot be found.

- [ ] **Step 3: Implement**

Create `app/src/database/migrations/0009_personal_data.sql`:
```sql
-- FR-PRV-008: every view of personal data, written in the same transaction as the read. Append-only for the API.
-- viewer_person_id has no foreign key: from Phase 4 a viewer can be in another tenant (NFR-SEC-002 b).
CREATE TABLE personal_data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organisations (id),
  viewer_tenant_id uuid NOT NULL,
  viewer_person_id uuid,
  subject_person_id uuid NOT NULL,
  fields text[] NOT NULL CHECK (cardinality(fields) > 0),
  purpose text NOT NULL CHECK (purpose IN ('own_record', 'employer_admin')),
  permit_id uuid,
  viewed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX personal_data_access_log_subject ON personal_data_access_log (tenant_id, subject_person_id, viewed_at);
SELECT app_apply_tenant_policy('personal_data_access_log');
REVOKE UPDATE, DELETE ON personal_data_access_log FROM ptw_api;

-- FR-PRV-005: contact details, only for the person and the admins of the person's employer legal entity.
-- The check is here, in the database; PersonalDataService is the only caller and logs each view (FR-PRV-008).
CREATE FUNCTION app_person_contact(p_person_id uuid) RETURNS TABLE (email text, phone text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT p.email, p.phone
    FROM public.people p
   WHERE p.id = p_person_id
     AND p.tenant_id = app_tenant_id()
     AND app_acting_role() = 'user'
     AND app_context_valid()
     AND (p.id = app_person_id()
          OR EXISTS (SELECT 1 FROM public.admin_assignments a
                       JOIN public.people ap ON ap.id = a.person_id AND ap.status = 'active'
                      WHERE a.person_id = app_person_id()
                        AND a.role = 'LEGAL_ORG_ADMIN'
                        AND a.legal_entity_id = p.employer_legal_entity_id))
$$;
REVOKE EXECUTE ON FUNCTION app_person_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_person_contact(uuid) TO ptw_api;
```

Append to `entries` in `_journal.json`:
```json
    { "idx": 9, "version": "7", "when": 1791072540000, "tag": "0009_personal_data", "breakpoints": true }
```

Append to `app/src/database/schema/privacy.ts`:
```ts
export const personalDataAccessLog = pgTable('personal_data_access_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  viewerTenantId: uuid('viewer_tenant_id').notNull(),
  viewerPersonId: uuid('viewer_person_id'),
  subjectPersonId: uuid('subject_person_id').notNull(),
  fields: text('fields').array().notNull(),
  purpose: text('purpose', { enum: ['own_record', 'employer_admin'] }).notNull(),
  permitId: uuid('permit_id'),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Create `app/src/modules/privacy/personal-data.service.ts`:
```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { DbContext, Tx } from '../../database/context';
import { people, personalDataAccessLog, personPrivateData } from '../../database/schema';
import { PermissionService } from '../access/permission.service';
import { AuditWriter } from '../audit/audit-writer';
import { ConsentService } from './consent.service';
import { decryptField, encryptField, keyVersionOf } from './field-crypto';
import { FIELD_CATEGORY, FIELD_COLUMN, type SensitiveField } from './sensitive-fields';
import { TenantKeyService } from './tenant-key.service';

const aad = (personId: string, field: SensitiveField) => `${personId}:${field}`;

type Purpose = 'own_record' | 'employer_admin';

/**
 * The only code that reads personal data: encrypted fields (NFR-SEC-003) and full-record contact details.
 * It checks who may see a record (FR-PRV-005) and logs every view in the same transaction; if the log
 * write fails, nothing is returned (FR-PRV-008). Consent changes go through ConsentService.record.
 */
@Injectable()
export class PersonalDataService {
  constructor(
    private readonly tenantKeys: TenantKeyService,
    private readonly consent: ConsentService,
    private readonly permissions: PermissionService,
    private readonly audit: AuditWriter,
  ) {}

  async read(tx: Tx, ctx: DbContext, personId: string, fields: SensitiveField[]): Promise<Partial<Record<SensitiveField, string>>> {
    const subject = await this.subject(tx, personId, false);
    await this.log(tx, ctx, subject, fields, await this.purpose(tx, ctx, subject));
    const [row] = await tx.select().from(personPrivateData).where(eq(personPrivateData.personId, personId));
    const values: Partial<Record<SensitiveField, string>> = {};
    for (const field of fields) {
      const blob = row?.[FIELD_COLUMN[field]];
      if (!blob) continue;
      const key = await this.tenantKeys.byVersion(tx, subject.tenantId, keyVersionOf(blob));
      values[field] = decryptField(key, blob, aad(personId, field));
    }
    return values;
  }

  /** FR-PRV-005, 008: contact details for the person and their employer's legal-entity admins, logged. */
  async readProfile(tx: Tx, ctx: DbContext, personId: string): Promise<{ email: string | null; phone: string | null }> {
    const subject = await this.subject(tx, personId, false);
    await this.log(tx, ctx, subject, ['email', 'phone'], await this.purpose(tx, ctx, subject));
    const { rows } = await tx.execute<{ email: string | null; phone: string | null }>(
      sql`select email, phone from app_person_contact(${personId})`,
    );
    if (!rows[0]) throw new ForbiddenException("Not allowed to see this person's contact details");
    return rows[0];
  }

  async write(tx: Tx, ctx: DbContext, personId: string, values: Partial<Record<SensitiveField, string | null>>): Promise<void> {
    // The row lock serialises this write with ConsentService.record (Review Focus 5).
    const subject = await this.subject(tx, personId, true);
    await this.purpose(tx, ctx, subject);
    const entries = Object.entries(values) as [SensitiveField, string | null][];
    for (const [field, value] of entries) {
      const category = FIELD_CATEGORY[field];
      if (
        value !== null &&
        (await this.consent.requiresConsent(tx, subject.employerLegalEntityId, category)) &&
        !(await this.consent.hasConsent(tx, personId, category))
      ) {
        throw new ForbiddenException(`Consent for ${field.replace(/_/g, ' ')} is not in force`);
      }
    }
    const { version, key } = await this.tenantKeys.current(tx, subject.tenantId);
    const set = Object.fromEntries(
      entries.map(([field, value]) => [FIELD_COLUMN[field], value === null ? null : encryptField(key, version, value, aad(personId, field))]),
    ) as Partial<typeof personPrivateData.$inferInsert>;
    await tx
      .insert(personPrivateData)
      .values({ personId, tenantId: subject.tenantId, ...set })
      .onConflictDoUpdate({ target: personPrivateData.personId, set: { ...set, updatedAt: new Date() } });
    await this.audit.record(tx, ctx, {
      action: 'person.sensitive_updated',
      entityType: 'person',
      entityId: personId,
      changedFields: entries.map(([field]) => field),
    });
  }

  private async log(tx: Tx, ctx: DbContext, subject: { id: string; tenantId: string }, fields: string[], purpose: Purpose): Promise<void> {
    await tx.insert(personalDataAccessLog).values({
      tenantId: subject.tenantId,
      viewerTenantId: ctx.tenantId as string,
      viewerPersonId: ctx.personId,
      subjectPersonId: subject.id,
      fields,
      purpose,
    });
  }

  private async subject(tx: Tx, personId: string, lock: boolean) {
    const query = tx
      .select({ id: people.id, tenantId: people.tenantId, employerLegalEntityId: people.employerLegalEntityId })
      .from(people)
      .where(eq(people.id, personId));
    const [subject] = lock ? await query.for('update') : await query;
    if (!subject) throw new NotFoundException('Person not found');
    return subject;
  }

  /** FR-PRV-005: the person, or the admins of the person's employer legal entity. Nobody else. */
  private async purpose(tx: Tx, ctx: DbContext, subject: { id: string; employerLegalEntityId: string }): Promise<Purpose> {
    if (ctx.personId === subject.id) return 'own_record';
    if (ctx.personId && (await this.permissions.isLegalEntityAdmin(tx, ctx.personId, subject.employerLegalEntityId))) {
      return 'employer_admin';
    }
    throw new ForbiddenException("Not allowed to see this person's personal data");
  }
}
```

Create `app/src/modules/privacy/privacy.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ConsentService } from './consent.service';
import { KeyService } from './key.service';
import { PersonalDataService } from './personal-data.service';
import { TenantKeyService } from './tenant-key.service';

// KeyService and TenantKeyService are not exported: nothing outside this module can decrypt (NFR-SEC-003).
@Module({
  imports: [AccessModule],
  providers: [KeyService, TenantKeyService, ConsentService, PersonalDataService],
  exports: [ConsentService, PersonalDataService],
})
export class PrivacyModule {}
```

In `app/src/app.module.ts`, import `PrivacyModule` and add it to `imports` after `AccessModule`.

In `app/eslint.config.mjs`:
- Add the constant:
```js
// FR-PRV-005, 008: only PersonalDataService may read contact details, because it logs each view.
const contactSelectors = [
  { selector: 'TemplateElement[value.raw=/app_person_contact/]', message: 'Only PersonalDataService may call app_person_contact (FR-PRV-005, 008).' },
  { selector: 'Literal[value=/app_person_contact/]', message: 'Only PersonalDataService may call app_person_contact (FR-PRV-005, 008).' },
];
```
- Replace the object added in Task 3 with the three objects below. ESLint replaces a rule's options per matching object, so each file gets exactly the selectors that apply to it:
```js
  {
    files: ['src/**/*.ts'],
    ignores: ['src/database/context.ts', 'src/modules/privacy/personal-data.service.ts'],
    rules: { 'no-restricted-syntax': ['error', ...contextSelectors, ...contactSelectors] },
  },
  { files: ['src/database/context.ts'], rules: { 'no-restricted-syntax': ['error', ...contactSelectors] } },
  { files: ['src/modules/privacy/personal-data.service.ts'], rules: { 'no-restricted-syntax': ['error', ...contextSelectors] } },
```
- Check it fires:
```bash
printf "import { sql } from 'drizzle-orm';\nexport const probe = sql\`select * from app_person_contact(x)\`;\n" > app/src/lint-probe.ts
(cd app && npx eslint src/lint-probe.ts); rm app/src/lint-probe.ts
```
  Expected: one error naming `app_person_contact`.

Make two test changes:
- In `tests/schema-security.spec.ts`, add `'personal_data_access_log'` to `APPEND_ONLY`.
- In `createTenantGraph`, before `return`, add:
```ts
  await owner.query(
    `insert into personal_data_access_log (tenant_id, viewer_tenant_id, viewer_person_id, subject_person_id, fields, purpose)
     values ($1, $1, $2, $2, '{blood_group}', 'own_record')`,
    [tenantId, personId],
  );
```

- [ ] **Step 4: Run the tests**

Run: `npm run test -w api -- tests/personal-data tests/consent tests/isolation tests/schema-security tests/agency-path && npm run lint -w api && npm run build -w api`
Expected: PASS, and lint and build pass.

- [ ] **Step 5: Commit (only when authorised)**

```bash
git add app/src/database app/src/modules/privacy app/src/app.module.ts app/eslint.config.mjs tests/personal-data.spec.ts \
  tests/helpers tests/schema-security.spec.ts
git commit -m "v2: personal-data service with logged sensitive and contact reads; consent-gated writes (FR-PRV-004, 005, 008)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Phase 1a exit check

**Files:**
- Create: `tests/app-module.spec.ts`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a green Phase 1a branch, a check that Nest can resolve every provider, and the architecture note that Phase 1b builds on.

- [ ] **Step 1: Add the dependency-injection check**

A build compiles TypeScript but does not prove that Nest can resolve every provider. Create `tests/app-module.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { AppModule } from '../app/src/app.module';
import { ContextDb } from '../app/src/database/database.module';
import { PermissionService } from '../app/src/modules/access/permission.service';
import { ConsentService } from '../app/src/modules/privacy/consent.service';
import { PersonalDataService } from '../app/src/modules/privacy/personal-data.service';

describe('Application module', () => {
  it('resolves every provider without starting the server', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    try {
      for (const token of [ContextDb, PermissionService, ConsentService, PersonalDataService]) {
        expect(moduleRef.get(token, { strict: false })).toBeInstanceOf(token);
      }
    } finally {
      await moduleRef.close();
    }
  });
});
```

- [ ] **Step 2: Run the whole suite, lint and build from a clean v2 database**

Run in the worktree, where `docker compose down -v` removes only `ptw-v2` volumes:
```bash
docker compose down -v
docker compose up -d postgres redis openbao openbao-init
npm run lint -w api && npm run build -w api && npm run test -w api
```
Expected: lint and build pass, and every spec passes. The isolation suite reports its checks across all 18 tables:
- organisations, legal_entities, departments, plants;
- accounts, people, roles, plant_assignments, admin_assignments;
- audit_events, tenant_data_keys;
- lawful_bases, privacy_notices, consents, person_private_data, personal_data_access_log;
- engagements and engagement_plants (cross-tenant).

The suite is catalogue-driven and asserts no fixed count. Keep the test summary line for the owner, and do not report a pass you did not see.

- [ ] **Step 3: Record the architecture**

Add this section to `docs/architecture.md`, before any v1 content:
```markdown
## v2 data security core (Phase 1a, PRD §16 and §18)

- **Roles.** `ptw_owner` owns the schema and runs migrations and seeds; it has BYPASSRLS and is never given to the
  running API. Its password lives in `infrastructure/postgres/.env`, read only by the postgres service.
  `ptw_api` (DATABASE_URL) is NOSUPERUSER, NOBYPASSRLS and owns nothing. The API refuses to start if it can see
  `MIGRATION_DATABASE_URL` or `PTW_OWNER_PASSWORD`, or if its role can bypass RLS or owns a table. No database
  credential is compiled into `app/src`: `migrate.ts` requires `MIGRATION_DATABASE_URL` for its one command or job.
  Keycloak has its own database and role. Metabase is removed.
- **Context.** Every query runs inside `runInContext` (`app/src/database/context.ts`), which first calls
  `set_config('app.tenant_id' | 'app.person_id' | 'app.legal_entity_ids' | 'app.acting_role', value, true)`.
  All four are always set; `none` is an explicitly empty value, and a missing setting makes any context incomplete.
  Feature code gets `ContextDb`, never the raw connection or pool. A lint rule rejects `set_config` or `SET app.*`
  anywhere else.
- **Policies.** Every table has ENABLE and FORCE RLS. Every policy requires `app_context_valid()`: a user context
  needs a tenant, an active person of that tenant and legal entities of that tenant; a job needs a tenant and no
  person; a platform admin has none. Tenant tables use `tenant_isolation` (`tenant_id = app_tenant_id()`).
  Child rows reference parents by `(tenant_id, id)`. `accounts` are visible only through a person record in the
  request tenant. Engagements are readable by both parties and written by the client.
- **Full record.** The API role cannot select `people.email` or `people.phone`; they are read through
  `PersonalDataService.readProfile` (via `app_person_contact`, which checks person or employer admin) and logged.
  Write `people` with explicit `returning({ ... })` columns. Phase 2's new full-record columns follow the same rule.
- **Proof.** `tests/schema-security.spec.ts` (run as the API role) and `tests/isolation.spec.ts` (catalogue-driven:
  a new table fails until it has a policy, a fixture row and a classification; incomplete contexts are set
  directly and must read and write nothing).
- **Personal data.** Sensitive fields live in `person_private_data`, encrypted with AES-256-GCM (`<person id>:<field>`
  as associated data) under a per-tenant data key wrapped by the OpenBao Transit master key. Only
  `PersonalDataService` decrypts; it checks FR-PRV-005, gates consent-based fields and writes
  `personal_data_access_log` in the same transaction.
- **Consent.** `ConsentService.record` is the only consent operation. Each decision is bound to the notice version
  shown or signed and its decision date (and time, for in-app decisions). On the latest decision date, the
  decisions that cannot be ordered against each other decide (a day with a signed form: all of them; otherwise
  those at the latest instant), and consent is in force only if all of them are "given". Any decision that leaves
  consent not in force deletes every stored field of the category (`CATEGORY_FIELDS`) in the same transaction.
  The sign-in identity (`people.email`) is separate from optional contact details (`people.phone`), relies on
  employment and never on consent, so withdrawing contact consent never touches sign-in, tenant access, roles or
  permit duties (D31). A phase that stores new consent-based data adds it to `CATEGORY_FIELDS`.
- **Audit.** `AuditWriter` writes `audit_events` in the action's transaction; personal fields are recorded as
  "changed". The API can only insert into and read audit, access-log, consent, notice and data-key tables.
- **Jobs.** Cross-tenant sweeps take tenant IDs from `app_tenant_ids_for_jobs()` and run each tenant under its own
  context; payloads hold record IDs only; a failed job is removed at its final failure and its failure is logged.
```

- [ ] **Step 4: Review and commit (only when authorised)**

Run `/ponytail-review` on `git diff v1-final...HEAD -- app/src tests`, and apply any cut it proposes that keeps the tests green. Then:
```bash
git add tests/app-module.spec.ts docs/architecture.md
git commit -m "v2: Phase 1a exit: provider resolution check and architecture note for the data security core

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand over**

Report to the owner:
- the test summary line;
- any step that deviated from this plan, and why;
- the result of the final whole-branch review. Under subagent-driven execution that review is mandatory: credentials, context, consent and queue behaviour all cross task boundaries.

Then ask the owner to approve writing the Phase 1b plan (identity and sessions). That plan starts with the R2 Keycloak spike.
