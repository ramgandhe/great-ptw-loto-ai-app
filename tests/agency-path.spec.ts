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
