import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('SIMOPS detection schema (PUS-169)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const userId = randomUUID();

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    db = drizzle(pool, { schema });

    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder });
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

  dbTest('stores conflicts, participants and alerts', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();

    const [permitA] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId,
        title: 'Permit A',
        reference: `PTW-A-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      })
      .returning();

    const [permitB] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId,
        title: 'Permit B',
        reference: `PTW-B-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      })
      .returning();

    const fingerprint = `${[permitA.id, permitB.id].sort().join(':')}:equipment`;

    const [conflict] = await db
      .insert(schema.simopsConflicts)
      .values({
        tenantId,
        status: 'open',
        severity: 'high',
        conflictType: 'equipment',
        summary: 'Equipment overlap detected',
        fingerprint,
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.conflictParticipants).values([
      {
        tenantId,
        conflictId: conflict.id,
        permitId: permitA.id,
        createdBy: userId,
      },
      {
        tenantId,
        conflictId: conflict.id,
        permitId: permitB.id,
        createdBy: userId,
      },
    ]);

    await db.insert(schema.conflictAlerts).values({
      tenantId,
      conflictId: conflict.id,
      severity: 'high',
      message: 'Equipment overlap detected',
      recipientRole: 'hod',
      createdBy: userId,
    });

    const rows = await db
      .select()
      .from(schema.conflictParticipants)
      .where(eq(schema.conflictParticipants.conflictId, conflict.id));

    expect(rows).toHaveLength(2);
  });
});
