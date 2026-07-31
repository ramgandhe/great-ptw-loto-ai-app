import { ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../app/src/app.module';
import { JwtAuthGuard } from '../app/src/common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import { QueueService } from '../app/src/infrastructure/queue/queue.service';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

let currentUser: AuthenticatedUser | null = null;

function dynamicAuthGuard() {
  return {
    canActivate: (context: ExecutionContext) => {
      if (!currentUser) {
        return false;
      }
      context.switchToHttp().getRequest().user = currentUser;
      return true;
    },
  };
}

async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JwtAuthGuard)
    .useValue(dynamicAuthGuard())
    .overrideProvider(QueueService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
      registerHandler: jest.fn(),
      getQueue: () => ({ add: jest.fn().mockResolvedValue(undefined) }),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: 'v1', prefix: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

describe('SIMOPS Conflict Detection HTTP (PUS-166)', () => {
  let app: INestApplication;
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const supervisorId = randomUUID();
  const issuerId = randomUUID();
  const workstationId = randomUUID();

  const supervisor: AuthenticatedUser = {
    id: supervisorId,
    username: 'supervisor',
    tenantId,
    roles: ['supervisor'],
    email: 'supervisor@example.com',
  };

  const viewer: AuthenticatedUser = {
    id: randomUUID(),
    username: 'viewer',
    tenantId,
    roles: ['viewer'],
    email: 'viewer@example.com',
  };

  const otherTenantUser: AuthenticatedUser = {
    id: randomUUID(),
    username: 'other-supervisor',
    tenantId: otherTenantId,
    roles: ['supervisor'],
    email: 'other@example.com',
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    db = drizzle(pool, { schema });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder });
    } catch {
      canConnect = false;
      return;
    }

    await db.insert(schema.workstationCatalogue).values({
      id: workstationId,
      tenantId,
      code: `WS-${workstationId.slice(0, 8)}`,
      name: 'SIMOPS test bay',
      createdBy: supervisorId,
    });

    const [hotWork] = await db
      .insert(schema.permitTypes)
      .values({
        tenantId,
        code: 'HOT-WORK',
        name: 'Hot Work',
        createdBy: supervisorId,
      })
      .returning();

    const [confined] = await db
      .insert(schema.permitTypes)
      .values({
        tenantId,
        code: 'CONFINED-SPACE',
        name: 'Confined Space',
        createdBy: supervisorId,
      })
      .returning();

    await db.insert(schema.permits).values([
      {
        tenantId,
        status: 'active',
        permitTypeId: hotWork.id,
        title: 'Older hot work',
        reference: `PTW-SIM-${randomUUID().slice(0, 8)}`,
        workstationId,
        plannedStartAt: new Date('2026-08-01T08:00:00.000Z'),
        plannedEndAt: new Date('2026-08-01T16:00:00.000Z'),
        submittedBy: issuerId,
        createdBy: supervisorId,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      {
        tenantId,
        status: 'approved',
        permitTypeId: confined.id,
        title: 'Newer confined space',
        reference: `PTW-SIM-${randomUUID().slice(0, 8)}`,
        workstationId,
        plannedStartAt: new Date('2026-08-01T10:00:00.000Z'),
        plannedEndAt: new Date('2026-08-01T14:00:00.000Z'),
        submittedBy: issuerId,
        createdBy: supervisorId,
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
      },
    ]);

    app = await createTestApp();
  });

  afterAll(async () => {
    if (canConnect) {
      const conflicts = await db
        .select({ id: schema.simopsConflicts.id })
        .from(schema.simopsConflicts)
        .where(eq(schema.simopsConflicts.tenantId, tenantId));
      for (const conflict of conflicts) {
        await db
          .delete(schema.conflictParticipants)
          .where(eq(schema.conflictParticipants.conflictId, conflict.id));
        await db
          .delete(schema.conflictAlerts)
          .where(eq(schema.conflictAlerts.conflictId, conflict.id));
        await db.delete(schema.simopsConflicts).where(eq(schema.simopsConflicts.id, conflict.id));
      }
      await db.delete(schema.permits).where(eq(schema.permits.tenantId, tenantId));
      await db.delete(schema.permitTypes).where(eq(schema.permitTypes.tenantId, tenantId));
      await db
        .delete(schema.workstationCatalogue)
        .where(eq(schema.workstationCatalogue.id, workstationId));
    }
    if (app) {
      await app.close();
    }
    if (canConnect) {
      await pool.end();
    }
  });

  const httpTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) {
        return;
      }
      await fn();
    });
  };

  httpTest('rejects unauthenticated access', async () => {
    currentUser = null;
    await request(app.getHttpServer()).get('/api/v1/simops/conflicts').expect(403);
  });

  httpTest('denies viewer from triggering analyse', async () => {
    currentUser = viewer;
    await request(app.getHttpServer()).post('/api/v1/simops/analyse').send({}).expect(403);
  });

  httpTest('analyses overlapping permits and lists conflicts/alerts', async () => {
    currentUser = supervisor;

    const analyse = await request(app.getHttpServer())
      .post('/api/v1/simops/analyse')
      .send({})
      .expect(201);

    expect(analyse.body.success).toBe(true);
    expect(analyse.body.data.created).toBeGreaterThanOrEqual(1);
    expect(analyse.body.data.candidateCount).toBeGreaterThanOrEqual(2);

    const list = await request(app.getHttpServer()).get('/api/v1/simops/conflicts').expect(200);
    expect(list.body.success).toBe(true);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);

    const conflictId = list.body.data[0].id as string;
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/simops/conflicts/${conflictId}`)
      .expect(200);

    expect(detail.body.data.conflict.id).toBe(conflictId);
    expect(detail.body.data.participants).toHaveLength(2);
    expect(detail.body.data.participants.some((p: { isFrozen: boolean }) => p.isFrozen)).toBe(
      true,
    );
    expect(detail.body.data.alerts.length).toBeGreaterThanOrEqual(1);

    const alerts = await request(app.getHttpServer()).get('/api/v1/simops/alerts').expect(200);
    expect(Array.isArray(alerts.body.data)).toBe(true);
    expect(alerts.body.data.length).toBeGreaterThanOrEqual(1);

    const again = await request(app.getHttpServer())
      .post('/api/v1/simops/analyse')
      .send({})
      .expect(201);
    expect(again.body.data.skipped).toBeGreaterThanOrEqual(1);
  });

  httpTest('does not leak conflicts across tenants', async () => {
    currentUser = otherTenantUser;
    const list = await request(app.getHttpServer()).get('/api/v1/simops/conflicts').expect(200);
    expect(list.body.data).toEqual([]);
  });
});
