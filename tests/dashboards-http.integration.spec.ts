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

describe('Dashboards HTTP API (PUS-206)', () => {
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

  httpTest('GET /dashboard returns role-based payload', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .query({ kind: 'management' })
      .expect(200);

    expect(res.body.data.kind).toBe('management');
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.kpis.items.length).toBeGreaterThan(0);
    expect(res.body.data.preferences.dashboardKind).toBe('management');
  });

  httpTest('GET /dashboard/kpis returns KPI bundle', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/kpis')
      .query({ kind: 'management', periodLabel: 'current' })
      .expect(200);

    expect(res.body.data.kind).toBe('management');
    expect(res.body.data.items.some((i: { key: string }) => i.key === 'active_permits')).toBe(
      true,
    );
  });

  httpTest('POST /reports/generate → list reports', async () => {
    const server = app.getHttpServer();

    const gen = await request(server)
      .post('/api/v1/reports/generate')
      .send({
        reportType: 'operational_kpis',
        format: 'csv',
        filters: { source: 'smoke' },
      })
      .expect(201);

    expect(gen.body.data.status).toBe('ready');
    expect(gen.body.data.storageKey).toMatch(/dashboards\/reports/);

    const list = await request(server).get('/api/v1/reports').expect(200);
    expect(list.body.data.some((r: { id: string }) => r.id === gen.body.data.id)).toBe(true);
  });

  httpTest('GET /analytics and /analytics/trends', async () => {
    const server = app.getHttpServer();

    const analytics = await request(server)
      .get('/api/v1/analytics')
      .query({ scope: 'operational' })
      .expect(200);
    expect(analytics.body.data.scope).toBe('operational');
    expect(['live', 'snapshot']).toContain(analytics.body.data.source);

    const trends = await request(server)
      .get('/api/v1/analytics/trends')
      .query({ scope: 'operational', limit: 5 })
      .expect(200);
    expect(trends.body.data.scope).toBe('operational');
    expect(Array.isArray(trends.body.data.points)).toBe(true);
  });

  httpTest('rejects restricted dashboard kind for operator', async () => {
    const operatorApp = await createTestApp({
      id: randomUUID(),
      username: 'operator',
      tenantId,
      roles: ['operator'],
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
});
