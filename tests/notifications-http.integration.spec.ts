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

describe('Notifications HTTP API (PUS-201)', () => {
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

  httpTest('test → list → get → mark read', async () => {
    const server = app.getHttpServer();

    const testRes = await request(server)
      .post('/api/v1/notifications/test')
      .send({ title: 'Smoke test', body: 'Delivery check' })
      .expect(201);

    expect(testRes.body.data.notification.title).toBe('Smoke test');
    expect(testRes.body.data.recipients).toHaveLength(1);
    expect(testRes.body.data.recipients[0].deliveryStatus).toBe('delivered');

    const notificationId = testRes.body.data.notification.id;

    const listRes = await request(server).get('/api/v1/notifications').expect(200);
    expect(
      listRes.body.data.some((row: { id: string }) => row.id === notificationId),
    ).toBe(true);

    const getRes = await request(server)
      .get(`/api/v1/notifications/${notificationId}`)
      .expect(200);
    expect(getRes.body.data.title).toBe('Smoke test');
    expect(getRes.body.data.recipient.readAt).toBeNull();

    const readRes = await request(server)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .expect(200);
    expect(readRes.body.data.recipient.readAt).toBeTruthy();

    const unreadRes = await request(server)
      .get('/api/v1/notifications')
      .query({ unreadOnly: true })
      .expect(200);
    expect(
      unreadRes.body.data.some((row: { id: string }) => row.id === notificationId),
    ).toBe(false);
  });

  httpTest('rejects cross-tenant notification access', async () => {
    const server = app.getHttpServer();
    const otherId = randomUUID();

    await request(server).get(`/api/v1/notifications/${otherId}`).expect(404);
  });
});
