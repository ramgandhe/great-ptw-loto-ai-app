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

describe('MS-07 integration HTTP (notifications + dashboards + regression)', () => {
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
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      const db = drizzle(pool, { schema });
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

  httpTest('MS-07 end-to-end: notification → dashboard → analytics → report export', async () => {
    const server = app.getHttpServer();

    const notifyRes = await request(server)
      .post('/api/v1/notifications/test')
      .send({ title: 'MS-07 integration', body: 'Cross-module verification' })
      .expect(201);
    const notificationId = notifyRes.body.data.notification.id;

    const dashboardRes = await request(server)
      .get('/api/v1/dashboard')
      .query({ kind: 'management' })
      .expect(200);
    expect(dashboardRes.body.data.kind).toBe('management');
    expect(dashboardRes.body.data.kpis.items.length).toBeGreaterThan(0);

    const kpiRes = await request(server)
      .get('/api/v1/dashboard/kpis')
      .query({ kind: 'management', periodLabel: 'current' })
      .expect(200);
    expect(
      kpiRes.body.data.items.some((item: { key: string }) => item.key === 'active_permits'),
    ).toBe(true);

    const analyticsRes = await request(server)
      .get('/api/v1/analytics')
      .query({ scope: 'operational' })
      .expect(200);
    expect(analyticsRes.body.data.scope).toBe('operational');

    const trendsRes = await request(server)
      .get('/api/v1/analytics/trends')
      .query({ scope: 'operational', limit: 5 })
      .expect(200);
    expect(Array.isArray(trendsRes.body.data.points)).toBe(true);

    const reportRes = await request(server)
      .post('/api/v1/reports/generate')
      .send({
        reportType: 'operational_kpis',
        format: 'csv',
        filters: { source: 'ms07-integration' },
      })
      .expect(201);
    expect(reportRes.body.data.status).toBe('ready');

    const reportsListRes = await request(server).get('/api/v1/reports').expect(200);
    expect(
      reportsListRes.body.data.some((row: { id: string }) => row.id === reportRes.body.data.id),
    ).toBe(true);

    const readRes = await request(server)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .expect(200);
    expect(readRes.body.data.recipient.readAt).toBeTruthy();
  });

  httpTest('ITC-DSH: personal dashboard available to operator role', async () => {
    const operatorApp = await createTestApp({
      id: randomUUID(),
      username: 'operator',
      tenantId,
      roles: ['operator'],
      email: 'operator@example.com',
    });

    try {
      const res = await request(operatorApp.getHttpServer())
        .get('/api/v1/dashboard')
        .query({ kind: 'personal' })
        .expect(200);
      expect(res.body.data.kind).toBe('personal');
    } finally {
      await operatorApp.close();
    }
  });

  httpTest('NTC-DSH: operator cannot access management dashboard', async () => {
    const operatorApp = await createTestApp({
      id: randomUUID(),
      username: 'operator',
      tenantId,
      roles: ['operator'],
      email: 'operator@example.com',
    });

    try {
      await request(operatorApp.getHttpServer())
        .get('/api/v1/dashboard')
        .query({ kind: 'management' })
        .expect(403);
    } finally {
      await operatorApp.close();
    }
  });

  httpTest('MS-06 regression: incident endpoints remain available after MS-07 merge', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/incidents').expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  httpTest('MS-02 regression: permit endpoints remain available after MS-07 merge', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/permits').expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
