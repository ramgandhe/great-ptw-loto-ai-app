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
    ).toEqual({ designation: { before: 'Fitter', after: 'Supervisor' }, phone: 'changed', blood_group: 'changed' });
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
