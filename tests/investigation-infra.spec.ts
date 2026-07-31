import { InvestigationCacheService } from '../app/src/modules/investigation/investigation-cache.service';
import { InvestigationJobsService } from '../app/src/modules/investigation/investigation-jobs.service';
import { InvestigationLogService } from '../app/src/modules/investigation/investigation-log.service';
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..');

describe('Investigation infra services (PUS-195)', () => {
  it('InvestigationCacheService builds tenant-scoped keys', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const cache = new InvestigationCacheService(
      { del } as never,
      { get: () => 300 } as never,
    );
    expect(cache.detailKey('t1', 'i1')).toBe('investigation:detail:t1:i1');
    await cache.invalidate('t1', 'i1');
    expect(del).toHaveBeenCalledWith('investigation:detail:t1:i1');
  });

  it('InvestigationLogService emits Loki-tagged events', () => {
    const log = new InvestigationLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);
    log.logEvent({ action: 'investigation.assigned', incidentId: 'i1' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ loki: true, action: 'investigation.assigned' }),
    );
  });

  it('InvestigationJobsService flags overdue corrective actions', async () => {
    const overdue = [
      {
        id: 'a1',
        tenantId: 't1',
        investigationId: 'inv1',
        dueDate: '2026-07-01',
      },
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(overdue) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new InvestigationJobsService(
      db as never,
      {} as never,
      { get: () => '0 9 * * *' } as never,
      logService as never,
    );
    await jobs.flagOverdueActions();
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'investigation.overdue-action' }),
    );
  });

  it('.env.example and deployment docs cover investigation infra knobs', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    expect(envExample).toMatch(/INVESTIGATION_OVERDUE_ACTION_CRON/);
    expect(deployment).toMatch(/investigation\.overdue-actions/);
  });
});
