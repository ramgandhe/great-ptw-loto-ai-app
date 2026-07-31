import { IncidentClosureCacheService } from '../app/src/modules/incident-closure/incident-closure-cache.service';
import { IncidentClosureJobsService } from '../app/src/modules/incident-closure/incident-closure-jobs.service';
import { IncidentClosureLogService } from '../app/src/modules/incident-closure/incident-closure-log.service';
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..');

describe('Incident Closure infra services (PUS-200)', () => {
  it('IncidentClosureCacheService builds archive keys', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const cache = new IncidentClosureCacheService(
      { del } as never,
      { get: () => 300 } as never,
    );
    expect(cache.archiveListKey('t1')).toBe('incident:archive:list:t1');
    await cache.invalidateArchive('t1', 'i1');
    expect(del).toHaveBeenCalledWith('incident:archive:detail:t1:i1');
  });

  it('IncidentClosureLogService emits Loki-tagged events', () => {
    const log = new IncidentClosureLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);
    log.logEvent({ action: 'incident.closed', incidentId: 'i1' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ loki: true, action: 'incident.closed' }),
    );
  });

  it('IncidentClosureJobsService flags verified incidents', async () => {
    const pending = [{ id: 'i1', tenantId: 't1', reference: 'INC-1' }];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(pending) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new IncidentClosureJobsService(
      db as never,
      {} as never,
      { get: () => '0 10 * * *' } as never,
      logService as never,
    );
    await jobs.notifyPendingClosures();
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.closure-pending' }),
    );
  });

  it('.env.example and deployment docs cover closure infra knobs', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    expect(envExample).toMatch(/INCIDENT_CLOSURE_NOTIFY_CRON/);
    expect(deployment).toMatch(/incident\.closure-notify/);
  });
});
