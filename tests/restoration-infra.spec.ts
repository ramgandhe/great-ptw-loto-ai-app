import { readFileSync } from 'fs';
import { join } from 'path';
import { RestorationCacheService } from '../app/src/modules/restoration/restoration-cache.service';
import { RestorationLogService } from '../app/src/modules/restoration/restoration-log.service';
import { RestorationJobsService } from '../app/src/modules/restoration/restoration-jobs.service';

const repoRoot = join(__dirname, '..');

describe('Restoration infra services (PUS-165)', () => {
  it('RestorationCacheService builds tenant-scoped keys and invalidates all views', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const cache = new RestorationCacheService({ del } as never, { get: () => 300 } as never);

    expect(cache.restorationDetailKey('t1', 'e1')).toBe('restoration:detail:t1:e1');
    expect(cache.historyByExecutionKey('t1', 'e1')).toBe('restoration:history:exec:t1:e1');
    expect(cache.historyByPlanKey('t1', 'p1')).toBe('restoration:history:plan:t1:p1');

    await cache.invalidate('t1', 'e1', 'p1');
    expect(del).toHaveBeenCalledWith('restoration:detail:t1:e1', 'restoration:history:exec:t1:e1');
    expect(del).toHaveBeenCalledWith('restoration:history:plan:t1:p1');
  });

  it('RestorationLogService emits a Loki-tagged structured event', () => {
    const log = new RestorationLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);
    log.logEvent({ action: 'restoration.equipment.restored', executionId: 'e1' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ loki: true, action: 'restoration.equipment.restored', module: 'lototo-restoration' }),
    );
  });

  it('RestorationJobsService notifies verified executions pending restoration', async () => {
    const pending = [
      { id: 'e1', planId: 'p1', tenantId: 't1', status: 'verified' },
      { id: 'e2', planId: 'p2', tenantId: 't1', status: 'verified' },
    ];
    const db = { select: () => ({ from: () => ({ where: () => Promise.resolve(pending) }) }) };
    const logService = { logEvent: jest.fn() };
    const jobs = new RestorationJobsService(
      db as never,
      {} as never,
      { get: () => '0 */6 * * *' } as never,
      logService as never,
    );

    await jobs.sendNotifications();
    expect(logService.logEvent).toHaveBeenCalledTimes(2);
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'restoration.pending_notification', executionId: 'e1' }),
    );
  });

  it('.env.example documents restoration configuration (no silent divergence)', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    for (const key of [
      'RESTORATION_CACHE_TTL_SECONDS',
      'RESTORATION_NOTIFICATION_CRON',
      'RESTORATION_EVIDENCE_URL_EXPIRY_SECONDS',
    ]) {
      expect(envExample).toContain(`${key}=`);
    }
  });
});
