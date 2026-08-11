import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import { IncidentSeverityLifecycleService } from '../app/src/modules/incidents/incident-severity-lifecycle.service';
import { INCIDENT_HOD_DECISION_ROLES } from '../app/src/modules/incidents/incidents.constants';
import { mockRoleGuardReflector } from './helpers/role-guard-mock';

describe('Incident severity lifecycle (FR-INC-011)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const actorId = '22222222-2222-4222-8222-222222222222';
  const incidentId = '33333333-3333-4333-8333-333333333333';
  const permitId = '44444444-4444-4444-8444-444444444444';

  function buildLifecycleService(permitStatus = 'active') {
    const transition = jest.fn().mockResolvedValue({});
    const auditLog = jest.fn().mockResolvedValue(undefined);
    const logEvent = jest.fn();

    const permitRow = { id: permitId, tenantId, status: permitStatus };
    const executionRow = { id: 'exec-1', permitId, suspendedAt: null };

    const db = {
      select: jest.fn(),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      }),
      transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) =>
        fn({
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockResolvedValue(undefined),
          }),
          select: jest
            .fn()
            .mockImplementationOnce(() => ({
              from: () => ({
                where: () => Promise.resolve([permitRow]),
              }),
            }))
            .mockImplementation(() => ({
              from: () => ({
                where: () => ({
                  limit: jest.fn().mockResolvedValue([executionRow]),
                }),
              }),
            })),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      ),
    };

    db.select
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([{ permitId }]),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([permitRow]),
        }),
      }))
      .mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: jest.fn().mockResolvedValue([executionRow]),
          }),
        }),
      }));

    const service = new IncidentSeverityLifecycleService(
      db as never,
      { transition } as never,
      { log: auditLog } as never,
      { logEvent } as never,
    );

    return { service, transition, auditLog, logEvent, db };
  }

  it('cancels linked permits on accident path submission', async () => {
    const { service, transition } = buildLifecycleService();

    const status = await service.applyOnSubmit(incidentId, tenantId, actorId, 'accident');

    expect(status).toBe('open');
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        permitId,
        toStatus: 'cancelled',
        action: 'cancelled',
      }),
      expect.anything(),
    );
  });

  it('routes near-miss path to pending HOD decision without cancelling permits', async () => {
    const { service, transition } = buildLifecycleService();

    const status = await service.applyOnSubmit(incidentId, tenantId, actorId, 'near_miss');

    expect(status).toBe('pending_hod_decision');
    expect(transition).not.toHaveBeenCalled();
  });

  it('records HOD stop decision and cancels linked permits', async () => {
    const { service, transition } = buildLifecycleService();

    await service.recordHodDecision(incidentId, tenantId, actorId, 'stop', 'Unsafe to continue');

    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({ permitId, toStatus: 'cancelled' }),
      expect.anything(),
    );
  });

  it('restricts HOD decision endpoint to supervisor role', () => {
    const getAllAndOverride = jest.fn();
    const reflector = { getAllAndOverride } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    mockRoleGuardReflector(getAllAndOverride, INCIDENT_HOD_DECISION_ROLES);

    expect(
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: { roles: ['supervisor'] } }),
        }),
      } as never),
    ).toBe(true);

    expect(() =>
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: { roles: ['org-admin'] } }),
        }),
      } as never),
    ).toThrow(ForbiddenException);
  });
});
