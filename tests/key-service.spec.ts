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
