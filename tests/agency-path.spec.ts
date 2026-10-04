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

  it('never covers for a tenant that is not an agency, even with an active engagement', async () => {
    const nonAgency = await createTenantGraph(owner);
    await engage(owner, client, nonAgency);
    expect(await covers(nonAgency, client.plantId)).toBe(false);
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
    // Every tenant-keyed table, partitioned ones included (organisations is keyed by id).
    const { rows: tables } = await owner.query<{ table: string; key: string }>(`
      select c.relname as table, case when c.relname = 'organisations' then 'id' else 'tenant_id' end as key
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
         and (c.relname = 'organisations'
              or exists (select 1 from pg_attribute t where t.attrelid = c.oid and t.attname = 'tenant_id' and not t.attisdropped))`);
    expect(tables.length).toBeGreaterThan(0);
    const problems: string[] = [];
    for (const { table, key } of tables) {
      // Only the columns the API role may select: a column privilege error must not stand in for RLS (people refuses `select *`).
      const { rows: columns } = await api.pool.query<{ name: string }>(
        `select attname as name from pg_attribute
          where attrelid = $1::regclass and attnum > 0 and not attisdropped and has_column_privilege(current_user, attrelid, attnum, 'SELECT')
          order by attnum`,
        [`public.${table}`],
      );
      expect(columns.length).toBeGreaterThan(0);
      const T = sql.identifier(table);
      const K = sql.identifier(key);
      // Any error here (a privilege error included) fails the test: only RLS may be what returns nothing.
      const { count, rowsSeen } = await runInContext(api.db, ctxOf(client), async (tx) => ({
        count: (await tx.execute<{ n: number }>(sql`select count(*)::int as n from ${T} where ${K} = ${agency.tenantId}`)).rows[0].n,
        rowsSeen: (await tx.execute(sql`select ${sql.join(columns.map((c) => sql.identifier(c.name)), sql`, `)} from ${T} where ${K} = ${agency.tenantId}`)).rows.length,
      }));
      if (count !== 0) problems.push(`${table}: count(*) saw ${count} agency row(s)`);
      if (rowsSeen !== 0) problems.push(`${table}: its ${columns.length} readable columns gave ${rowsSeen} agency row(s)`);
    }
    expect(problems).toEqual([]);
    // The full-record columns are refused outright, by column privilege.
    expect(
      await pgErrorCode(runInContext(api.db, ctxOf(client), (tx) => tx.execute(sql`select email, phone from people where tenant_id = ${agency.tenantId}`))),
    ).toBe('42501');
  });
});
