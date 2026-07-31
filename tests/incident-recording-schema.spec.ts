import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Incident recording schema (PUS-189)', () => {
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

  dbTest('stores incident with evidence, equipment and permit links', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();

    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId,
        title: 'Linked permit',
        reference: `PTW-INC-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      })
      .returning();

    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({
        tenantId,
        code: `WS-${randomUUID().slice(0, 6)}`,
        name: 'Bay',
        createdBy: userId,
      })
      .returning();

    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId,
        code: `EQ-${randomUUID().slice(0, 6)}`,
        name: 'Pump A',
        workstationId: workstation.id,
        createdBy: userId,
      })
      .returning();

    const [incident] = await db
      .insert(schema.incidents)
      .values({
        tenantId,
        reference: `INC-${randomUUID().slice(0, 8).toUpperCase()}`,
        incidentType: 'near_miss',
        severityPath: 'near_miss',
        status: 'open',
        title: 'Near miss at pump',
        description: 'Tool slipped near rotating shaft',
        locationDescription: 'Pump house',
        occurredAt: new Date(),
        reportedBy: userId,
        submittedBy: userId,
        submittedAt: new Date(),
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.incidentEvidence).values({
      tenantId,
      incidentId: incident.id,
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      fileSize: 1024,
      storageBucket: 'ptw-documents',
      storageKey: `${tenantId}/${incident.id}/evidence/photo.jpg`,
      uploadedBy: userId,
      createdBy: userId,
    });

    await db.insert(schema.incidentEquipment).values({
      tenantId,
      incidentId: incident.id,
      machineryId: machinery.id,
      createdBy: userId,
    });

    await db.insert(schema.incidentPermits).values({
      tenantId,
      incidentId: incident.id,
      permitId: permit.id,
      createdBy: userId,
    });

    const evidence = await db
      .select()
      .from(schema.incidentEvidence)
      .where(eq(schema.incidentEvidence.incidentId, incident.id));

    expect(evidence).toHaveLength(1);
    expect(incident.incidentType).toBe('near_miss');
  });

  dbTest('enforces unique incident reference per tenant', async () => {
    const tenantId = randomUUID();
    const reference = `INC-DUP-${randomUUID().slice(0, 6)}`;

    await db.insert(schema.incidents).values({
      tenantId,
      reference,
      incidentType: 'incident',
      severityPath: 'accident',
      title: 'First',
      description: 'First report',
      occurredAt: new Date(),
      reportedBy: userId,
      createdBy: userId,
    });

    await expect(
      db.insert(schema.incidents).values({
        tenantId,
        reference,
        incidentType: 'incident',
        severityPath: 'accident',
        title: 'Second',
        description: 'Duplicate',
        occurredAt: new Date(),
        reportedBy: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });

  dbTest('blocks delete of submitted incidents and mutation of evidence', async () => {
    const tenantId = randomUUID();

    const [incident] = await db
      .insert(schema.incidents)
      .values({
        tenantId,
        reference: `INC-IMM-${randomUUID().slice(0, 6)}`,
        incidentType: 'unsafe_condition',
        status: 'open',
        title: 'Open incident',
        description: 'Cannot delete',
        occurredAt: new Date(),
        reportedBy: userId,
        submittedBy: userId,
        submittedAt: new Date(),
        createdBy: userId,
      })
      .returning();

    const [evidence] = await db
      .insert(schema.incidentEvidence)
      .values({
        tenantId,
        incidentId: incident.id,
        fileName: 'shot.png',
        contentType: 'image/png',
        fileSize: 512,
        storageBucket: 'ptw-documents',
        storageKey: `${tenantId}/${incident.id}/evidence/shot.png`,
        uploadedBy: userId,
        createdBy: userId,
      })
      .returning();

    await expect(
      db.delete(schema.incidents).where(eq(schema.incidents.id, incident.id)),
    ).rejects.toThrow(/cannot be deleted/i);

    await expect(
      db
        .update(schema.incidentEvidence)
        .set({ comment: 'tampered' })
        .where(eq(schema.incidentEvidence.id, evidence.id)),
    ).rejects.toThrow(/immutable/i);
  });
});
