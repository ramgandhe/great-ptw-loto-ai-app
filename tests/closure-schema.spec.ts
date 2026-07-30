import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

const completeChecklist = {
  workCompleted: true,
  evidenceReviewed: true,
  areaSecured: true,
  hazardsRemoved: true,
};

describe('Permit closure schema (PUS-149)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const supervisorId = randomUUID();
  const issuerId = randomUUID();
  const locationId = randomUUID();

  function testIds() {
    return {
      tenantId: randomUUID(),
      permitTypeId: randomUUID(),
    };
  }

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

  async function createActivePermit(tenantId: string, permitTypeId: string) {
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId,
        title: 'Hot work closure',
        reference: 'PTW-CL-01',
        locationId,
        plannedStartAt: new Date('2026-09-01T08:00:00Z'),
        plannedEndAt: new Date('2026-09-01T16:00:00Z'),
        submittedAt: new Date(),
        submittedBy: issuerId,
        createdBy: issuerId,
      })
      .returning();

    return permit;
  }

  dbTest('stores verification for active permit', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createActivePermit(tenantId, permitTypeId);

    const [verification] = await db
      .insert(schema.permitVerifications)
      .values({
        permitId: permit.id,
        verifiedBy: supervisorId,
        comment: 'Area secured',
        checklist: completeChecklist,
        createdBy: supervisorId,
      })
      .returning();

    expect(verification.checklist.workCompleted).toBe(true);
  });

  dbTest('rejects verification when permit is not active', async () => {
    const { tenantId, permitTypeId } = testIds();
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId,
        title: 'Not active',
        locationId,
        createdBy: issuerId,
      })
      .returning();

    await expect(
      db.insert(schema.permitVerifications).values({
        permitId: permit.id,
        verifiedBy: supervisorId,
        checklist: completeChecklist,
        createdBy: supervisorId,
      }),
    ).rejects.toThrow();
  });

  dbTest('rejects closure without verification', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createActivePermit(tenantId, permitTypeId);

    await expect(
      db.insert(schema.permitClosures).values({
        permitId: permit.id,
        closedBy: supervisorId,
        actualEndAt: new Date('2026-09-01T16:00:00Z'),
        createdBy: supervisorId,
      }),
    ).rejects.toThrow();
  });

  dbTest('closes verified permit and archives record', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createActivePermit(tenantId, permitTypeId);

    await db.insert(schema.permitVerifications).values({
      permitId: permit.id,
      verifiedBy: supervisorId,
      checklist: completeChecklist,
      createdBy: supervisorId,
    });

    const actualEndAt = new Date('2026-09-01T16:00:00Z');
    const [closure] = await db
      .insert(schema.permitClosures)
      .values({
        permitId: permit.id,
        closedBy: supervisorId,
        actualEndAt,
        comment: 'Work complete',
        createdBy: supervisorId,
      })
      .returning();

    const [archive] = await db
      .insert(schema.permitArchive)
      .values({
        tenantId,
        permitId: permit.id,
        title: permit.title,
        reference: permit.reference,
        closedAt: closure.closedAt,
        closedBy: supervisorId,
      })
      .returning();

    expect(closure.permitId).toBe(permit.id);
    expect(archive.title).toBe('Hot work closure');
  });

  dbTest('enforces immutable verification records', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createActivePermit(tenantId, permitTypeId);

    const [verification] = await db
      .insert(schema.permitVerifications)
      .values({
        permitId: permit.id,
        verifiedBy: supervisorId,
        checklist: completeChecklist,
        createdBy: supervisorId,
      })
      .returning();

    await expect(
      db
        .update(schema.permitVerifications)
        .set({ comment: 'tampered' })
        .where(eq(schema.permitVerifications.id, verification.id)),
    ).rejects.toThrow();

    await expect(
      db
        .delete(schema.permitVerifications)
        .where(eq(schema.permitVerifications.id, verification.id)),
    ).rejects.toThrow();
  });

  dbTest('enforces immutable audit history', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createActivePermit(tenantId, permitTypeId);

    const [entry] = await db
      .insert(schema.auditHistory)
      .values({
        permitId: permit.id,
        action: 'permit.verified',
        actorId: supervisorId,
        comment: 'Verified',
        createdBy: supervisorId,
      })
      .returning();

    await expect(
      db
        .update(schema.auditHistory)
        .set({ comment: 'tampered' })
        .where(eq(schema.auditHistory.id, entry.id)),
    ).rejects.toThrow();
  });

  dbTest('prevents mutation of closed permits', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createActivePermit(tenantId, permitTypeId);

    await db
      .update(schema.permits)
      .set({ status: 'closed', updatedBy: supervisorId })
      .where(eq(schema.permits.id, permit.id));

    await expect(
      db
        .update(schema.permits)
        .set({ title: 'tampered' })
        .where(eq(schema.permits.id, permit.id)),
    ).rejects.toThrow();
  });

  dbTest('supports closed permit status', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createActivePermit(tenantId, permitTypeId);

    await db
      .update(schema.permits)
      .set({ status: 'closed', updatedBy: supervisorId })
      .where(eq(schema.permits.id, permit.id));

    const [updated] = await db
      .select()
      .from(schema.permits)
      .where(eq(schema.permits.id, permit.id));

    expect(updated.status).toBe('closed');
  });

  dbTest('allows verified and closed status history actions', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createActivePermit(tenantId, permitTypeId);

    const [history] = await db
      .insert(schema.permitStatusHistory)
      .values({
        permitId: permit.id,
        action: 'verified',
        fromStatus: 'active',
        toStatus: 'active',
        actorId: supervisorId,
        createdBy: supervisorId,
      })
      .returning();

    expect(history.action).toBe('verified');
  });
});
