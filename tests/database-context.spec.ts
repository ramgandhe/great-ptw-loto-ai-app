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
