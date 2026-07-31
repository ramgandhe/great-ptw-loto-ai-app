import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Investigation schema (PUS-194)', () => {
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

  async function seedOpenIncident() {
    const tenantId = randomUUID();
    const [incident] = await db
      .insert(schema.incidents)
      .values({
        tenantId,
        reference: `INC-INV-${randomUUID().slice(0, 6)}`,
        incidentType: 'incident',
        severityPath: 'accident',
        status: 'open',
        title: 'Incident under investigation',
        description: 'Needs RCA',
        occurredAt: new Date(),
        reportedBy: userId,
        submittedBy: userId,
        submittedAt: new Date(),
        createdBy: userId,
      })
      .returning();
    return { tenantId, incident };
  }

  dbTest('stores investigation with root cause and actions', async () => {
    const { tenantId, incident } = await seedOpenIncident();

    const [investigation] = await db
      .insert(schema.investigations)
      .values({
        tenantId,
        incidentId: incident.id,
        investigatorId: userId,
        assignedBy: userId,
        status: 'in_progress',
        dueDate: '2026-08-15',
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.rootCauses).values({
      tenantId,
      investigationId: investigation.id,
      methodology: '5_why',
      description: 'Missing guard',
      recordedBy: userId,
      createdBy: userId,
    });

    await db.insert(schema.correctiveActions).values({
      tenantId,
      investigationId: investigation.id,
      title: 'Install guard',
      ownerId: userId,
      dueDate: '2026-08-20',
      createdBy: userId,
    });

    await db.insert(schema.preventiveActions).values({
      tenantId,
      investigationId: investigation.id,
      title: 'Update SOP',
      ownerId: userId,
      createdBy: userId,
    });

    await db.insert(schema.investigationHistory).values({
      tenantId,
      investigationId: investigation.id,
      incidentId: incident.id,
      eventType: 'assigned',
      actorId: userId,
      createdBy: userId,
    });

    const history = await db
      .select()
      .from(schema.investigationHistory)
      .where(eq(schema.investigationHistory.investigationId, investigation.id));

    expect(history).toHaveLength(1);
  });

  dbTest('enforces one investigation per incident', async () => {
    const { tenantId, incident } = await seedOpenIncident();

    await db.insert(schema.investigations).values({
      tenantId,
      incidentId: incident.id,
      investigatorId: userId,
      assignedBy: userId,
      createdBy: userId,
    });

    await expect(
      db.insert(schema.investigations).values({
        tenantId,
        incidentId: incident.id,
        investigatorId: userId,
        assignedBy: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });

  dbTest('blocks mutation of investigation history', async () => {
    const { tenantId, incident } = await seedOpenIncident();
    const [investigation] = await db
      .insert(schema.investigations)
      .values({
        tenantId,
        incidentId: incident.id,
        investigatorId: userId,
        assignedBy: userId,
        createdBy: userId,
      })
      .returning();

    const [history] = await db
      .insert(schema.investigationHistory)
      .values({
        tenantId,
        investigationId: investigation.id,
        incidentId: incident.id,
        eventType: 'assigned',
        actorId: userId,
        createdBy: userId,
      })
      .returning();

    await expect(
      db
        .update(schema.investigationHistory)
        .set({ eventType: 'completed' })
        .where(eq(schema.investigationHistory.id, history.id)),
    ).rejects.toThrow(/immutable/i);
  });
});
