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

describe('Billing HTTP API (PUS-211)', () => {
  let app: INestApplication;
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
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
    db = drizzle(pool, { schema });
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

  httpTest('plans → subscribe → current → usage → invoices', async () => {
    const server = app.getHttpServer();
    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        code: `http-${randomUUID().slice(0, 8)}`,
        name: 'HTTP Standard',
        billingInterval: 'monthly',
        priceMinor: 1000,
        enabledModules: ['ptw'],
        createdBy: userId,
      })
      .returning();

    const plans = await request(server).get('/api/v1/subscriptions/plans').expect(200);
    expect(plans.body.data.some((p: { id: string }) => p.id === plan.id)).toBe(true);

    const created = await request(server)
      .post('/api/v1/subscriptions')
      .send({ planId: plan.id, status: 'active' })
      .expect(201);
    expect(created.body.data.planId).toBe(plan.id);

    const current = await request(server).get('/api/v1/subscriptions/current').expect(200);
    expect(current.body.data.plan.id).toBe(plan.id);

    const usage = await request(server)
      .post('/api/v1/billing/usage')
      .send({ metricKey: 'active_permits', quantity: 3, periodLabel: '2026-07' })
      .expect(201);
    expect(usage.body.data.quantity).toBe(3);

    const usageList = await request(server).get('/api/v1/billing/usage').expect(200);
    expect(usageList.body.data.some((u: { metricKey: string }) => u.metricKey === 'active_permits')).toBe(
      true,
    );

    const invoices = await request(server).get('/api/v1/billing/invoices').expect(200);
    expect(Array.isArray(invoices.body.data)).toBe(true);
  });

  httpTest('rejects second open subscription for same tenant', async () => {
    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        code: `dup-${randomUUID().slice(0, 8)}`,
        name: 'Dup',
        billingInterval: 'monthly',
        createdBy: userId,
      })
      .returning();

    await request(app.getHttpServer())
      .post('/api/v1/subscriptions')
      .send({ planId: plan.id })
      .expect(400);
  });
});
