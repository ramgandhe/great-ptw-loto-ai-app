import { ConflictException, ForbiddenException } from '@nestjs/common';
import { IncidentSeverityLifecycleService } from '../app/src/modules/incidents/incident-severity-lifecycle.service';

describe('IncidentSeverityLifecycleService (PUS-244 / FR-INC-011)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const incidentId = '33333333-3333-4333-8333-333333333333';
  const actorId = '22222222-2222-4222-8222-222222222222';

  function selectResults(results: unknown[][]) {
    let i = 0;
    return jest.fn().mockImplementation(() => {
      const rows = results[i++] ?? [];
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => chain;
      chain.limit = () => Promise.resolve(rows);
      // when awaited directly after where (list queries)
      chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject);
      return chain;
    });
  }

  it('idempotently returns existing lifecycle on openPathOnSubmit', async () => {
    const existing = {
      id: 'lc1',
      incidentId,
      tenantId,
      severityPath: 'near_miss',
      lifecycleStatus: 'awaiting_hod',
    };
    const db = {
      select: selectResults([[existing]]),
      insert: jest.fn(),
      update: jest.fn(),
    };
    const service = new IncidentSeverityLifecycleService(
      db as never,
      { log: jest.fn() } as never,
      { invalidateIncident: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

    const result = await service.openPathOnSubmit(
      {
        id: incidentId,
        tenantId,
        severityPath: 'near_miss',
        reference: 'INC-1',
        reportedBy: actorId,
      } as never,
      actorId,
    );

    expect(result).toEqual(existing);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects HOD decide on accident path', async () => {
    const db = {
      select: selectResults([
        [{ id: incidentId, tenantId, severityPath: 'accident', reference: 'INC-A' }],
        [
          {
            id: 'lc1',
            incidentId,
            tenantId,
            severityPath: 'accident',
            lifecycleStatus: 'auto_terminated',
          },
        ],
      ]),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const service = new IncidentSeverityLifecycleService(
      db as never,
      { log: jest.fn() } as never,
      { invalidateIncident: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

    await expect(
      service.decideNearMiss(incidentId, 'continue', undefined, {
        id: actorId,
        username: 'hod',
        roles: ['org-admin'],
        tenantId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks platform-admin from near-miss HOD lifecycle action', async () => {
    const service = new IncidentSeverityLifecycleService(
      { select: jest.fn(), insert: jest.fn(), update: jest.fn() } as never,
      { log: jest.fn() } as never,
      { invalidateIncident: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

    await expect(
      service.decideNearMiss(incidentId, 'stop', 'nope', {
        id: actorId,
        username: 'admin',
        roles: ['platform-admin'],
        tenantId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records near-miss continue decision', async () => {
    const updated = {
      id: 'lc1',
      incidentId,
      tenantId,
      lifecycleStatus: 'continued',
      hodDecision: 'continue',
    };
    const db = {
      select: selectResults([
        [{ id: incidentId, tenantId, severityPath: 'near_miss', reference: 'INC-NM' }],
        [
          {
            id: 'lc1',
            incidentId,
            tenantId,
            severityPath: 'near_miss',
            lifecycleStatus: 'awaiting_hod',
          },
        ],
      ]),
      insert: jest.fn().mockReturnValue({
        values: () => Promise.resolve([]),
      }),
      update: jest.fn().mockReturnValue({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([updated]),
          }),
        }),
      }),
    };

    const service = new IncidentSeverityLifecycleService(
      db as never,
      { log: jest.fn() } as never,
      { invalidateIncident: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

    const result = await service.decideNearMiss(incidentId, 'continue', 'safe', {
      id: actorId,
      username: 'hod',
      roles: ['org-admin'],
      tenantId,
    });

    expect(result.lifecycle.lifecycleStatus).toBe('continued');
  });

  it('rejects duplicate near-miss decision', async () => {
    const db = {
      select: selectResults([
        [{ id: incidentId, tenantId, severityPath: 'near_miss', reference: 'INC-NM' }],
        [
          {
            id: 'lc1',
            incidentId,
            tenantId,
            severityPath: 'near_miss',
            lifecycleStatus: 'continued',
          },
        ],
      ]),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const service = new IncidentSeverityLifecycleService(
      db as never,
      { log: jest.fn() } as never,
      { invalidateIncident: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

    await expect(
      service.decideNearMiss(incidentId, 'stop', undefined, {
        id: actorId,
        username: 'hod',
        roles: ['org-admin'],
        tenantId,
      }),
    ).rejects.toThrow(/already been recorded/);
  });
});
