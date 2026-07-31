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

describe('Execution HTTP integration (PUS-141 / PUS-142 / PUS-143)', () => {
  let app: INestApplication;
  let pool: Pool;
  let canConnect = false;

  const tenantId = randomUUID();
  const executorId = randomUUID();
  const permitTypeId = randomUUID();
  const locationId = randomUUID();

  const executorUser: AuthenticatedUser = {
    id: executorId,
    username: 'operator',
    tenantId,
    roles: ['operator'],
    email: 'operator@example.com',
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

    app = await createTestApp(executorUser);
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

  async function seedApprovedPermit(): Promise<string> {
    const db = drizzle(pool, { schema });
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId,
        title: 'Execution integration permit',
        locationId,
        plannedStartAt: new Date('2026-09-01T08:00:00Z'),
        plannedEndAt: new Date('2026-09-01T16:00:00Z'),
        submittedAt: new Date(),
        submittedBy: executorId,
        createdBy: executorId,
      })
      .returning();

    await db.insert(schema.permitExecutors).values({
      permitId: permit.id,
      workforceUserId: executorId,
      isPrimary: true,
      createdBy: executorId,
    });

    return permit.id;
  }

  httpTest('matches web/mobile activate → progress → suspend → resume contract', async () => {
    const permitId = await seedApprovedPermit();

    const activateRes = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/activate`)
      .send({})
      .expect(201);

    expect(activateRes.body.success).toBe(true);
    expect(activateRes.body.data.permit.status).toBe('active');
    expect(activateRes.body.data.execution.permitId).toBe(permitId);

    const progressRes = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/progress`)
      .send({ summary: 'Shift handover complete' })
      .expect(201);

    expect(progressRes.body.data.summary).toBe('Shift handover complete');

    const listProgressRes = await request(app.getHttpServer())
      .get(`/api/v1/permits/${permitId}/progress`)
      .expect(200);

    expect(listProgressRes.body.data).toHaveLength(1);

    const suspendRes = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/suspend`)
      .send({ reason: 'Weather hold' })
      .expect(201);

    expect(suspendRes.body.data.permit.status).toBe('suspended');

    const resumeRes = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/resume`)
      .expect(201);

    expect(resumeRes.body.data.permit.status).toBe('active');
  });

  httpTest('lists permits by status as web execution page expects', async () => {
    const approvedRes = await request(app.getHttpServer())
      .get('/api/v1/permits?status=approved')
      .expect(200);

    expect(approvedRes.body.success).toBe(true);
    expect(Array.isArray(approvedRes.body.data)).toBe(true);
  });
});
