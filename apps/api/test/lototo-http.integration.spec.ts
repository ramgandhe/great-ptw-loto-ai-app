import { ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../src/common/interfaces/authenticated-user.interface';
import { QueueService } from '../src/infrastructure/queue/queue.service';
import * as schema from '../src/database/schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

function authGuardAs(user: AuthenticatedUser) {
  return {
    canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = user;
      return true;
    },
  };
}

async function createTestApp(user: AuthenticatedUser): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(JwtAuthGuard)
    .useValue(authGuardAs(user))
    .overrideProvider(QueueService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
      registerHandler: jest.fn(),
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

describe('LOTOTO HTTP integration (PUS-151)', () => {
  let app: INestApplication;
  let pool: Pool;
  let canConnect = false;

  const tenantId = randomUUID();
  const supervisorId = randomUUID();
  const permitTypeId = randomUUID();
  const officerId = randomUUID();
  const verifierId = randomUUID();

  const supervisorUser: AuthenticatedUser = {
    id: supervisorId,
    username: 'supervisor',
    tenantId,
    roles: ['supervisor'],
    email: 'supervisor@example.com',
  };

  const viewerUser: AuthenticatedUser = {
    id: randomUUID(),
    username: 'viewer',
    tenantId,
    roles: ['viewer'],
    email: 'viewer@example.com',
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      const db = drizzle(pool, { schema });
      await migrate(db, { migrationsFolder: './src/database/migrations' });
    } catch {
      canConnect = false;
      return;
    }

    app = await createTestApp(supervisorUser);
  });

  afterAll(async () => {
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

  async function seedPermitAndEquipment() {
    const db = drizzle(pool, { schema });

    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId,
        title: 'LOTOTO integration permit',
        createdBy: supervisorId,
      })
      .returning();

    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({
        tenantId,
        code: `WS-${randomUUID().slice(0, 6)}`,
        name: 'Compressor bay',
        createdBy: supervisorId,
      })
      .returning();

    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId,
        code: `MC-${randomUUID().slice(0, 6)}`,
        name: 'Main compressor',
        workstationId: workstation.id,
        createdBy: supervisorId,
      })
      .returning();

    return { permit, machinery };
  }

  httpTest('creates LOTOTO plan linked to permit', async () => {
    const { permit, machinery } = await seedPermitAndEquipment();

    const res = await request(app.getHttpServer())
      .post('/api/v1/lototo/plans')
      .send({
        permitId: permit.id,
        machineryId: machinery.id,
        title: 'Compressor isolation',
        description: 'Lock out main drive',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.permitId).toBe(permit.id);
    expect(res.body.data.status).toBe('draft');
  });

  httpTest('lists LOTOTO plans filtered by permit', async () => {
    const { permit, machinery } = await seedPermitAndEquipment();

    await request(app.getHttpServer())
      .post('/api/v1/lototo/plans')
      .send({
        permitId: permit.id,
        machineryId: machinery.id,
        title: 'Plan A',
      })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/lototo/plans?permitId=${permit.id}`)
      .expect(200);

    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data.every((plan: { permitId: string }) => plan.permitId === permit.id)).toBe(
      true,
    );
  });

  httpTest('configures isolation points, assignments, and sequence', async () => {
    const { permit, machinery } = await seedPermitAndEquipment();

    const planRes = await request(app.getHttpServer())
      .post('/api/v1/lototo/plans')
      .send({
        permitId: permit.id,
        machineryId: machinery.id,
        title: 'Full configuration plan',
      })
      .expect(201);

    const planId = planRes.body.data.id;

    const pointRes = await request(app.getHttpServer())
      .post(`/api/v1/lototo/plans/${planId}/isolation-points`)
      .send({
        machineryId: machinery.id,
        isolationNumber: 'ISO-HTTP-001',
        energySource: {
          energySourceType: 'electrical',
          lockMethod: 'breaker_lock',
        },
      })
      .expect(201);

    expect(pointRes.body.data.isolationNumber).toBe('ISO-HTTP-001');

    await request(app.getHttpServer())
      .post(`/api/v1/lototo/plans/${planId}/assignments`)
      .send({ workforceUserId: officerId, role: 'isolation_officer' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/lototo/plans/${planId}/assignments`)
      .send({ workforceUserId: verifierId, role: 'verifier' })
      .expect(201);

    const sequenceRes = await request(app.getHttpServer())
      .post(`/api/v1/lototo/plans/${planId}/sequence`)
      .send({
        steps: [
          {
            isolationPointId: pointRes.body.data.id,
            sequenceOrder: 1,
            requiresVerification: true,
          },
        ],
      })
      .expect(201);

    expect(sequenceRes.body.data).toHaveLength(1);
    expect(sequenceRes.body.data[0].sequenceOrder).toBe(1);
  });

  httpTest('rejects LOTOTO plan for non-existent permit', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/lototo/plans')
      .send({
        permitId: randomUUID(),
        title: 'Orphan plan',
      })
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  httpTest('rejects duplicate isolation point number', async () => {
    const { permit, machinery } = await seedPermitAndEquipment();

    const planRes = await request(app.getHttpServer())
      .post('/api/v1/lototo/plans')
      .send({
        permitId: permit.id,
        machineryId: machinery.id,
        title: 'Duplicate isolation plan',
      })
      .expect(201);

    const planId = planRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/lototo/plans/${planId}/isolation-points`)
      .send({
        machineryId: machinery.id,
        isolationNumber: 'ISO-DUP-001',
      })
      .expect(201);

    const dupRes = await request(app.getHttpServer())
      .post(`/api/v1/lototo/plans/${planId}/isolation-points`)
      .send({
        machineryId: machinery.id,
        isolationNumber: 'ISO-DUP-001',
      })
      .expect(409);

    expect(dupRes.body.success).toBe(false);
  });

  httpTest('denies viewer from creating LOTOTO plans', async () => {
    const viewerApp = await createTestApp(viewerUser);

    try {
      const { permit } = await seedPermitAndEquipment();

      await request(viewerApp.getHttpServer())
        .post('/api/v1/lototo/plans')
        .send({
          permitId: permit.id,
          title: 'Viewer attempt',
        })
        .expect(403);
    } finally {
      await viewerApp.close();
    }
  });
});
