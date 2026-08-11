import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FR_BIL_TRACEABILITY, PLATFORM_MODULE_KEYS } from '../app/src/modules/billing/fr-bil.traceability';
import { BillingJobsService } from '../app/src/modules/billing/billing-jobs.service';
import { BillingService, UsageTrackingService } from '../app/src/modules/billing/billing.service';
import { SubscriptionService } from '../app/src/modules/billing/subscription.service';

describe('FR-BIL billing canon (PUS-248)', () => {
  it('maps FR-BIL-002…005 to surfaces and source tables', () => {
    for (const id of ['FR-BIL-002', 'FR-BIL-003', 'FR-BIL-004', 'FR-BIL-005'] as const) {
      expect(FR_BIL_TRACEABILITY[id].surface).toBeTruthy();
      expect(FR_BIL_TRACEABILITY[id].sourceTables.length).toBeGreaterThan(0);
    }
    expect(PLATFORM_MODULE_KEYS).toEqual(expect.arrayContaining(['ptw', 'lototo', 'simops']));
  });

  it('rejects over-limit usage writes (FR-BIL-003)', async () => {
    const db = {
      select: jest
        .fn()
        // resolveLimit join
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ usageLimits: { active_permits: 2 } }]),
              }),
            }),
          }),
        }),
    };
    const usage = new UsageTrackingService(
      db as never,
      { invalidateUsage: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

    await expect(
      usage.assertWithinLimit('t1', 'active_permits', 5),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows usage when under plan limit', async () => {
    const db = {
      select: jest.fn().mockReturnValue({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ usageLimits: { active_permits: 10 } }]),
            }),
          }),
        }),
      }),
    };
    const usage = new UsageTrackingService(
      db as never,
      { invalidateUsage: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );
    await expect(usage.assertWithinLimit('t1', 'active_permits', 3)).resolves.toBeUndefined();
  });

  it('denies modules not on the tenant plan (FR-BIL-002)', async () => {
    const db = {
      select: jest.fn().mockReturnValue({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ enabledModules: ['ptw'] }]),
            }),
          }),
        }),
      }),
    };
    const subs = new SubscriptionService(
      db as never,
      {} as never,
      { logEvent: jest.fn() } as never,
      { log: jest.fn() } as never,
    );
    await expect(subs.assertModuleEnabled('t1', 'simops')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(subs.isModuleEnabled('t1', 'ptw')).resolves.toBe(true);
  });

  it('drafts invoices idempotently and rejects invalid transitions (FR-BIL-004)', async () => {
    const periodStart = new Date('2026-08-01T00:00:00.000Z');
    const periodEnd = new Date('2026-09-01T00:00:00.000Z');
    const existing = {
      id: 'inv-1',
      tenantId: 't1',
      subscriptionId: 's1',
      invoiceNumber: 'INV-existing',
      amountMinor: 1000,
      currency: 'INR',
      status: 'draft',
      periodStart,
      periodEnd,
    };

    const select = jest
      .fn()
      // draft: load subscription+plan
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  {
                    subscription: {
                      id: 's1',
                      tenantId: 't1',
                      periodStart,
                      periodEnd,
                    },
                    plan: { priceMinor: 1000, currency: 'INR' },
                  },
                ]),
            }),
          }),
        }),
      })
      // draft: existing invoice for period
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([existing]),
          }),
        }),
      })
      // transition: load invoice
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ ...existing, status: 'paid' }]),
          }),
        }),
      });

    const billing = new BillingService(
      { select } as never,
      { logEvent: jest.fn() } as never,
      { log: jest.fn() } as never,
    );

    const draft = await billing.draftInvoiceForSubscription('s1');
    expect(draft.created).toBe(false);
    expect(draft.invoice.id).toBe('inv-1');

    await expect(
      billing.transitionInvoice('inv-1', 'paid', {
        id: 'u1',
        username: 'admin',
        roles: ['org-admin'],
        tenantId: 't1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('billing cycle drafts invoices for due subscriptions', async () => {
    const due = [
      {
        id: 's1',
        tenantId: 't1',
        status: 'active',
        renewAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(due) }) }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(undefined),
        }),
      }),
    };
    const billingService = {
      draftInvoiceForSubscription: jest.fn().mockResolvedValue({
        invoice: { id: 'inv-new', status: 'draft' },
        created: true,
      }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new BillingJobsService(
      db as never,
      {} as never,
      { get: () => '0 2 * * *' } as never,
      logService as never,
      billingService as never,
      {} as never,
      {} as never,
    );

    const count = await jobs.processBillingCycle();
    expect(count).toBe(1);
    expect(billingService.draftInvoiceForSubscription).toHaveBeenCalledWith('s1');
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.cycle-invoice', subscriptionId: 's1' }),
    );
  });

  it('renewal job dispatches notifications with dedupe key (FR-BIL-005)', async () => {
    const renewAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const upcoming = [
      {
        id: 's1',
        tenantId: 't1',
        renewAt,
        createdBy: '00000000-0000-0000-0000-0000000000aa',
        updatedBy: '00000000-0000-0000-0000-0000000000aa',
      },
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(upcoming) }) }),
    };
    const notificationsService = {
      generate: jest.fn().mockResolvedValue({ deduplicated: false }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new BillingJobsService(
      db as never,
      {} as never,
      {
        get: (key: string) => (key === 'billing.renewalHorizonDays' ? 7 : '0 9 * * *'),
      } as never,
      logService as never,
      {} as never,
      {} as never,
      notificationsService as never,
    );

    const notified = await jobs.notifyUpcomingRenewals();
    expect(notified).toBe(1);
    expect(notificationsService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'subscription_renewal',
        dedupeKey: expect.stringContaining('billing:renewal:s1:'),
        sourceModule: 'billing',
      }),
      expect.objectContaining({ tenantId: 't1' }),
    );
  });
});
