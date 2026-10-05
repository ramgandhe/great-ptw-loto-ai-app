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
