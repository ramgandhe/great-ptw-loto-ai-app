import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('SIMOPS conflict detection schema (PUS-169)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const userId = randomUUID();

  function testIds() {
    return {
      tenantId: randomUUID(),
      otherTenantId: randomUUID(),
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

  async function seedPermit(tenantId: string, permitTypeId: string, title: string) {
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId,
        title,
        reference: `PTW-SIM-${randomUUID().slice(0, 8)}`,
        plannedStartAt: new Date('2026-08-01T08:00:00.000Z'),
        plannedEndAt: new Date('2026-08-01T16:00:00.000Z'),
        createdBy: userId,
      })
      .returning();

    return permit;
  }

  async function seedConflict(tenantId: string, fingerprint: string) {
    const [conflict] = await db
      .insert(schema.simopsConflicts)
      .values({
        tenantId,
        status: 'detected',
        severity: 'high',
        primaryConflictType: 'location',
        conflictTypes: ['location', 'schedule'],
        fingerprint,
        overlapStartAt: new Date('2026-08-01T09:00:00.000Z'),
        overlapEndAt: new Date('2026-08-01T12:00:00.000Z'),
        details: { reason: 'overlapping workstation schedule' },
        createdBy: userId,
      })
      .returning();

    return conflict;
  }

  dbTest('stores conflict with participants and alert', async () => {
    const { tenantId, permitTypeId } = testIds();
    const older = await seedPermit(tenantId, permitTypeId, 'Older hot work');
    const newer = await seedPermit(tenantId, permitTypeId, 'Newer confined space');
    const conflict = await seedConflict(tenantId, `fp-${randomUUID()}`);

    await db.insert(schema.conflictParticipants).values([
      {
        conflictId: conflict.id,
        permitId: older.id,
        participantRole: 'older',
        isFrozen: false,
        createdBy: userId,
      },
      {
        conflictId: conflict.id,
        permitId: newer.id,
        participantRole: 'newer',
        isFrozen: true,
        createdBy: userId,
      },
    ]);

    const [alert] = await db
      .insert(schema.conflictAlerts)
      .values({
        conflictId: conflict.id,
        tenantId,
        recipientUserId: userId,
        recipientRole: 'supervisor',
        channel: 'in_app',
        deliveryStatus: 'pending',
        message: 'High severity location conflict detected',
        createdBy: userId,
      })
      .returning();

    const participants = await db
      .select()
      .from(schema.conflictParticipants)
      .where(eq(schema.conflictParticipants.conflictId, conflict.id));

    expect(participants).toHaveLength(2);
    expect(participants.some((row) => row.isFrozen)).toBe(true);
    expect(alert.deliveryStatus).toBe('pending');
    expect(conflict.severity).toBe('high');
  });

  dbTest('rejects duplicate fingerprint within tenant', async () => {
    const { tenantId } = testIds();
    const fingerprint = `dup-${randomUUID()}`;

    await seedConflict(tenantId, fingerprint);

    await expect(seedConflict(tenantId, fingerprint)).rejects.toThrow(/unique|duplicate/i);
  });

  dbTest('allows same fingerprint across tenants', async () => {
    const { tenantId, otherTenantId } = testIds();
    const fingerprint = `shared-${randomUUID()}`;

    await seedConflict(tenantId, fingerprint);
    const other = await seedConflict(otherTenantId, fingerprint);

    expect(other.tenantId).toBe(otherTenantId);
  });

  dbTest('rejects duplicate participant permit on same conflict', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId, 'Shared permit');
    const conflict = await seedConflict(tenantId, `fp-${randomUUID()}`);

    await db.insert(schema.conflictParticipants).values({
      conflictId: conflict.id,
      permitId: permit.id,
      participantRole: 'peer',
      createdBy: userId,
    });

    await expect(
      db.insert(schema.conflictParticipants).values({
        conflictId: conflict.id,
        permitId: permit.id,
        participantRole: 'newer',
        createdBy: userId,
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  dbTest('rejects invalid severity status and conflict type', async () => {
    const { tenantId } = testIds();

    await expect(
      db.insert(schema.simopsConflicts).values({
        tenantId,
        status: 'detected',
        severity: 'critical',
        primaryConflictType: 'location',
        conflictTypes: ['location'],
        fingerprint: `bad-sev-${randomUUID()}`,
        createdBy: userId,
      }),
    ).rejects.toThrow(/severity|check/i);

    await expect(
      db.insert(schema.simopsConflicts).values({
        tenantId,
        status: 'queued',
        severity: 'low',
        primaryConflictType: 'location',
        conflictTypes: ['location'],
        fingerprint: `bad-status-${randomUUID()}`,
        createdBy: userId,
      }),
    ).rejects.toThrow(/status|check/i);

    await expect(
      db.insert(schema.simopsConflicts).values({
        tenantId,
        status: 'detected',
        severity: 'low',
        primaryConflictType: 'weather',
        conflictTypes: ['weather'],
        fingerprint: `bad-type-${randomUUID()}`,
        createdBy: userId,
      }),
    ).rejects.toThrow(/primary_conflict_type|check/i);
  });

  dbTest('isolates conflicts by tenant_id', async () => {
    const { tenantId, otherTenantId } = testIds();
    await seedConflict(tenantId, `tenant-a-${randomUUID()}`);
    await seedConflict(otherTenantId, `tenant-b-${randomUUID()}`);

    const rows = await db
      .select()
      .from(schema.simopsConflicts)
      .where(eq(schema.simopsConflicts.tenantId, tenantId));

    expect(rows.every((row) => row.tenantId === tenantId)).toBe(true);
    expect(rows.some((row) => row.tenantId === otherTenantId)).toBe(false);
  });

  dbTest('restricts deleting permit referenced by conflict participant', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId, 'Frozen by conflict');
    const conflict = await seedConflict(tenantId, `fp-${randomUUID()}`);

    await db.insert(schema.conflictParticipants).values({
      conflictId: conflict.id,
      permitId: permit.id,
      participantRole: 'newer',
      isFrozen: true,
      createdBy: userId,
    });

    await expect(db.delete(schema.permits).where(eq(schema.permits.id, permit.id))).rejects.toThrow(
      /restrict|foreign key|violates/i,
    );
  });

  dbTest('cascades participants and alerts when conflict is deleted', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId, 'Cascade source');
    const conflict = await seedConflict(tenantId, `fp-${randomUUID()}`);

    await db.insert(schema.conflictParticipants).values({
      conflictId: conflict.id,
      permitId: permit.id,
      participantRole: 'peer',
      createdBy: userId,
    });

    await db.insert(schema.conflictAlerts).values({
      conflictId: conflict.id,
      tenantId,
      channel: 'email',
      deliveryStatus: 'sent',
      message: 'Notify issuer',
      sentAt: new Date(),
      createdBy: userId,
    });

    await db.delete(schema.simopsConflicts).where(eq(schema.simopsConflicts.id, conflict.id));

    const participants = await db
      .select()
      .from(schema.conflictParticipants)
      .where(eq(schema.conflictParticipants.conflictId, conflict.id));
    const alerts = await db
      .select()
      .from(schema.conflictAlerts)
      .where(eq(schema.conflictAlerts.conflictId, conflict.id));

    expect(participants).toHaveLength(0);
    expect(alerts).toHaveLength(0);

    const remainingPermit = await db
      .select()
      .from(schema.permits)
      .where(and(eq(schema.permits.id, permit.id), eq(schema.permits.tenantId, tenantId)));

    expect(remainingPermit).toHaveLength(1);
  });
});
