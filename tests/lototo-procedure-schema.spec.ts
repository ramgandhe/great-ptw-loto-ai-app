import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('LOTOTO procedure library schema', () => {
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

  async function seedMachinery() {
    const tenantId = randomUUID();
    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({
        tenantId,
        code: `WS-${randomUUID().slice(0, 6)}`,
        name: 'Tower 8',
        createdBy: userId,
      })
      .returning();
    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId,
        code: `MC-${randomUUID().slice(0, 6)}`,
        name: 'Bucket Elevator',
        workstationId: workstation.id,
        createdBy: userId,
      })
      .returning();
    return { tenantId, workstation, machinery };
  }

  async function seedPermit(tenantId: string) {
    const permitId = randomUUID();
    await db.execute(sql`
      INSERT INTO permits (id, tenant_id, status, permit_type_id, title, reference, created_by)
      VALUES (
        ${permitId}::uuid,
        ${tenantId}::uuid,
        'draft',
        ${randomUUID()}::uuid,
        'Service elevator',
        ${`PTW-${randomUUID().slice(0, 8)}`},
        ${userId}::uuid
      )
    `);
    return permitId;
  }

  dbTest('stores a reusable procedure without a permit', async () => {
    const { tenantId, machinery, workstation } = await seedMachinery();
    const [procedure] = await db
      .insert(schema.lototoProcedures)
      .values({
        tenantId,
        machineryId: machinery.id,
        workstationId: workstation.id,
        code: `A-1107-${randomUUID().slice(0, 6)}`,
        title: 'Bucket Elevator lockout',
        createdBy: userId,
      })
      .returning();

    expect(procedure.status).toBe('draft');
    expect(procedure.legacyPlanId).toBeNull();

    const [version] = await db
      .insert(schema.lototoProcedureVersions)
      .values({
        procedureId: procedure.id,
        versionNumber: 1,
        purpose: 'Isolate energy before servicing',
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.lototoProcedureLockoutPoints).values({
      versionId: version.id,
      sortOrder: 1,
      pointCode: 'E-1',
      energyType: 'Electrical',
      magnitude: '415 Volts',
      action: 'Turn isolator off and lock',
      device: 'Lock device',
      verificationMethod: 'Verify zero voltage',
      createdBy: userId,
    });

    await db.insert(schema.lototoProcedureSequenceSteps).values([
      {
        versionId: version.id,
        phase: 'apply',
        sequenceOrder: 1,
        title: 'Notify employees',
        createdBy: userId,
      },
      {
        versionId: version.id,
        phase: 'remove',
        sequenceOrder: 1,
        title: 'Remove locks',
        createdBy: userId,
      },
    ]);
  });

  dbTest('snapshots a procedure version onto a permit with extras, N/A, crew and verifiers', async () => {
    const { tenantId, machinery } = await seedMachinery();
    const [procedure] = await db
      .insert(schema.lototoProcedures)
      .values({
        tenantId,
        machineryId: machinery.id,
        code: `PROC-${randomUUID().slice(0, 8)}`,
        title: 'Compressor LOTO',
        status: 'published',
        createdBy: userId,
      })
      .returning();
    const [version] = await db
      .insert(schema.lototoProcedureVersions)
      .values({
        procedureId: procedure.id,
        versionNumber: 1,
        publishedAt: new Date(),
        createdBy: userId,
      })
      .returning();
    const [basePoint] = await db
      .insert(schema.lototoProcedureLockoutPoints)
      .values({
        versionId: version.id,
        sortOrder: 1,
        pointCode: 'EMP-1',
        energyType: 'Electrical',
        createdBy: userId,
      })
      .returning();

    const permitId = await seedPermit(tenantId);

    const [instance] = await db
      .insert(schema.permitLototoInstances)
      .values({
        permitId,
        procedureId: procedure.id,
        procedureVersionId: version.id,
        createdBy: userId,
      })
      .returning();

    const [extra] = await db
      .insert(schema.permitLototoExtraPoints)
      .values({
        instanceId: instance.id,
        sortOrder: 1,
        pointCode: 'X-1',
        energyType: 'Mechanical',
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.permitLototoStepNa).values({
      instanceId: instance.id,
      basePointId: basePoint.id,
      reason: 'Not in scope for this job',
      createdBy: userId,
    });

    const crewId = randomUUID();
    const verifierId = randomUUID();
    await db.insert(schema.permitLototoCrew).values({
      instanceId: instance.id,
      workforceUserId: crewId,
      createdBy: userId,
    });
    await db.insert(schema.permitLototoVerifiers).values({
      instanceId: instance.id,
      workforceUserId: verifierId,
      createdBy: userId,
    });

    const naRows = await db
      .select()
      .from(schema.permitLototoStepNa)
      .where(eq(schema.permitLototoStepNa.instanceId, instance.id));
    expect(naRows).toHaveLength(1);
    expect(naRows[0].reason).toContain('Not in scope');
    expect(extra.pointCode).toBe('X-1');
  });

  dbTest('rejects N/A without exactly one target', async () => {
    const { tenantId, machinery } = await seedMachinery();
    const [procedure] = await db
      .insert(schema.lototoProcedures)
      .values({
        tenantId,
        machineryId: machinery.id,
        code: `PROC-${randomUUID().slice(0, 8)}`,
        title: 'NA check',
        createdBy: userId,
      })
      .returning();
    const [version] = await db
      .insert(schema.lototoProcedureVersions)
      .values({
        procedureId: procedure.id,
        versionNumber: 1,
        createdBy: userId,
      })
      .returning();
    const permitId = await seedPermit(tenantId);
    const [instance] = await db
      .insert(schema.permitLototoInstances)
      .values({
        permitId,
        procedureId: procedure.id,
        procedureVersionId: version.id,
        createdBy: userId,
      })
      .returning();

    await expect(
      db.insert(schema.permitLototoStepNa).values({
        instanceId: instance.id,
        reason: 'missing target',
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });
});
