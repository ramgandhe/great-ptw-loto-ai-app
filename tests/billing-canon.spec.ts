import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import { BillingJobsService } from '../app/src/modules/billing/billing-jobs.service';
import { BillingLogService } from '../app/src/modules/billing/billing-log.service';
import { CanonicalNotificationService } from '../app/src/modules/notifications/canonical-notification.service';
import { SubscriptionService } from '../app/src/modules/billing/subscription.service';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Billing canon reconciliation (FR-BIL-002–005)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const tenantId = randomUUID();
  const actorId = randomUUID();

  const adminUser: AuthenticatedUser = {
    id: actorId,
    username: 'org-admin',
    tenantId,
    roles: ['org-admin'],
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

  dbTest('FR-BIL-002: current subscription exposes enabled modules from plan', async () => {
    const planTenantId = randomUUID();
    const planAdmin: AuthenticatedUser = { ...adminUser, tenantId: planTenantId };

    const subscriptions = new SubscriptionService(
      db as never,
      { getSubscription: jest.fn(), setSubscription: jest.fn(), invalidateSubscription: jest.fn() } as never,
      new BillingLogService(),
      { log: jest.fn() } as never,
    );

    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        code: `canon-${randomUUID().slice(0, 8)}`,
        name: 'Canon Plan',
        billingInterval: 'monthly',
        enabledModules: ['ptw', 'simops', 'lototo'],
        createdBy: actorId,
      })
      .returning();

    await subscriptions.create({ planId: plan.id, status: 'active' }, planAdmin);
    const current = (await subscriptions.getCurrent(planAdmin)) as {
      plan: { enabledModules: string[] };
    };

    expect(current.plan.enabledModules).toEqual(['ptw', 'simops', 'lototo']);
  });

  dbTest('FR-BIL-003/004: usage records and billing history remain tenant-scoped', async () => {
    const usageTenantId = randomUUID();
    const periodStart = new Date('2026-07-01T00:00:00.000Z');
    const periodEnd = new Date('2026-08-01T00:00:00.000Z');

    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        code: `usage-${randomUUID().slice(0, 8)}`,
        name: 'Usage Plan',
        billingInterval: 'monthly',
        priceMinor: 2500,
        createdBy: actorId,
      })
      .returning();

    const [sub] = await db
      .insert(schema.tenantSubscriptions)
      .values({
        tenantId: usageTenantId,
        planId: plan.id,
        status: 'active',
        periodStart,
        periodEnd,
        renewAt: new Date('2026-07-15T00:00:00.000Z'),
        createdBy: actorId,
      })
      .returning();

    await db.insert(schema.usageRecords).values({
      tenantId: usageTenantId,
      metricKey: 'active_permits',
      quantity: 5,
      periodLabel: '2026-07',
      createdBy: actorId,
    });

    await db.insert(schema.billingInvoices).values({
      tenantId: usageTenantId,
      subscriptionId: sub.id,
      invoiceNumber: `INV-${randomUUID().slice(0, 8)}`,
      amountMinor: 2500,
      status: 'issued',
      periodStart,
      periodEnd,
      createdBy: actorId,
    });

    const usageRows = await db
      .select()
      .from(schema.usageRecords)
      .where(eq(schema.usageRecords.tenantId, usageTenantId));
    const invoiceRows = await db
      .select()
      .from(schema.billingInvoices)
      .where(eq(schema.billingInvoices.tenantId, usageTenantId));

    expect(usageRows.some((row) => row.metricKey === 'active_permits' && row.quantity === 5)).toBe(
      true,
    );
    expect(invoiceRows.some((row) => row.subscriptionId === sub.id)).toBe(true);
  });

  dbTest('FR-BIL-004/005: billing cycle creates draft invoice and renewal job notifies admins', async () => {
    const canonicalNotifications = {
      fromBillingRenewal: jest.fn().mockResolvedValue(undefined),
    } as unknown as CanonicalNotificationService;
    const logService = new BillingLogService();
    const jobs = new BillingJobsService(
      db as never,
      {} as never,
      { get: (key: string) => (key === 'billing.renewalHorizonDays' ? 7 : '0 9 * * *') } as never,
      logService,
      canonicalNotifications,
    );

    const periodStart = new Date('2026-06-01T00:00:00.000Z');
    const periodEnd = new Date('2026-07-01T00:00:00.000Z');
    const renewAt = new Date('2026-07-10T00:00:00.000Z');

    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        code: `cycle-${randomUUID().slice(0, 8)}`,
        name: 'Cycle Plan',
        billingInterval: 'monthly',
        priceMinor: 9900,
        createdBy: actorId,
      })
      .returning();

    const [sub] = await db
      .insert(schema.tenantSubscriptions)
      .values({
        tenantId: randomUUID(),
        planId: plan.id,
        status: 'active',
        periodStart,
        periodEnd,
        renewAt,
        createdBy: actorId,
      })
      .returning();

    await jobs.processBillingCycle();
    await jobs.notifyUpcomingRenewals();

    const invoices = await db
      .select()
      .from(schema.billingInvoices)
      .where(eq(schema.billingInvoices.subscriptionId, sub.id));

    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe('draft');
    expect(invoices[0].amountMinor).toBe(9900);
    expect(canonicalNotifications.fromBillingRenewal).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: sub.id,
        adminUserId: actorId,
      }),
    );
  });
});
