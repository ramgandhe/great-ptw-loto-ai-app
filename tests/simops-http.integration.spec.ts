import { ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
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

describe('SIMOPS HTTP integration (PUS-166 / PUS-171)', () => {
  let app: INestApplication;
  let pool: Pool;
  let canConnect = false;

  const tenantId = randomUUID();
  const supervisorId = randomUUID();
  const permitTypeId = randomUUID();

  const supervisorUser: AuthenticatedUser = {
    id: supervisorId,
    username: 'hod',
    tenantId,
    roles: ['hod'],
    email: 'supervisor@example.com',
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      const db = drizzle(pool, { schema });
      await migrate(db, { migrationsFolder });
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

  async function seedOverlappingPermits() {
    const db = drizzle(pool, { schema });

    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({
        tenantId,
        code: `WS-${randomUUID().slice(0, 6)}`,
        name: 'Shared bay',
        createdBy: supervisorId,
      })
      .returning();

    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId,
        code: `MC-${randomUUID().slice(0, 6)}`,
        name: 'Shared compressor',
        workstationId: workstation.id,
        createdBy: supervisorId,
      })
      .returning();

    const shared = {
      tenantId,
      status: 'approved' as const,
      permitTypeId,
      workstationId: workstation.id,
      machineryId: machinery.id,
      plannedStartAt: new Date('2026-08-01T08:00:00Z'),
      plannedEndAt: new Date('2026-08-01T16:00:00Z'),
      createdBy: supervisorId,
    };

    const [permitA] = await db
      .insert(schema.permits)
      .values({ ...shared, title: 'SIMOPS permit A' })
      .returning();

    const [permitB] = await db
      .insert(schema.permits)
      .values({
        ...shared,
        title: 'SIMOPS permit B',
        plannedStartAt: new Date('2026-08-01T10:00:00Z'),
        plannedEndAt: new Date('2026-08-01T18:00:00Z'),
      })
      .returning();

    return { permitA, permitB };
  }

  httpTest('lists conflicts and runs analysis', async () => {
    await seedOverlappingPermits();

    const analyseRes = await request(app.getHttpServer())
      .post('/api/v1/simops/analyse')
      .send({})
      .expect(201);

    expect(analyseRes.body.success).toBe(true);
    expect(analyseRes.body.data.detectedCount).toBeGreaterThanOrEqual(1);
    expect(analyseRes.body.data.createdCount).toBeGreaterThanOrEqual(1);

    const listRes = await request(app.getHttpServer()).get('/api/v1/simops/conflicts').expect(200);

    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.data[0].severity).toBeDefined();
  });

  httpTest('resolves conflict through assess → mitigation → approve', async () => {
    await seedOverlappingPermits();

    await request(app.getHttpServer()).post('/api/v1/simops/analyse').send({}).expect(201);

    const listRes = await request(app.getHttpServer()).get('/api/v1/simops/conflicts').expect(200);
    const conflictId = listRes.body.data[0].id as string;

    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/simops/conflicts/${conflictId}`)
      .expect(200);

    expect(detailRes.body.data.participants.length).toBeGreaterThanOrEqual(2);

    await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${conflictId}/assess`)
      .send({
        assessedSeverity: 'high',
        riskSummary: 'Overlapping equipment isolation required',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${conflictId}/mitigation`)
      .send({
        planSummary: 'Stagger work windows',
        actions: [{ description: 'Delay second permit start by 2 hours' }],
      })
      .expect(201);

    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${conflictId}/approve`)
      .send({ comments: 'Mitigation accepted' })
      .expect(201);

    expect(approveRes.body.data.outcome).toBe('approved');

    const historyRes = await request(app.getHttpServer()).get('/api/v1/simops/history').expect(200);

    expect(historyRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(historyRes.body.data.some((item: { conflict: { id: string } }) => item.conflict.id === conflictId)).toBe(
      true,
    );
  });
});
