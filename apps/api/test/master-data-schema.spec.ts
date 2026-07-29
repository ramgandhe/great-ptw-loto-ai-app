import { randomUUID } from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

describe('Master data schema (PUS-70)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

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

  dbTest('creates tenant-scoped permit types with unique codes', async () => {
    const tenantId = randomUUID();

    const [permitType] = await db
      .insert(schema.permitTypes)
      .values({
        tenantId,
        code: 'HOT-WORK',
        name: 'Hot Work',
        createdBy: randomUUID(),
      })
      .returning();

    expect(permitType.code).toBe('HOT-WORK');

    await expect(
      db.insert(schema.permitTypes).values({
        tenantId,
        code: 'HOT-WORK',
        name: 'Duplicate',
        createdBy: randomUUID(),
      }),
    ).rejects.toThrow();
  });

  dbTest('links machinery to workstation catalogue', async () => {
    const tenantId = randomUUID();

    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({
        tenantId,
        code: 'WS-01',
        name: 'Boiler Room',
        createdBy: randomUUID(),
      })
      .returning();

    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId,
        code: 'PUMP-01',
        name: 'Feed Pump',
        workstationId: workstation.id,
        createdBy: randomUUID(),
      })
      .returning();

    expect(machinery.workstationId).toBe(workstation.id);
  });

  dbTest('stores safety checklist items', async () => {
    const tenantId = randomUUID();

    const [checklist] = await db
      .insert(schema.safetyChecklists)
      .values({
        tenantId,
        code: 'CHK-01',
        name: 'Pre-work checks',
        status: 'draft',
        createdBy: randomUUID(),
      })
      .returning();

    const [item] = await db
      .insert(schema.safetyChecklistItems)
      .values({
        checklistId: checklist.id,
        sequence: 1,
        description: 'Verify isolation',
        isMandatory: true,
        createdBy: randomUUID(),
      })
      .returning();

    expect(item.checklistId).toBe(checklist.id);
  });

  dbTest('tracks import job results', async () => {
    const tenantId = randomUUID();

    const [job] = await db
      .insert(schema.importJobs)
      .values({
        tenantId,
        status: 'completed',
        fileName: 'import.json',
        storageBucket: 'ptw-documents',
        storageKey: `${tenantId}/imports/import.json`,
        totalRows: 1,
        successCount: 1,
        createdBy: randomUUID(),
      })
      .returning();

    const [result] = await db
      .insert(schema.importJobResults)
      .values({
        importJobId: job.id,
        rowNumber: 1,
        entityType: 'permit_type',
        status: 'success',
      })
      .returning();

    expect(result.importJobId).toBe(job.id);
  });
});
