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
