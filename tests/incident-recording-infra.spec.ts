import { IncidentCacheService } from '../app/src/modules/incidents/incident-cache.service';
import { IncidentJobsService } from '../app/src/modules/incidents/incident-jobs.service';
import { IncidentLogService } from '../app/src/modules/incidents/incident-log.service';
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..');

describe('Incident Recording infra services (PUS-190)', () => {
  it('IncidentCacheService builds tenant-scoped keys and invalidates', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const cache = new IncidentCacheService(
      { del } as never,
      { get: () => 300 } as never,
    );
    expect(cache.listKey('t1')).toBe('incident:list:t1');
    expect(cache.detailKey('t1', 'i1')).toBe('incident:detail:t1:i1');

    await cache.invalidateIncident('t1', 'i1');
    expect(del).toHaveBeenCalledWith('incident:detail:t1:i1');
    expect(del).toHaveBeenCalledWith('incident:list:t1');
  });

  it('IncidentLogService emits a Loki-tagged structured event', () => {
    const log = new IncidentLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);
    log.logEvent({ action: 'incident.submitted', incidentId: 'i1' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ loki: true, action: 'incident.submitted' }),
    );
  });

  it('IncidentJobsService reminders flag open incidents', async () => {
    const open = [
      { id: 'i1', tenantId: 't1', reference: 'INC-1' },
      { id: 'i2', tenantId: 't1', reference: 'INC-2' },
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(open) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new IncidentJobsService(
      db as never,
      {} as never,
      { get: () => '0 8 * * *' } as never,
      logService as never,
    );

    await jobs.sendOpenReminders();
    expect(logService.logEvent).toHaveBeenCalledTimes(2);
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.open-reminder', incidentId: 'i1' }),
    );
  });

  it('.env.example and deployment docs cover incident infra knobs', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    expect(envExample).toMatch(/INCIDENT_OPEN_REMINDER_CRON/);
    expect(envExample).toMatch(/INCIDENT_EVIDENCE_PREFIX/);
    expect(deployment).toMatch(/incident\.open-reminder/);
    expect(deployment).toMatch(/INCIDENT_EVIDENCE_PREFIX/);
  });
});
