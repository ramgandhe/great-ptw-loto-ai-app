import { CanonicalNotificationService } from '../app/src/modules/notifications/canonical-notification.service';
import { NotificationsService } from '../app/src/modules/notifications/notifications.service';

describe('CanonicalNotificationService (FR-NOT-002–008)', () => {
  const notificationsService = {
    generateSystem: jest.fn().mockResolvedValue({ notification: {}, recipients: [] }),
  } as unknown as NotificationsService;

  const db = {
    select: jest.fn(),
  };

  const service = new CanonicalNotificationService(db as never, notificationsService, {
    listUsersForTenant: jest.fn().mockResolvedValue([]),
  } as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps permit approved to permit_approved notification', async () => {
    db.select.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ submittedBy: 'issuer-1' }]),
      }),
    });

    await service.fromApprovalPayload({
      permitId: 'permit-1',
      tenantId: 'tenant-1',
      action: 'approved',
      actorId: 'supervisor-1',
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'supervisor-1',
      expect.objectContaining({ eventType: 'permit_approved' }),
    );
  });

  it('maps permit deferred to permit_deferred notification', async () => {
    db.select.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ submittedBy: 'issuer-1' }]),
      }),
    });

    await service.fromApprovalPayload({
      permitId: 'permit-1',
      tenantId: 'tenant-1',
      action: 'deferred',
      actorId: 'supervisor-1',
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'supervisor-1',
      expect.objectContaining({ eventType: 'permit_deferred' }),
    );
  });

  it('maps validity expiry to permit_expiry with dedupe key', async () => {
    await service.fromValidityPayload({
      permitId: 'permit-1',
      tenantId: 'tenant-1',
      reference: 'PTW-1',
      issuerId: 'issuer-1',
      validityState: 'expired',
      plannedEndAt: '2026-08-01T00:00:00.000Z',
      hoursRemaining: -1,
      operationalDate: '2026-08-01',
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'issuer-1',
      expect.objectContaining({
        eventType: 'permit_expiry',
        dedupeKey: expect.stringContaining('permit_expiry:expired:2026-08-01'),
      }),
    );
  });

  it('maps simops conflict detection to simops_conflict', async () => {
    db.select.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ submittedBy: 'issuer-1' }, { submittedBy: 'issuer-2' }]),
      }),
    });

    await service.fromSimopsConflict({
      tenantId: 'tenant-1',
      conflictId: 'conflict-1',
      actorId: 'analyst-1',
      permitIds: ['p1', 'p2'],
      severity: 'high',
      summary: 'Overlapping hot work',
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'analyst-1',
      expect.objectContaining({ eventType: 'simops_conflict', priority: 'critical' }),
    );
  });

  it('maps incident submit to incident_reported', async () => {
    await service.fromIncidentReported({
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      actorId: 'reporter-1',
      reference: 'INC-1',
      severityPath: 'accident',
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'reporter-1',
      expect.objectContaining({ eventType: 'incident_reported', priority: 'critical' }),
    );
  });

  it('maps billing renewal to task_reminder with dedupe key', async () => {
    await service.fromBillingRenewal({
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      adminUserId: 'admin-1',
      renewAt: new Date('2026-08-15T00:00:00.000Z'),
      horizonDays: 7,
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'admin-1',
      expect.objectContaining({
        eventType: 'task_reminder',
        dedupeKey: 'tenant-1:billing:sub-1:renewal:2026-08-15',
        sourceModule: 'billing',
      }),
    );
  });

  it('maps lototo job payload to lototo_verification', async () => {
    await service.fromLototoPayload({
      planId: 'plan-1',
      permitId: 'permit-1',
      tenantId: 'tenant-1',
      action: 'verification_required',
      actorId: 'officer-1',
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'officer-1',
      expect.objectContaining({ eventType: 'lototo_verification' }),
    );
  });

  it('tells org admins and whoever sent it back when a permit is resubmitted', async () => {
    // Each db.select() chain resolves to the next queued result, in call order.
    const results: unknown[][] = [
      [{ role: 'hod', slot: 'default' }], // active approval stage
      [{ departmentId: null }], // permit department
      [], // tenant_users departments
      [{ actorId: 'hod-2' }], // last deferral
      [{ reference: 'PTW-1', title: 'Hot work' }], // permit name
    ];
    const chain = (rows: unknown[]) => {
      const c: Record<string, unknown> = {};
      for (const m of ['from', 'innerJoin', 'where', 'orderBy', 'limit']) c[m] = () => c;
      c.then = (resolve: (v: unknown) => void) => resolve(rows);
      return c;
    };
    const queueDb = { select: jest.fn(() => chain(results.shift() ?? [])) };
    const people = [
      { id: 'admin-1', enabled: true, roles: ['tenant-admin'] },
      { id: 'hod-1', enabled: true, roles: ['hod'] },
      { id: 'hod-2', enabled: true, roles: ['hod'] },
      { id: 'issuer-1', enabled: true, roles: ['job-issuer', 'tenant-admin'] },
    ];
    const resubmitService = new CanonicalNotificationService(queueDb as never, notificationsService, {
      listUsersForTenant: jest.fn().mockResolvedValue(people),
    } as never);

    await resubmitService.fromApprovalPayload({
      permitId: 'permit-1',
      tenantId: 'tenant-1',
      action: 'resubmitted',
      actorId: 'issuer-1',
    });

    const [, , input] = (notificationsService.generateSystem as jest.Mock).mock.calls[0];
    expect(input.title).toBe('Permit resubmitted');
    expect([...input.recipientUserIds].sort()).toEqual(['admin-1', 'hod-1', 'hod-2']);
  });
});
