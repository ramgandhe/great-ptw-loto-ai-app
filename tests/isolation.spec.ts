import { sql, SQL } from 'drizzle-orm';
import { DbContext, runInContext } from '../app/src/database/context';
import { Client, PoolClient } from 'pg';
import { apiDatabaseUrl, connectApi, connectOwner, noTenantJobCtx, pgCode, pgErrorCode, platformCtx, userCtx } from './helpers/db';
import { createTenantGraph, ctxOf, engage, insertPerson, TenantGraph } from './helpers/fixtures';

/**
 * Tables without a tenant_id column, and how each is scoped. A table that is neither tenant-keyed nor
 * listed here fails the suite, so every new table is classified on purpose (NFR-SEC-001).
 */
const ACCOUNT_SCOPED: string[] = ['accounts'];
/** Every write policy on a cross-tenant table must contain this: only the client writes. */
const CLIENT_ONLY = 'client_tenant_id = app_tenant_id()';
const CROSS_TENANT: Record<string, string[]> = { engagements: ['client_tenant_id', 'agency_tenant_id'], engagement_plants: ['client_tenant_id'] };

/**
 * Policies ("table.policy") allowed to have no `<tenant key> = app_tenant_id()` binding. Each entry must be a
 * platform-admin-only policy; later tasks add their entries here, so each one is visible in review.
 */
const NO_TENANT_BINDING: string[] = ['organisations.organisation_create'];

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
  let leftPersonId: string; // a person of tenant a who has left
  const tables: TenantTable[] = [];
  const unclassified: string[] = [];
  /** Per table, the quoted columns the API role may INSERT. Insert probes name only these, so a missing column privilege (also 42501) cannot stand in for the policy. */
  const insertColumns = new Map<string, string>();
  /** Tables whose key column the API role may UPDATE. Update probes set the key, so they skip the rest (see the test below). */
  const updatableKey = new Set<string>();

  beforeAll(async () => {
    a = await createTenantGraph(owner);
    b = await createTenantGraph(owner, 'agency');
    x = await createTenantGraph(owner);
    await engage(owner, a, b);
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
    const insertable = await api.pool.query<{ table: string; columns: string }>(`
      select c.relname as table, string_agg(quote_ident(t.attname), ', ' order by t.attnum) as columns
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute t on t.attrelid = c.oid and t.attnum > 0 and not t.attisdropped
       where n.nspname = 'public' and c.relkind in ('r', 'p') and has_column_privilege(current_user, c.oid, t.attnum, 'INSERT')
       group by c.relname`);
    for (const r of insertable.rows) insertColumns.set(r.table, r.columns);
    const keys: [string, string][] = [...tables.map((t): [string, string] => [t.table, t.key]), ...Object.keys(CROSS_TENANT).map((t): [string, string] => [t, 'client_tenant_id'])];
    for (const [table, key] of keys) {
      const { rows: priv } = await api.pool.query<{ ok: boolean }>(`select has_column_privilege(current_user, $1::regclass, $2, 'UPDATE') as ok`, [`public.${table}`, key]);
      if (priv[0].ok) updatableKey.add(table);
    }
    leftPersonId = (await insertPerson(owner, a.tenantId, a.legalEntityId)).personId;
    await owner.query(`update people set status = 'left', left_on = current_date where id = $1`, [leftPersonId]);
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
  const outcomeOf = (run: Promise<{ rowCount: number | null }>): Promise<string> =>
    run.then((r) => `rows:${r.rowCount ?? 0}`, (e) => `code:${pgCode(e)}`);
  const attempt = (ctx: DbContext, query: SQL) => outcomeOf(runInContext(api.db, ctx, (tx) => tx.execute(query)));

  /** A copy of one of tenant a's rows, for insert attempts. */
  const rowOfA = async (t: TenantTable) =>
    (await owner.query(`select to_jsonb(r) as row from ${q(t.table)} r where ${q(t.key)} = $1 limit 1`, [a.tenantId])).rows[0].row;

  const insertList = (table: string): string => {
    const columns = insertColumns.get(table);
    if (!columns) throw new Error(`the API role may insert no column of ${table}`);
    return columns;
  };
  /** A copy of the jsonb row ($1) of this table, naming only the columns the API role may insert. */
  const insertCopy = (table: string) =>
    `insert into ${q(table)} (${insertList(table)}) select ${insertList(table)} from jsonb_populate_record(null::${q(table)}, $1::jsonb)`;

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
  /** The settings runInContext sets for a context, for probes that must be rolled back. */
  const settingsOf = (ctx: DbContext): Settings => ({
    tenant_id: ctx.tenantId ?? 'none',
    person_id: ctx.personId ?? 'none',
    legal_entity_ids: ctx.legalEntityIds.length ? ctx.legalEntityIds.join(',') : 'none',
    acting_role: ctx.actingRole,
  });
  /** "rows:N" or "code:SQLSTATE" for a statement run on a pool client under these settings and always rolled back. */
  const attemptRaw = (settings: Settings, query: string, params: unknown[]) => outcomeOf(withRawSettings(settings, query, params));

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
    ["user listing another tenant's legal entity", { ...fullUser(), legal_entity_ids: `${a.legalEntityId},${x.legalEntityId}` }],
    ["job listing another tenant's legal entity", { ...fullJob(), legal_entity_ids: x.legalEntityId }],
    ['user whose person belongs to another tenant', { ...fullUser(), person_id: x.personId }],
    ['user whose person has left', { ...fullUser(), person_id: leftPersonId }],
    ['user whose person does not exist', { ...fullUser(), person_id: x.tenantId }],
  ];

  const outsiders = (): [string, DbContext][] => [
    ['agency b', ctxOf(b)],
    ['organisation x', ctxOf(x)],
    ['job without tenant', noTenantJobCtx],
  ];
  /** Everyone but the owning tenant. The platform admin sees organisations, so it is left out there. */
  const viewersOf = (t: TenantTable): [string, DbContext][] =>
    t.table === 'organisations' ? outsiders() : [...outsiders(), ['platform admin', platformCtx]];

  it('classifies every table', () => {
    expect(unclassified).toEqual([]);
  });

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
      for (const [who, ctx] of viewersOf(t)) {
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
          withRawSettings(settings, insertCopy(t.table), [JSON.stringify(row)]),
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

  it('denies every incomplete or inconsistent context on a fresh and on a reused connection, for reads and writes', async () => {
    const rowByTable = new Map<string, unknown>();
    for (const t of tables) rowByTable.set(t.table, await rowOfA(t));
    const problems: string[] = [];

    /**
     * One transaction on this client with exactly these settings; every table is probed inside it, each probe undone by a
     * savepoint (a repeated name just shadows the last). On a brand-new client the settings are unset (NULL), not '', so
     * this is the first and only transaction.
     */
    const probeEveryTable = async (client: Client, label: string, name: string, settings: Settings) => {
      await client.query('begin');
      try {
        for (const [setting, value] of Object.entries(settings)) await client.query('select set_config($1, $2, true)', [`app.${setting}`, value]);
        for (const t of tables) {
          await client.query('savepoint s');
          const read = await client.query<{ n: number }>(`select count(*)::int as n from ${q(t.table)} where ${q(t.key)} = $1`, [a.tenantId]);
          if (read.rows[0].n !== 0) problems.push(`${t.table}: "${name}" on a ${label} connection reads ${read.rows[0].n} row(s)`);
          await client.query('rollback to savepoint s');
          const code = await pgErrorCode(
            client.query(insertCopy(t.table), [JSON.stringify(rowByTable.get(t.table))]),
          );
          if (code !== '42501') problems.push(`${t.table}: "${name}" on a ${label} connection insert gave ${code ?? 'no error'}`);
          await client.query('rollback to savepoint s');
        }
      } finally {
        await client.query('rollback').catch(() => undefined);
      }
    };

    const reused = new Client({ connectionString: apiDatabaseUrl });
    await reused.connect();
    try {
      // A complete transaction first, so the settings exist on this connection (as '') afterwards.
      await rawOn(reused, fullUser(), 'select 1', []);
      for (const [name, settings] of incompleteContexts()) {
        const fresh = new Client({ connectionString: apiDatabaseUrl });
        await fresh.connect();
        try {
          await probeEveryTable(fresh, 'fresh', name, settings);
        } finally {
          await fresh.end();
        }
        await probeEveryTable(reused, 'reused', name, settings);
      }
    } finally {
      await reused.end();
    }
    expect(problems).toEqual([]);
  });

  it('gives every policy a valid-context check and, on a tenant table, a tenant check, for every command', async () => {
    const { rows } = await owner.query<{ tablename: string; policyname: string; cmd: string; qual: string | null; with_check: string | null }>(
      `select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2`,
    );
    const keyOf = new Map(tables.map((t) => [t.table, t.key]));
    const problems: string[] = [];
    for (const p of rows) {
      const key = keyOf.get(p.tablename);
      const label = `${p.tablename}.${p.policyname}`;
      const where = `${label} (${p.cmd})`;
      if (p.qual === null && p.with_check === null) problems.push(`${where}: no USING or WITH CHECK expression`);
      for (const [part, expr] of [['USING', p.qual], ['WITH CHECK', p.with_check]] as [string, string | null][]) {
        if (expr === null) continue;
        if (!expr.includes('app_context_valid()')) problems.push(`${where}: ${part} lacks app_context_valid()`);
        if (key && !NO_TENANT_BINDING.includes(label) && !expr.includes(`${key} = app_tenant_id()`)) {
          problems.push(`${where}: ${part} lacks ${key} = app_tenant_id()`);
        }
        if (p.tablename in CROSS_TENANT && p.cmd !== 'SELECT' && !expr.includes(CLIENT_ONLY)) {
          problems.push(`${where}: ${part} lacks ${CLIENT_ONLY}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('skips the update probes only for tables the API role cannot update at all', async () => {
    // A probe sets the key column, so the key must be one the API role may UPDATE; otherwise a privilege error (42501) could pass for the policy.
    const skipped = tables.filter((t) => !updatableKey.has(t.table)).map((t) => t.table);
    const problems: string[] = Object.keys(CROSS_TENANT).filter((table) => !updatableKey.has(table)).map((table) => `${table}: its key is not updatable`);
    for (const table of skipped) {
      const { rows } = await api.pool.query<{ ok: boolean }>(`select has_any_column_privilege(current_user, $1::regclass, 'UPDATE') as ok`, [`public.${table}`]);
      if (rows[0].ok) problems.push(`${table}: the key is not updatable but another column is; probe that column`);
    }
    expect(problems).toEqual([]);
    expect([...skipped].sort()).toEqual(['audit_events', 'consents', 'privacy_notices', 'tenant_data_keys']); // the APPEND_ONLY tables (catalogue order is alphabetical)
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
          if (op === 'update' && !updatableKey.has(t.table)) continue;
          const outcome = await attempt(ctx, query);
          if (outcome !== 'rows:0' && outcome !== 'code:42501') problems.push(`${t.table}: ${who} ${op} gave ${outcome}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('lets an update that reads no column touch only the caller\'s own rows', async () => {
    // With no WHERE and a constant SET, only the UPDATE policy decides; the SELECT policy is not consulted. Always rolled back.
    const problems: string[] = [];
    for (const t of tables) {
      if (!updatableKey.has(t.table)) continue;
      for (const [who, ctx] of viewersOf(t)) {
        const own = ctx.tenantId
          ? (await owner.query<{ n: number }>(`select count(*)::int as n from ${q(t.table)} where ${q(t.key)} = $1`, [ctx.tenantId])).rows[0].n
          : 0;
        const outcome = await attemptRaw(settingsOf(ctx), `update ${q(t.table)} set ${q(t.key)} = $1`, [ctx.tenantId ?? a.tenantId]);
        if (outcome !== `rows:${own}` && outcome !== 'code:42501') problems.push(`${t.table}: ${who} update without WHERE gave ${outcome}, expected rows:${own} or code:42501`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('refuses inserting a row into another tenant', async () => {
    const problems: string[] = [];
    for (const t of tables) {
      const row = await rowOfA(t);
      const T = sql.identifier(t.table);
      const columns = sql.raw(insertList(t.table));
      for (const [who, ctx] of outsiders()) {
        // RLS WITH CHECK runs before unique and foreign-key checks, so a copy of a's row must fail with 42501.
        const code = await pgErrorCode(
          runInContext(api.db, ctx, (tx) =>
            tx.execute(sql`insert into ${T} (${columns}) select ${columns} from jsonb_populate_record(null::${T}, ${JSON.stringify(row)}::jsonb)`),
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
      if (!updatableKey.has(t.table)) continue;
      const T = q(t.table);
      const K = q(t.key);
      // The second statement reads no column, so only the UPDATE policy's WITH CHECK can stop it. Both are rolled back.
      for (const [how, query, params] of [
        ['with WHERE', `update ${T} set ${K} = $1 where ${K} = $2`, [a.tenantId, x.tenantId]],
        ['without WHERE', `update ${T} set ${K} = $1`, [a.tenantId]],
      ] as [string, string, string[]][]) {
        const outcome = await attemptRaw(settingsOf(ctxOf(x)), query, params);
        if (outcome !== 'code:42501') problems.push(`${t.table}: moving x's row to a ${how} gave ${outcome}`);
      }
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

  it('lets only the client write a cross-tenant table: no insert, update or delete by anyone else', async () => {
    const problems: string[] = [];
    const countsOfA = async () =>
      Promise.all(Object.keys(CROSS_TENANT).map(async (table) =>
        (await owner.query<{ n: number }>(`select count(*)::int as n from ${q(table)} where client_tenant_id = $1`, [a.tenantId])).rows[0].n,
      ));
    const before = await countsOfA();
    for (const table of Object.keys(CROSS_TENANT)) {
      const T = q(table);
      const row = await rowOfA({ table, key: 'client_tenant_id' });
      for (const [who, ctx] of [...outsiders(), ['platform admin', platformCtx]] as [string, DbContext][]) {
        // All rolled back. The updates read no column or only the key, and the delete has no WHERE, so the write policies decide.
        const attempts: [string, string, string[]][] = [
          ['insert', insertCopy(table), [JSON.stringify(row)]],
          ['update', `update ${T} set client_tenant_id = client_tenant_id`, []],
          ['update without a column', `update ${T} set client_tenant_id = $1`, [a.tenantId]],
          ['delete', `delete from ${T}`, []],
        ];
        for (const [op, query, params] of attempts) {
          if (op.startsWith('update') && !updatableKey.has(table)) continue;
          const outcome = await attemptRaw(settingsOf(ctx), query, params);
          const allowed = op === 'insert' ? ['code:42501'] : ['rows:0', 'code:42501'];
          if (!allowed.includes(outcome)) problems.push(`${table}: ${who} ${op} gave ${outcome}`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(await countsOfA()).toEqual(before);
  });

  it("refuses the client attaching another tenant's plant to its own engagement", async () => {
    const engagementId = (await owner.query<{ id: string }>(`select id from engagements where client_tenant_id = $1`, [a.tenantId])).rows[0].id;
    // The WITH CHECK passes (the row is a's), so the composite foreign key to plants (tenant_id, id) stops it: 23503.
    const outcome = await attemptRaw(
      settingsOf(ctxOf(a)),
      `insert into engagement_plants (engagement_id, client_tenant_id, plant_id) values ($1, $2, $3)`,
      [engagementId, a.tenantId, x.plantId],
    );
    expect(outcome).toBe('code:23503');
  });
});
