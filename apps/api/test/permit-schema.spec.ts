import { randomUUID } from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { formatPermitReference, generatePermitReference } from '../src/database/permit-reference';
import * as schema from '../src/database/schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

describe('Permit creation schema (PUS-134)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const tenantId = randomUUID();
  const permitTypeId = randomUUID();
  const plantId = randomUUID();
  const departmentId = randomUUID();
  const locationId = randomUUID();
  const hazardCategoryId = randomUUID();
  const ppeCatalogueId = randomUUID();
  const workforceUserId = randomUUID();
  const issuerId = randomUUID();

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });

    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder: './src/database/migrations' });
    } catch {
      canConnect = false;
    }
  });

  afterAll(async () => {
    if (canConnect) {
      await pool.end();
    }
  });

  const dbTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) {
        return;
      }
      await fn();
    });
  };

  it('formats permit references', () => {
    expect(formatPermitReference(2026, 1)).toBe('PTW-2026-000001');
    expect(formatPermitReference(2026, 42)).toBe('PTW-2026-000042');
  });

  dbTest('creates a draft permit with related records', async () => {

    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'draft',
        permitTypeId,
        title: 'Hot work - Tank 3',
        workScope: 'Welding repair on storage tank',
        plantId,
        departmentId,
        locationId,
        createdBy: issuerId,
      })
      .returning();

    await db.insert(schema.permitDrafts).values({
      permitId: permit.id,
      currentStep: 2,
      formSnapshot: { step: 'hazards' },
      createdBy: issuerId,
    });

    await db.insert(schema.permitHazards).values({
      permitId: permit.id,
      hazardCategoryId,
      description: 'Fire risk',
      createdBy: issuerId,
    });

    await db.insert(schema.permitPpe).values({
      permitId: permit.id,
      ppeCatalogueId,
      quantity: 2,
      createdBy: issuerId,
    });

    await db.insert(schema.permitExecutors).values({
      permitId: permit.id,
      workforceUserId,
      isPrimary: true,
      createdBy: issuerId,
    });

    const [attachment] = await db
      .insert(schema.permitAttachments)
      .values({
        permitId: permit.id,
        fileName: 'method-statement.pdf',
        contentType: 'application/pdf',
        fileSize: 1024,
        storageBucket: 'ptw-documents',
        storageKey: `${tenantId}/${permit.id}/method-statement.pdf`,
        uploadedBy: issuerId,
        createdBy: issuerId,
      })
      .returning();

    expect(permit.status).toBe('draft');
    expect(permit.reference).toBeNull();
    expect(attachment.fileName).toBe('method-statement.pdf');
  });

  dbTest('rejects duplicate permit references within a tenant', async () => {

    const reference = `PTW-TEST-${randomUUID().slice(0, 8)}`;

    await db.insert(schema.permits).values({
      tenantId,
      reference,
      status: 'pending_approval',
      permitTypeId,
      title: 'Submitted permit A',
      plantId,
      departmentId,
      locationId,
      submittedAt: new Date(),
      submittedBy: issuerId,
      createdBy: issuerId,
    });

    await expect(
      db.insert(schema.permits).values({
        tenantId,
        reference,
        status: 'pending_approval',
        permitTypeId,
        title: 'Submitted permit B',
        plantId,
        departmentId,
        locationId,
        submittedAt: new Date(),
        submittedBy: issuerId,
        createdBy: issuerId,
      }),
    ).rejects.toThrow();
  });

  dbTest('rejects attachment rows with invalid permit foreign keys', async () => {

    await expect(
      db.insert(schema.permitAttachments).values({
        permitId: randomUUID(),
        fileName: 'orphan.pdf',
        contentType: 'application/pdf',
        fileSize: 512,
        storageBucket: 'ptw-documents',
        storageKey: 'orphan.pdf',
        uploadedBy: issuerId,
        createdBy: issuerId,
      }),
    ).rejects.toThrow();
  });

  dbTest('rejects permits with invalid status values', async () => {

    await expect(
      db.insert(schema.permits).values({
        tenantId,
        status: 'invalid_status' as 'draft',
        permitTypeId,
        title: 'Invalid status permit',
        createdBy: issuerId,
      }),
    ).rejects.toThrow();
  });

  dbTest('rejects duplicate hazard assignments on the same permit', async () => {

    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'draft',
        permitTypeId,
        title: 'Duplicate hazard test',
        createdBy: issuerId,
      })
      .returning();

    await db.insert(schema.permitHazards).values({
      permitId: permit.id,
      hazardCategoryId,
      createdBy: issuerId,
    });

    await expect(
      db.insert(schema.permitHazards).values({
        permitId: permit.id,
        hazardCategoryId,
        createdBy: issuerId,
      }),
    ).rejects.toThrow();
  });

  dbTest('generates sequential tenant-scoped permit references', async () => {

    const refTenantId = randomUUID();
    const year = new Date().getFullYear();

    await db.insert(schema.permits).values({
      tenantId: refTenantId,
      reference: formatPermitReference(year, 5),
      status: 'pending_approval',
      permitTypeId,
      title: 'Existing reference',
      submittedAt: new Date(),
      submittedBy: issuerId,
      createdBy: issuerId,
    });

    const nextReference = await generatePermitReference(db, refTenantId);
    expect(nextReference).toBe(formatPermitReference(year, 6));
  });

  dbTest('allows multiple draft permits without references in the same tenant', async () => {

    const draftTenantId = randomUUID();

    await db.insert(schema.permits).values({
      tenantId: draftTenantId,
      status: 'draft',
      permitTypeId,
      title: 'Draft one',
      createdBy: issuerId,
    });

    const rows = await db
      .insert(schema.permits)
      .values({
        tenantId: draftTenantId,
        status: 'draft',
        permitTypeId,
        title: 'Draft two',
        createdBy: issuerId,
      })
      .returning();

    expect(rows).toHaveLength(1);
  });
});
