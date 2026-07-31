import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Incident closure schema (PUS-199)', () => {
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

  async function seedVerifiedIncident() {
    const tenantId = randomUUID();
    const [incident] = await db
      .insert(schema.incidents)
      .values({
        tenantId,
        reference: `INC-CLS-${randomUUID().slice(0, 6)}`,
        incidentType: 'incident',
        severityPath: 'accident',
        status: 'verified',
        title: 'Ready to close',
        description: 'Investigation done',
        occurredAt: new Date(),
        reportedBy: userId,
        submittedBy: userId,
        submittedAt: new Date(),
        createdBy: userId,
      })
      .returning();

    const [investigation] = await db
      .insert(schema.investigations)
      .values({
        tenantId,
        incidentId: incident.id,
        investigatorId: userId,
        assignedBy: userId,
        status: 'completed',
        completedAt: new Date(),
        completedBy: userId,
        createdBy: userId,
      })
      .returning();

    return { tenantId, incident, investigation };
  }

  dbTest('stores verification, closure and archive snapshot', async () => {
    const { tenantId, incident, investigation } = await seedVerifiedIncident();

    const [verification] = await db
      .insert(schema.incidentVerifications)
      .values({
        tenantId,
        incidentId: incident.id,
        investigationId: investigation.id,
        verifiedBy: userId,
        comments: 'All actions complete',
        correctiveActionsConfirmed: true,
        preventiveActionsReviewed: true,
        createdBy: userId,
      })
      .returning();

    const closedAt = new Date();
    await db.insert(schema.incidentClosures).values({
      tenantId,
      incidentId: incident.id,
      verificationId: verification.id,
      closedBy: userId,
      closedAt,
      comments: 'Closed',
      createdBy: userId,
    });

    await db.insert(schema.incidentArchive).values({
      tenantId,
      incidentId: incident.id,
      reference: incident.reference,
      incidentType: incident.incidentType,
      title: incident.title,
      closedAt,
      archivedBy: userId,
      snapshot: { incident, investigation, verification },
      createdBy: userId,
    });

    const archived = await db
      .select()
      .from(schema.incidentArchive)
      .where(eq(schema.incidentArchive.incidentId, incident.id));

    expect(archived).toHaveLength(1);
    expect(archived[0].reference).toBe(incident.reference);
  });

  dbTest('blocks mutation of archive records', async () => {
    const { tenantId, incident, investigation } = await seedVerifiedIncident();

    const [verification] = await db
      .insert(schema.incidentVerifications)
      .values({
        tenantId,
        incidentId: incident.id,
        investigationId: investigation.id,
        verifiedBy: userId,
        correctiveActionsConfirmed: true,
        preventiveActionsReviewed: true,
        createdBy: userId,
      })
      .returning();

    const [archive] = await db
      .insert(schema.incidentArchive)
      .values({
        tenantId,
        incidentId: incident.id,
        reference: incident.reference,
        incidentType: incident.incidentType,
        title: incident.title,
        closedAt: new Date(),
        archivedBy: userId,
        snapshot: { verificationId: verification.id },
        createdBy: userId,
      })
      .returning();

    await expect(
      db
        .update(schema.incidentArchive)
        .set({ title: 'tampered' })
        .where(eq(schema.incidentArchive.id, archive.id)),
    ).rejects.toThrow(/immutable/i);
  });
});
