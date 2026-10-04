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
