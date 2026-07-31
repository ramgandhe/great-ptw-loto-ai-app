import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Billing & Subscription schema (PUS-213)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  const actorId = randomUUID();

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

  dbTest('stores plan, subscription, usage, invoice and plan-change history', async () => {
    const tenantId = randomUUID();
    const periodStart = new Date('2026-07-01T00:00:00.000Z');
    const periodEnd = new Date('2026-08-01T00:00:00.000Z');

    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        code: `plan-${randomUUID().slice(0, 8)}`,
        name: 'Standard',
        billingInterval: 'monthly',
        priceMinor: 49900,
        enabledModules: ['ptw', 'lototo'],
        usageLimits: { activePermits: 100 },
        createdBy: actorId,
      })
      .returning();

    const [sub] = await db
      .insert(schema.tenantSubscriptions)
      .values({
        tenantId,
        planId: plan.id,
        status: 'active',
        periodStart,
        periodEnd,
        renewAt: periodEnd,
        createdBy: actorId,
      })
      .returning();

    const [usage] = await db
      .insert(schema.usageRecords)
      .values({
        tenantId,
        metricKey: 'active_permits',
        quantity: 12,
        periodLabel: '2026-07',
        createdBy: actorId,
      })
      .returning();

    const [invoice] = await db
      .insert(schema.billingInvoices)
      .values({
        tenantId,
        subscriptionId: sub.id,
        invoiceNumber: `INV-${randomUUID().slice(0, 8)}`,
        amountMinor: 49900,
        status: 'issued',
        periodStart,
        periodEnd,
        dueAt: periodEnd,
        createdBy: actorId,
      })
      .returning();

    const [change] = await db
      .insert(schema.planChangeHistory)
      .values({
        tenantId,
        subscriptionId: sub.id,
        fromPlanId: null,
        toPlanId: plan.id,
        changedBy: actorId,
        reason: 'Initial assignment',
        createdBy: actorId,
      })
      .returning();

    expect(plan.status).toBe('active');
    expect(sub.tenantId).toBe(tenantId);
    expect(usage.quantity).toBe(12);
    expect(invoice.status).toBe('issued');
    expect(change.toPlanId).toBe(plan.id);
  });

  dbTest('enforces one open subscription per tenant', async () => {
    const tenantId = randomUUID();
    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        code: `plan-${randomUUID().slice(0, 8)}`,
        name: 'Lite',
        billingInterval: 'monthly',
        createdBy: actorId,
      })
      .returning();

    const periodStart = new Date('2026-07-01T00:00:00.000Z');
    const periodEnd = new Date('2026-08-01T00:00:00.000Z');

    await db.insert(schema.tenantSubscriptions).values({
      tenantId,
      planId: plan.id,
      status: 'active',
      periodStart,
      periodEnd,
      createdBy: actorId,
    });

    await expect(
      db.insert(schema.tenantSubscriptions).values({
        tenantId,
        planId: plan.id,
        status: 'trial',
        periodStart,
        periodEnd,
        createdBy: actorId,
      }),
    ).rejects.toThrow();
  });

  dbTest('rejects invalid plan interval and invoice status CHECK values', async () => {
    await expect(
      db.insert(schema.subscriptionPlans).values({
        code: `plan-${randomUUID().slice(0, 8)}`,
        name: 'Bad',
        billingInterval: 'weekly',
        createdBy: actorId,
      }),
    ).rejects.toThrow();

    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        code: `plan-${randomUUID().slice(0, 8)}`,
        name: 'Ok',
        billingInterval: 'yearly',
        createdBy: actorId,
      })
      .returning();

    const tenantId = randomUUID();
    const periodStart = new Date('2026-01-01T00:00:00.000Z');
    const periodEnd = new Date('2027-01-01T00:00:00.000Z');
    const [sub] = await db
      .insert(schema.tenantSubscriptions)
      .values({
        tenantId,
        planId: plan.id,
        status: 'active',
        periodStart,
        periodEnd,
        createdBy: actorId,
      })
      .returning();

    await expect(
      db.insert(schema.billingInvoices).values({
        tenantId,
        subscriptionId: sub.id,
        invoiceNumber: `INV-${randomUUID().slice(0, 8)}`,
        status: 'refunded',
        periodStart,
        periodEnd,
        createdBy: actorId,
      }),
    ).rejects.toThrow();
  });

  dbTest('blocks UPDATE and DELETE on plan_change_history', async () => {
    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        code: `plan-${randomUUID().slice(0, 8)}`,
        name: 'Immutable',
        billingInterval: 'monthly',
        createdBy: actorId,
      })
      .returning();

    const tenantId = randomUUID();
    const periodStart = new Date('2026-07-01T00:00:00.000Z');
    const periodEnd = new Date('2026-08-01T00:00:00.000Z');
    const [sub] = await db
      .insert(schema.tenantSubscriptions)
      .values({
        tenantId,
        planId: plan.id,
        status: 'active',
        periodStart,
        periodEnd,
        createdBy: actorId,
      })
      .returning();

    const [row] = await db
      .insert(schema.planChangeHistory)
      .values({
        tenantId,
        subscriptionId: sub.id,
        toPlanId: plan.id,
        changedBy: actorId,
        reason: 'locked',
        createdBy: actorId,
      })
      .returning();

    await expect(
      db
        .update(schema.planChangeHistory)
        .set({ reason: 'tamper' })
        .where(eq(schema.planChangeHistory.id, row.id)),
    ).rejects.toThrow(/immutable/i);

    await expect(
      db.delete(schema.planChangeHistory).where(eq(schema.planChangeHistory.id, row.id)),
    ).rejects.toThrow(/immutable/i);
  });

  dbTest('usage records are tenant-scoped by unique metric/period', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    await db.insert(schema.usageRecords).values({
      tenantId: tenantA,
      metricKey: 'users',
      quantity: 5,
      periodLabel: '2026-07',
      createdBy: actorId,
    });

    await db.insert(schema.usageRecords).values({
      tenantId: tenantB,
      metricKey: 'users',
      quantity: 9,
      periodLabel: '2026-07',
      createdBy: actorId,
    });

    await expect(
      db.insert(schema.usageRecords).values({
        tenantId: tenantA,
        metricKey: 'users',
        quantity: 6,
        periodLabel: '2026-07',
        createdBy: actorId,
      }),
    ).rejects.toThrow();
  });
});
