import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

describe('LOTOTO configuration schema (PUS-154)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const userId = randomUUID();

  function testIds() {
    return {
      tenantId: randomUUID(),
      permitTypeId: randomUUID(),
    };
  }

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

  async function seedPermit(tenantId: string, permitTypeId: string) {
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId,
        title: 'LOTOTO integration permit',
        reference: `PTW-LTO-${randomUUID().slice(0, 8)}`,
        createdBy: userId,
      })
      .returning();

    return permit;
  }

  async function seedEquipment(tenantId: string) {
    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({
        tenantId,
        code: `WS-${randomUUID().slice(0, 6)}`,
        name: 'Compressor bay',
        createdBy: userId,
      })
      .returning();

    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId,
        code: `MC-${randomUUID().slice(0, 6)}`,
        name: 'Main compressor',
        workstationId: workstation.id,
        createdBy: userId,
      })
      .returning();

    return { workstation, machinery };
  }

  async function seedPlan(tenantId: string, permitId: string, machineryId: string) {
    const [plan] = await db
      .insert(schema.lototoPlans)
      .values({
        tenantId,
        permitId,
        machineryId,
        title: 'Primary isolation plan',
        description: 'Isolate compressor before maintenance',
        status: 'draft',
        createdBy: userId,
      })
      .returning();

    return plan;
  }

  dbTest('stores LOTOTO plan linked to permit', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId);
    const { machinery } = await seedEquipment(tenantId);

    const [plan] = await db
      .insert(schema.lototoPlans)
      .values({
        tenantId,
        permitId: permit.id,
        machineryId: machinery.id,
        title: 'Compressor isolation',
        description: 'Lock out main drive',
        createdBy: userId,
      })
      .returning();

    expect(plan.permitId).toBe(permit.id);
    expect(plan.status).toBe('draft');
  });

  dbTest('allows multiple LOTOTO plans per permit', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId);
    const { machinery } = await seedEquipment(tenantId);

    await db.insert(schema.lototoPlans).values([
      {
        tenantId,
        permitId: permit.id,
        machineryId: machinery.id,
        title: 'Plan A',
        createdBy: userId,
      },
      {
        tenantId,
        permitId: permit.id,
        machineryId: machinery.id,
        title: 'Plan B',
        createdBy: userId,
      },
    ]);

    const plans = await db
      .select()
      .from(schema.lototoPlans)
      .where(eq(schema.lototoPlans.permitId, permit.id));

    expect(plans).toHaveLength(2);
  });

  dbTest('rejects LOTOTO plan for non-existent permit', async () => {
    const { tenantId } = testIds();

    await expect(
      db.insert(schema.lototoPlans).values({
        tenantId,
        permitId: randomUUID(),
        title: 'Orphan plan',
        createdBy: userId,
      }),
    ).rejects.toThrow(/lototo_plans require an existing permit/i);
  });

  dbTest('stores equipment energy sources and isolation points', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId);
    const { machinery } = await seedEquipment(tenantId);
    const plan = await seedPlan(tenantId, permit.id, machinery.id);

    const [energySource] = await db
      .insert(schema.equipmentEnergySources)
      .values({
        planId: plan.id,
        machineryId: machinery.id,
        energySourceType: 'electrical',
        lockMethod: 'breaker_lock',
        tagType: 'danger',
        createdBy: userId,
      })
      .returning();

    const [point] = await db
      .insert(schema.isolationPoints)
      .values({
        planId: plan.id,
        machineryId: machinery.id,
        equipmentEnergySourceId: energySource.id,
        isolationNumber: 'ISO-001',
        description: 'Main breaker',
        createdBy: userId,
      })
      .returning();

    expect(point.equipmentEnergySourceId).toBe(energySource.id);
  });

  dbTest('rejects isolation point referencing energy source from another plan', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId);
    const { machinery } = await seedEquipment(tenantId);
    const planA = await seedPlan(tenantId, permit.id, machinery.id);
    const planB = await seedPlan(tenantId, permit.id, machinery.id);

    const [energySource] = await db
      .insert(schema.equipmentEnergySources)
      .values({
        planId: planA.id,
        machineryId: machinery.id,
        energySourceType: 'pneumatic',
        createdBy: userId,
      })
      .returning();

    await expect(
      db.insert(schema.isolationPoints).values({
        planId: planB.id,
        machineryId: machinery.id,
        equipmentEnergySourceId: energySource.id,
        isolationNumber: 'ISO-002',
        createdBy: userId,
      }),
    ).rejects.toThrow(/equipment_energy_source_id must belong to the same plan/i);
  });

  dbTest('stores personnel assignments and isolation sequence', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId);
    const { machinery } = await seedEquipment(tenantId);
    const plan = await seedPlan(tenantId, permit.id, machinery.id);

    const officerId = randomUUID();
    const verifierId = randomUUID();

    await db.insert(schema.lototoAssignments).values([
      {
        planId: plan.id,
        workforceUserId: officerId,
        role: 'isolation_officer',
        createdBy: userId,
      },
      {
        planId: plan.id,
        workforceUserId: verifierId,
        role: 'verifier',
        createdBy: userId,
      },
    ]);

    const [point] = await db
      .insert(schema.isolationPoints)
      .values({
        planId: plan.id,
        machineryId: machinery.id,
        isolationNumber: 'ISO-010',
        createdBy: userId,
      })
      .returning();

    const [sequence] = await db
      .insert(schema.isolationSequences)
      .values({
        planId: plan.id,
        isolationPointId: point.id,
        sequenceOrder: 1,
        createdBy: userId,
      })
      .returning();

    expect(sequence.sequenceOrder).toBe(1);
  });

  dbTest('rejects duplicate isolation sequence order within a plan', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId);
    const { machinery } = await seedEquipment(tenantId);
    const plan = await seedPlan(tenantId, permit.id, machinery.id);

    const [pointA] = await db
      .insert(schema.isolationPoints)
      .values({
        planId: plan.id,
        machineryId: machinery.id,
        isolationNumber: 'ISO-020',
        createdBy: userId,
      })
      .returning();

    const [pointB] = await db
      .insert(schema.isolationPoints)
      .values({
        planId: plan.id,
        machineryId: machinery.id,
        isolationNumber: 'ISO-021',
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.isolationSequences).values({
      planId: plan.id,
      isolationPointId: pointA.id,
      sequenceOrder: 1,
      createdBy: userId,
    });

    await expect(
      db.insert(schema.isolationSequences).values({
        planId: plan.id,
        isolationPointId: pointB.id,
        sequenceOrder: 1,
        createdBy: userId,
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  dbTest('rejects isolation sequence for isolation point from another plan', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId);
    const { machinery } = await seedEquipment(tenantId);
    const planA = await seedPlan(tenantId, permit.id, machinery.id);
    const planB = await seedPlan(tenantId, permit.id, machinery.id);

    const [point] = await db
      .insert(schema.isolationPoints)
      .values({
        planId: planA.id,
        machineryId: machinery.id,
        isolationNumber: 'ISO-030',
        createdBy: userId,
      })
      .returning();

    await expect(
      db.insert(schema.isolationSequences).values({
        planId: planB.id,
        isolationPointId: point.id,
        sequenceOrder: 1,
        createdBy: userId,
      }),
    ).rejects.toThrow(/isolation_point_id must belong to the same plan/i);
  });

  dbTest('locks configuration once plan execution has begun', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId);
    const { machinery } = await seedEquipment(tenantId);
    const plan = await seedPlan(tenantId, permit.id, machinery.id);

    await db
      .update(schema.lototoPlans)
      .set({ status: 'in_execution', updatedBy: userId })
      .where(eq(schema.lototoPlans.id, plan.id));

    await expect(
      db.insert(schema.isolationPoints).values({
        planId: plan.id,
        machineryId: machinery.id,
        isolationNumber: 'ISO-040',
        createdBy: userId,
      }),
    ).rejects.toThrow(/configuration is locked once execution has begun/i);
  });

  dbTest('cascades LOTOTO plans when permit is deleted', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await seedPermit(tenantId, permitTypeId);
    const { machinery } = await seedEquipment(tenantId);
    const plan = await seedPlan(tenantId, permit.id, machinery.id);

    await db.insert(schema.isolationPoints).values({
      planId: plan.id,
      machineryId: machinery.id,
      isolationNumber: 'ISO-050',
      createdBy: userId,
    });

    await db.delete(schema.permits).where(eq(schema.permits.id, permit.id));

    const remaining = await db
      .select()
      .from(schema.lototoPlans)
      .where(eq(schema.lototoPlans.id, plan.id));

    expect(remaining).toHaveLength(0);
  });
});
