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
    );
    await jobs.sendRevalidationReminders();
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mdp.revalidation-reminder' }),
    );
  });

  it('documents revalidation cron env vars', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    expect(envExample).toMatch(/MDP_REVALIDATION_REMINDER_CRON/);
    expect(envExample).toMatch(/MDP_EXTENSION_EXPIRY_CRON/);
    expect(deployment).toMatch(/mdp\.revalidation-reminder/);
  });
});
