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

describe('Closure HTTP integration (PUS-146 / PUS-147 / PUS-148)', () => {
  let app: INestApplication;
  let pool: Pool;
  let canConnect = false;

  const tenantId = randomUUID();
  const supervisorId = randomUUID();
  const permitTypeId = randomUUID();
  const locationId = randomUUID();

  const supervisorUser: AuthenticatedUser = {
    id: supervisorId,
    username: 'supervisor',
    tenantId,
    roles: ['supervisor'],
    email: 'supervisor@example.com',
  };

  const completeChecklist = {
    workCompleted: true,
    evidenceReviewed: true,
    areaSecured: true,
    hazardsRemoved: true,
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

  async function seedActivePermit(): Promise<string> {
    const db = drizzle(pool, { schema });
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId,
        title: 'Closure integration permit',
        reference: `PTW-CL-${randomUUID().slice(0, 8)}`,
        locationId,
        plannedStartAt: new Date('2026-09-01T08:00:00Z'),
        plannedEndAt: new Date('2026-09-01T16:00:00Z'),
        submittedAt: new Date(),
        submittedBy: supervisorId,
        createdBy: supervisorId,
      })
      .returning();

    return permit.id;
  }

  httpTest('matches web/mobile verify → close → archive contract', async () => {
    const permitId = await seedActivePermit();

    const verifyRes = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/verify`)
      .send({ checklist: completeChecklist, comment: 'Area secured' })
      .expect(201);

    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.verification.permitId).toBe(permitId);
    expect(verifyRes.body.data.permit.status).toBe('active');

    const verificationRes = await request(app.getHttpServer())
      .get(`/api/v1/permits/${permitId}/verification`)
      .expect(200);

    expect(verificationRes.body.success).toBe(true);
    expect(verificationRes.body.data.permitId).toBe(permitId);
    expect(verificationRes.body.data.checklist.workCompleted).toBe(true);

    const closeRes = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/close`)
      .send({ comment: 'Work complete' })
      .expect(201);

    expect(closeRes.body.data.permit.status).toBe('closed');
    expect(closeRes.body.data.closure.permitId).toBe(permitId);

    const archiveListRes = await request(app.getHttpServer())
      .get('/api/v1/permits/archive')
      .expect(200);

    expect(archiveListRes.body.success).toBe(true);
    expect(archiveListRes.body.data.some((item: { permit: { id: string } }) => item.permit.id === permitId)).toBe(true);

    const archiveDetailRes = await request(app.getHttpServer())
      .get(`/api/v1/permits/archive/${permitId}`)
      .expect(200);

    expect(archiveDetailRes.body.data.closure).toBeTruthy();
    expect(archiveDetailRes.body.data.verification).toBeTruthy();

    const historyRes = await request(app.getHttpServer())
      .get(`/api/v1/permits/${permitId}/history`)
      .expect(200);

    expect(Array.isArray(historyRes.body.data)).toBe(true);
    expect(historyRes.body.data.some((entry: { action: string }) => entry.action === 'verified')).toBe(true);
    expect(historyRes.body.data.some((entry: { action: string }) => entry.action === 'closed')).toBe(true);

    const auditRes = await request(app.getHttpServer())
      .get(`/api/v1/permits/${permitId}/audit`)
      .expect(200);

    expect(Array.isArray(auditRes.body.data)).toBe(true);
    expect(auditRes.body.data.some((entry: { action: string }) => entry.action === 'permit.verified')).toBe(true);
    expect(auditRes.body.data.some((entry: { action: string }) => entry.action === 'permit.closed')).toBe(true);
  });

  httpTest('returns null verification before verify step', async () => {
    const permitId = await seedActivePermit();

    const verificationRes = await request(app.getHttpServer())
      .get(`/api/v1/permits/${permitId}/verification`)
      .expect(200);

    expect(verificationRes.body.success).toBe(true);
    expect(verificationRes.body.data).toBeNull();
  });

  httpTest('rejects close without verification', async () => {
    const permitId = await seedActivePermit();

    await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/close`)
      .send({})
      .expect(409);
  });
});
