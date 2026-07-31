import { DailyProgressCacheService } from '../app/src/modules/daily-progress/daily-progress-cache.service';
import { DailyProgressJobsService } from '../app/src/modules/daily-progress/daily-progress-jobs.service';
import { DailyProgressLogService } from '../app/src/modules/daily-progress/daily-progress-log.service';
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..');

describe('Daily Progress infra services (PUS-180)', () => {
  it('DailyProgressCacheService builds tenant-scoped keys and invalidates', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const cache = new DailyProgressCacheService(
      { del } as never,
      { get: () => 300 } as never,
    );
    expect(cache.activeListKey('t1')).toBe('mdp:active:t1');
    expect(cache.permitProgressKey('t1', 'p1')).toBe('mdp:progress:t1:p1');

    await cache.invalidatePermit('t1', 'p1');
    expect(del).toHaveBeenCalledWith('mdp:progress:t1:p1');
    expect(del).toHaveBeenCalledWith('mdp:active:t1');
  });

  it('DailyProgressLogService emits a Loki-tagged structured event', () => {
    const log = new DailyProgressLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);
    log.logEvent({ action: 'mdp.progress.submitted', permitId: 'p1' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ loki: true, action: 'mdp.progress.submitted' }),
    );
  });

  it('DailyProgressJobsService reminders flag active permits', async () => {
    const active = [
      { id: 'p1', tenantId: 't1', reference: 'PTW-1' },
      { id: 'p2', tenantId: 't1', reference: 'PTW-2' },
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(active) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new DailyProgressJobsService(
      db as never,
      {} as never,
      { get: () => '0 7 * * *' } as never,
      logService as never,
    );

    await jobs.sendReminders();
    expect(logService.logEvent).toHaveBeenCalledTimes(2);
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mdp.daily-reminder', permitId: 'p1' }),
    );
  });

  it('.env.example and deployment docs cover MDP infra knobs', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    expect(envExample).toMatch(/MDP_DAILY_REMINDER_CRON/);
    expect(envExample).toMatch(/MDP_EVIDENCE_PREFIX/);
    expect(deployment).toMatch(/mdp\.daily-reminder/);
    expect(deployment).toMatch(/MDP_EVIDENCE_PREFIX/);
  });
});
