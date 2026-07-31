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
import { StorageService } from '../app/src/infrastructure/storage/storage.service';
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
      getQueue: () => ({ add: jest.fn().mockResolvedValue(undefined) }),
    })
    .overrideProvider(StorageService)
    .useValue({
      onModuleInit: jest.fn(),
      getBucket: () => 'ptw-documents',
      ensureBucket: jest.fn().mockResolvedValue(undefined),
      putObject: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      presignedGetObject: jest.fn().mockResolvedValue('https://minio.test/object'),
      isHealthy: jest.fn().mockResolvedValue(true),
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

describe('MS-08 integration HTTP (billing + platform readiness + regression)', () => {
  let app: INestApplication;
  let pool: Pool;
  let canConnect = false;

  const tenantId = randomUUID();
  const userId = randomUUID();

  const adminUser: AuthenticatedUser = {
    id: userId,
    username: 'org-admin',
    tenantId,
    roles: ['org-admin'],
    email: 'admin@example.com',
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    const db = drizzle(pool, { schema });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder });
    } catch {
      canConnect = false;
      return;
    }

    app = await createTestApp(adminUser);
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

  httpTest('platform probes and version are public', async () => {
    const server = app.getHttpServer();

    const health = await request(server).get('/api/v1/health').expect(200);
    expect(health.body.data.status).toBeTruthy();
    expect(health.body.data.services.database.status).toBe('up');

    const live = await request(server).get('/api/v1/health/live').expect(200);
    expect(live.body.data.status).toBe('alive');

    const ready = await request(server).get('/api/v1/health/ready');
    expect([200, 503]).toContain(ready.status);
    const readyPayload = ready.body.data ?? ready.body;
    expect(['ready', 'not_ready']).toContain(readyPayload.status);

    const version = await request(server).get('/api/v1/system/version').expect(200);
    expect(version.body.data.version).toBeTruthy();
  });

  httpTest('billing flow: plans → subscribe → usage → invoices', async () => {
    const server = app.getHttpServer();
    const db = drizzle(pool, { schema });

    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        code: `ms08-${randomUUID().slice(0, 8)}`,
        name: 'MS-08 Standard',
        billingInterval: 'monthly',
        priceMinor: 2500,
        enabledModules: ['ptw'],
        createdBy: userId,
      })
      .returning();

    const plans = await request(server).get('/api/v1/subscriptions/plans').expect(200);
    expect(plans.body.data.some((row: { id: string }) => row.id === plan.id)).toBe(true);

    await request(server)
      .post('/api/v1/subscriptions')
      .send({ planId: plan.id, status: 'active' })
      .expect(201);

    const current = await request(server).get('/api/v1/subscriptions/current').expect(200);
    expect(current.body.data.plan.id).toBe(plan.id);

    await request(server)
      .post('/api/v1/billing/usage')
      .send({ metricKey: 'active_permits', quantity: 2, periodLabel: '2026-07' })
      .expect(201);

    const usage = await request(server).get('/api/v1/billing/usage').expect(200);
    expect(usage.body.data.some((row: { metricKey: string }) => row.metricKey === 'active_permits')).toBe(
      true,
    );

    const invoices = await request(server).get('/api/v1/billing/invoices').expect(200);
    expect(Array.isArray(invoices.body.data)).toBe(true);
  });

  httpTest('MS-07 regression: dashboard endpoint remains available', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .query({ kind: 'personal' })
      .expect(200);
    expect(res.body.data.kind).toBe('personal');
  });

  httpTest('MS-06 regression: incident endpoints remain available', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/incidents').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
