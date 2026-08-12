import { readFileSync } from 'fs';
import { join } from 'path';
import { BillingCacheService } from '../app/src/modules/billing/billing-cache.service';
import { BillingJobsService } from '../app/src/modules/billing/billing-jobs.service';
import { BillingLogService } from '../app/src/modules/billing/billing-log.service';

const repoRoot = join(__dirname, '..');

describe('Billing infra services (PUS-214)', () => {
  it('BillingCacheService builds tenant-scoped keys and invalidates', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const cache = new BillingCacheService(
      { del } as never,
      { get: () => 300 } as never,
    );
    expect(cache.planKey('standard')).toBe('billing:plan:standard');
    expect(cache.subscriptionKey('t1')).toBe('billing:subscription:t1');
    expect(cache.usageKey('t1', 'users', '2026-07')).toBe('billing:usage:t1:users:2026-07');

    await cache.invalidateSubscription('t1');
    expect(del).toHaveBeenCalledWith('billing:subscription:t1');
  });

  it('BillingLogService emits a Loki-tagged structured event', () => {
    const log = new BillingLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);
    log.logEvent({ action: 'billing.cycle-invoice', subscriptionId: 's1' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ loki: true, action: 'billing.cycle-invoice' }),
    );
  });

  it('BillingJobsService processes due renewals for invoicing', async () => {
    const due = [
      {
        subscription: {
          id: 's1',
          tenantId: 't1',
          status: 'active',
          renewAt: new Date('2026-07-01T00:00:00.000Z'),
          periodStart: new Date('2026-06-01T00:00:00.000Z'),
          periodEnd: new Date('2026-07-01T00:00:00.000Z'),
          createdBy: 'admin-1',
        },
        plan: { priceMinor: 1000, currency: 'INR' },
      },
    ];
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => Promise.resolve(due),
            }),
          }),
        })
        .mockReturnValue({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      insert: () => ({
        values: () => Promise.resolve(undefined),
      }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new BillingJobsService(
      db as never,
      {} as never,
      { get: () => '0 2 * * *' } as never,
      logService as never,
      { fromBillingRenewal: jest.fn() } as never,
    );

    await jobs.processBillingCycle();
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.cycle-invoice', subscriptionId: 's1' }),
    );
  });

  it('BillingJobsService emits usage aggregation sweep', async () => {
    const logService = { logEvent: jest.fn() };
    const jobs = new BillingJobsService(
      {} as never,
      {} as never,
      { get: () => '0 * * * *' } as never,
      logService as never,
      { fromBillingRenewal: jest.fn() } as never,
    );

    await jobs.aggregateUsage();
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.usage-aggregate' }),
    );
  });

  it('BillingJobsService notifies admins of upcoming renewals', async () => {
    const upcoming = [
      { id: 's1', tenantId: 't1', renewAt: new Date(), createdBy: 'admin-1' },
    ];
    const canonicalNotifications = { fromBillingRenewal: jest.fn().mockResolvedValue(undefined) };
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(upcoming) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new BillingJobsService(
      db as never,
      {} as never,
      {
        get: (key: string) => (key === 'billing.renewalHorizonDays' ? 7 : '0 9 * * *'),
      } as never,
      logService as never,
      canonicalNotifications as never,
    );

    await jobs.notifyUpcomingRenewals();
    expect(canonicalNotifications.fromBillingRenewal).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: 's1', adminUserId: 'admin-1' }),
    );
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.renewal-notify', tenantId: 't1' }),
    );
  });

  it('.env.example and deployment docs cover billing infra knobs', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    expect(envExample).toMatch(/BILLING_CYCLE_INVOICE_CRON/);
    expect(envExample).toMatch(/BILLING_USAGE_AGGREGATE_CRON/);
    expect(envExample).toMatch(/BILLING_RENEWAL_NOTIFY_CRON/);
    expect(deployment).toMatch(/billing\.cycle-invoice/);
    expect(deployment).toMatch(/BILLING_RENEWAL_HORIZON_DAYS/);
  });
});
