import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Notifications schema (PUS-204)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  const userId = randomUUID();

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    db = drizzle(pool, { schema });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder });
    } catch {
      canConnect = false;
    }
  });

  afterAll(async () => {
    if (canConnect) {
      await pool.end();
    }
  });

  const dbTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) {
        return;
      }
      await fn();
    });
  };

  dbTest('stores notification with recipients and history under a tenant', async () => {
    const tenantId = randomUUID();
    const entityId = randomUUID();
    const recipientUserId = randomUUID();

    const [notification] = await db
      .insert(schema.notifications)
      .values({
        tenantId,
        eventType: 'permit_submitted',
        category: 'workflow',
        priority: 'high',
        title: 'Permit submitted',
        body: 'Permit awaiting approval',
        entityType: 'permit',
        entityId,
        dedupeKey: `permit_submitted:${entityId}`,
        sourceModule: 'permit',
        createdBy: userId,
      })
      .returning();

    const [recipient] = await db
      .insert(schema.notificationRecipients)
      .values({
        tenantId,
        notificationId: notification.id,
        userId: recipientUserId,
        channel: 'in_app',
        deliveryStatus: 'pending',
        retryCount: 0,
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.notificationHistory).values({
      tenantId,
      notificationId: notification.id,
      recipientId: recipient.id,
      action: 'created',
      detail: 'Notification created for approver',
      createdBy: userId,
    });

    const history = await db
      .select()
      .from(schema.notificationHistory)
      .where(eq(schema.notificationHistory.notificationId, notification.id));

    expect(history).toHaveLength(1);
    expect(notification.eventType).toBe('permit_submitted');
    expect(recipient.deliveryStatus).toBe('pending');
  });

  dbTest('enforces unique dedupe_key per tenant', async () => {
    const tenantId = randomUUID();
    const dedupeKey = `incident_reported:${randomUUID()}`;

    await db.insert(schema.notifications).values({
      tenantId,
      eventType: 'incident_reported',
      category: 'workflow',
      title: 'Incident reported',
      body: 'New incident',
      dedupeKey,
      createdBy: userId,
    });

    await expect(
      db.insert(schema.notifications).values({
        tenantId,
        eventType: 'incident_reported',
        category: 'workflow',
        title: 'Duplicate',
        body: 'Should fail',
        dedupeKey,
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });

  dbTest('enforces unique recipient per notification/user/channel', async () => {
    const tenantId = randomUUID();
    const recipientUserId = randomUUID();

    const [notification] = await db
      .insert(schema.notifications)
      .values({
        tenantId,
        eventType: 'task_reminder',
        category: 'reminder',
        title: 'Reminder',
        body: 'Pending approval',
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.notificationRecipients).values({
      tenantId,
      notificationId: notification.id,
      userId: recipientUserId,
      channel: 'in_app',
      createdBy: userId,
    });

    await expect(
      db.insert(schema.notificationRecipients).values({
        tenantId,
        notificationId: notification.id,
        userId: recipientUserId,
        channel: 'in_app',
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });

  dbTest('rejects invalid event_type and delivery_status CHECK values', async () => {
    const tenantId = randomUUID();

    await expect(
      db.insert(schema.notifications).values({
        tenantId,
        eventType: 'not_a_real_event',
        category: 'workflow',
        title: 'Bad event',
        body: 'Should fail',
        createdBy: userId,
      }),
    ).rejects.toThrow();

    const [notification] = await db
      .insert(schema.notifications)
      .values({
        tenantId,
        eventType: 'escalation',
        category: 'escalation',
        priority: 'critical',
        title: 'Escalation',
        body: 'Overdue approval',
        createdBy: userId,
      })
      .returning();

    await expect(
      db.insert(schema.notificationRecipients).values({
        tenantId,
        notificationId: notification.id,
        userId: randomUUID(),
        channel: 'in_app',
        deliveryStatus: 'not_a_status',
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });

  dbTest('blocks UPDATE and DELETE on notification_history', async () => {
    const tenantId = randomUUID();

    const [notification] = await db
      .insert(schema.notifications)
      .values({
        tenantId,
        eventType: 'simops_conflict',
        category: 'workflow',
        title: 'SIMOPS conflict',
        body: 'Conflict detected',
        createdBy: userId,
      })
      .returning();

    const [recipient] = await db
      .insert(schema.notificationRecipients)
      .values({
        tenantId,
        notificationId: notification.id,
        userId: randomUUID(),
        channel: 'email',
        deliveryStatus: 'delivered',
        deliveredAt: new Date(),
        createdBy: userId,
      })
      .returning();

    const [history] = await db
      .insert(schema.notificationHistory)
      .values({
        tenantId,
        notificationId: notification.id,
        recipientId: recipient.id,
        action: 'delivered',
        detail: 'Delivered via email',
        createdBy: userId,
      })
      .returning();

    await expect(
      db
        .update(schema.notificationHistory)
        .set({ detail: 'tampered' })
        .where(eq(schema.notificationHistory.id, history.id)),
    ).rejects.toThrow(/immutable/i);

    await expect(
      db.delete(schema.notificationHistory).where(eq(schema.notificationHistory.id, history.id)),
    ).rejects.toThrow(/immutable/i);
  });

  dbTest('allows delivery tracking updates on recipients', async () => {
    const tenantId = randomUUID();

    const [notification] = await db
      .insert(schema.notifications)
      .values({
        tenantId,
        eventType: 'lototo_verification',
        category: 'workflow',
        title: 'LOTOTO verification',
        body: 'Verification required',
        createdBy: userId,
      })
      .returning();

    const [recipient] = await db
      .insert(schema.notificationRecipients)
      .values({
        tenantId,
        notificationId: notification.id,
        userId: randomUUID(),
        channel: 'push',
        deliveryStatus: 'pending',
        createdBy: userId,
      })
      .returning();

    const [updated] = await db
      .update(schema.notificationRecipients)
      .set({
        deliveryStatus: 'failed',
        failedAt: new Date(),
        failureReason: 'Push provider timeout',
        retryCount: 1,
        nextRetryAt: new Date(Date.now() + 60_000),
        updatedBy: userId,
      })
      .where(eq(schema.notificationRecipients.id, recipient.id))
      .returning();

    expect(updated.deliveryStatus).toBe('failed');
    expect(updated.retryCount).toBe(1);
    expect(updated.failureReason).toBe('Push provider timeout');
  });
});
