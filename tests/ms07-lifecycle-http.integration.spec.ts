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
import { EscalationService } from '../app/src/modules/notifications/escalation.service';
import { ReminderService } from '../app/src/modules/notifications/reminder.service';
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

describe('MS-07 lifecycle HTTP integration (ITC-NTF-001–005)', () => {
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

  httpTest('ITC-NTF-001: generate test notification and deliver to recipient', async () => {
    const server = app.getHttpServer();

    const testRes = await request(server)
      .post('/api/v1/notifications/test')
      .send({ title: 'MS-07 lifecycle test', body: 'Integration delivery check' })
      .expect(201);

    expect(testRes.body.data.notification.title).toBe('MS-07 lifecycle test');
    expect(testRes.body.data.recipients).toHaveLength(1);
    expect(testRes.body.data.recipients[0].deliveryStatus).toBe('delivered');
  });

  httpTest('ITC-NTF-002: reminder service creates reminder notification visible via HTTP', async () => {
    const server = app.getHttpServer();
    const reminderService = app.get(ReminderService);
    const dedupeKey = `ms07-reminder:${randomUUID()}`;

    const created = await reminderService.createReminder(
      {
        title: 'Pending approval reminder',
        body: 'A permit awaits your approval.',
        recipientUserId: userId,
        entityType: 'permit',
        entityId: randomUUID(),
        dedupeKey,
      },
      adminUser,
    );

    expect(created.notification.category).toBe('reminder');
    expect(created.notification.eventType).toBe('task_reminder');

    const listRes = await request(server).get('/api/v1/notifications').expect(200);
    expect(
      listRes.body.data.some(
        (row: { id: string }) => row.id === created.notification.id,
      ),
    ).toBe(true);
  });

  httpTest('ITC-NTF-003: escalation service creates critical escalation notification', async () => {
    const server = app.getHttpServer();
    const escalationService = app.get(EscalationService);

    const created = await escalationService.createEscalation(
      {
        title: 'Overdue isolation verification',
        body: 'LOTOTO verification is overdue and requires immediate action.',
        recipientUserId: userId,
        priority: 'critical',
        entityType: 'lototo_plan',
        entityId: randomUUID(),
        dedupeKey: `ms07-escalation:${randomUUID()}`,
      },
      adminUser,
    );

    expect(created.notification.category).toBe('escalation');
    expect(created.notification.priority).toBe('critical');

    const listRes = await request(server).get('/api/v1/notifications').expect(200);
    const row = listRes.body.data.find(
      (item: { id: string }) => item.id === created.notification.id,
    );
    expect(row).toBeTruthy();
    expect(row.priority).toBe('critical');
  });

  httpTest('ITC-NTF-004/005: view notification history and mark as read', async () => {
    const server = app.getHttpServer();
    const db = drizzle(pool, { schema });

    const testRes = await request(server)
      .post('/api/v1/notifications/test')
      .send({ title: 'History test', body: 'Read-state verification' })
      .expect(201);
    const notificationId = testRes.body.data.notification.id;

    const getRes = await request(server)
      .get(`/api/v1/notifications/${notificationId}`)
      .expect(200);
    expect(getRes.body.data.title).toBe('History test');
    expect(getRes.body.data.recipient.readAt).toBeNull();

    const historyBefore = await db
      .select()
      .from(schema.notificationHistory)
      .where(eq(schema.notificationHistory.notificationId, notificationId));
    expect(historyBefore.some((entry) => entry.action === 'created')).toBe(true);

    const readRes = await request(server)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .expect(200);
    expect(readRes.body.data.recipient.readAt).toBeTruthy();

    const historyAfter = await db
      .select()
      .from(schema.notificationHistory)
      .where(eq(schema.notificationHistory.notificationId, notificationId));
    expect(historyAfter.some((entry) => entry.action === 'read')).toBe(true);

    const unreadRes = await request(server)
      .get('/api/v1/notifications')
      .query({ unreadOnly: true })
      .expect(200);
    expect(
      unreadRes.body.data.some((row: { id: string }) => row.id === notificationId),
    ).toBe(false);
  });

  httpTest('NTC-NTF-002: duplicate dedupe key does not create a second notification', async () => {
    const reminderService = app.get(ReminderService);
    const dedupeKey = `ms07-dedupe:${randomUUID()}`;
    const payload = {
      title: 'Duplicate guard',
      body: 'Should only appear once.',
      recipientUserId: userId,
      dedupeKey,
    };

    const first = await reminderService.createReminder(payload, adminUser);
    const second = await reminderService.createReminder(payload, adminUser);

    expect(second.deduplicated).toBe(true);
    expect(second.notification.id).toBe(first.notification.id);
  });

  httpTest('NTC-NTF-004: recipient cannot access another user notification', async () => {
    const server = app.getHttpServer();
    const otherUserId = randomUUID();
    const otherApp = await createTestApp({
      ...adminUser,
      id: otherUserId,
      username: 'other-user',
    });

    try {
      const testRes = await request(server)
        .post('/api/v1/notifications/test')
        .send({ title: 'Private notification', body: 'Admin only' })
        .expect(201);
      const notificationId = testRes.body.data.notification.id;

      await request(otherApp.getHttpServer())
        .get(`/api/v1/notifications/${notificationId}`)
        .expect(404);
    } finally {
      await otherApp.close();
    }
  });
});
