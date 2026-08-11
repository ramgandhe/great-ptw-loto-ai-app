import { readFileSync } from 'fs';
import { join } from 'path';
import { RevalidationCacheService } from '../app/src/modules/revalidation/revalidation-cache.service';
import { RevalidationJobsService } from '../app/src/modules/revalidation/revalidation-jobs.service';
import { RevalidationLogService } from '../app/src/modules/revalidation/revalidation-log.service';

const repoRoot = join(__dirname, '..');

describe('Daily Revalidation infra services (PUS-185)', () => {
  it('RevalidationCacheService builds tenant-scoped keys', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const cache = new RevalidationCacheService(
      { del } as never,
      { get: () => 300 } as never,
    );
    expect(cache.permitKey('t1', 'p1')).toBe('mdp:revalidation:t1:p1');
    await cache.invalidatePermit('t1', 'p1');
    expect(del).toHaveBeenCalledWith('mdp:revalidation:t1:p1');
  });

  it('RevalidationLogService emits Loki-tagged events', () => {
    const log = new RevalidationLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);
    log.logEvent({ action: 'mdp.revalidation-reminder', permitId: 'p1' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ loki: true, action: 'mdp.revalidation-reminder' }),
    );
  });

  it('RevalidationJobsService reminders flag active permits', async () => {
    const active = [{ id: 'p1', tenantId: 't1', reference: 'PTW-1' }];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(active) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new RevalidationJobsService(
      db as never,
      {} as never,
      { get: () => '0 6 * * *' } as never,
      logService as never,
      { enqueueValidityNotification: jest.fn() } as never,
    );
    await jobs.sendRevalidationReminders();
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mdp.revalidation-reminder' }),
    );
  });

  it('RevalidationJobsService flags renewal-due and expired permits at day transition', async () => {
    const endSoon = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const endPast = new Date(Date.now() - 60_000);
    const candidates = [
      {
        id: 'p-renew',
        tenantId: 't1',
        reference: 'PTW-1',
        status: 'active',
        plannedEndAt: endSoon,
        submittedBy: 'issuer-1',
      },
      {
        id: 'p-expired',
        tenantId: 't1',
        reference: 'PTW-2',
        status: 'active',
        plannedEndAt: endPast,
        submittedBy: 'issuer-2',
      },
    ];

    const update = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    const insert = jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
    const db = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(candidates),
        }),
      }),
      update: () => ({ set: () => update() }),
      insert: () => insert(),
    };

    const logService = { logEvent: jest.fn() };
    const notify = { enqueueValidityNotification: jest.fn().mockResolvedValue(undefined) };
    const jobs = new RevalidationJobsService(
      db as never,
      {} as never,
      { get: () => '0 0 * * *' } as never,
      logService as never,
      notify as never,
    );

    await jobs.runDayTransitionValidityChecks();

    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mdp.validity-renewal-due', permitId: 'p-renew' }),
    );
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mdp.validity-expired', permitId: 'p-expired' }),
    );
    expect(notify.enqueueValidityNotification).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalled();
  });

  it('documents revalidation cron env vars', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    expect(envExample).toMatch(/MDP_REVALIDATION_REMINDER_CRON/);
    expect(envExample).toMatch(/MDP_EXTENSION_EXPIRY_CRON/);
    expect(envExample).toMatch(/MDP_DAY_TRANSITION_VALIDITY_CRON/);
    expect(deployment).toMatch(/mdp\.revalidation-reminder/);
  });
});
