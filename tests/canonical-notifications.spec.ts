import { CanonicalNotificationService } from '../app/src/modules/notifications/canonical-notification.service';
import { NotificationsService } from '../app/src/modules/notifications/notifications.service';

describe('CanonicalNotificationService (FR-NOT-002–008)', () => {
  const notificationsService = {
    generateSystem: jest.fn().mockResolvedValue({ notification: {}, recipients: [] }),
  } as unknown as NotificationsService;

  const db = {
    select: jest.fn(),
  };

  const keycloakAdmin = {
    listUsersForTenant: jest.fn().mockResolvedValue([]),
  };

  const service = new CanonicalNotificationService(
    db as never,
    notificationsService,
    keycloakAdmin as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    keycloakAdmin.listUsersForTenant.mockResolvedValue([]);
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

  it('maps incident submit to incident_reported and notifies in-scope Safety Officers', async () => {
    keycloakAdmin.listUsersForTenant.mockResolvedValueOnce([
      { id: 'safety-officer-1', enabled: true, roles: ['safety-officer'] },
      { id: 'operator-1', enabled: true, roles: ['permit-operator'] },
    ]);

    await service.fromIncidentReported({
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      actorId: 'reporter-1',
      reference: 'INC-1',
      severityPath: 'accident',
    });

    expect(keycloakAdmin.listUsersForTenant).toHaveBeenCalledWith('tenant-1');
    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'reporter-1',
      expect.objectContaining({
        eventType: 'incident_reported',
        priority: 'critical',
        recipientUserIds: ['safety-officer-1'],
      }),
    );
  });

  it('does not send notification when no Safety Officers exist in tenant', async () => {
    keycloakAdmin.listUsersForTenant.mockResolvedValueOnce([]);

    await service.fromIncidentReported({
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      actorId: 'reporter-1',
      reference: 'INC-1',
      severityPath: 'near_miss',
    });

    expect(notificationsService.generateSystem).not.toHaveBeenCalled();
  });

  it('resolves Safety Officers from database tenant records and linked permits', async () => {
    db.select
      .mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ userId: 'db-safety-officer-1' }]),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ permitId: 'permit-1' }]),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([{ userId: 'assigned-permit-safety-officer' }]),
          }),
          where: () => Promise.resolve([{ userId: 'assigned-permit-safety-officer' }]),
        }),
      });

    await service.fromIncidentReported({
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      actorId: 'reporter-1',
      reference: 'INC-100',
      severityPath: 'accident',
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'reporter-1',
      expect.objectContaining({
        eventType: 'incident_reported',
        recipientUserIds: expect.arrayContaining([
          'db-safety-officer-1',
          'assigned-permit-safety-officer',
        ]),
      }),
    );
  });

  it('excludes reporter from recipients when other Safety Officers exist', async () => {
    keycloakAdmin.listUsersForTenant.mockResolvedValueOnce([
      { id: 'safety-officer-1', enabled: true, roles: ['safety-officer'] },
      { id: 'reporter-so', enabled: true, roles: ['safety-officer'] },
    ]);

    await service.fromIncidentReported({
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      actorId: 'reporter-so',
      reference: 'INC-1',
      severityPath: 'accident',
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'reporter-so',
      expect.objectContaining({
        eventType: 'incident_reported',
        recipientUserIds: ['safety-officer-1'],
      }),
    );
  });

  it('handles thenables without a .catch method safely', async () => {
    const chainWithoutCatch = (rows: unknown[]) => {
      const c: Record<string, unknown> = {};
      for (const m of ['from', 'innerJoin', 'where', 'orderBy', 'limit']) c[m] = () => c;
      c.then = (resolve: (v: unknown) => void) => resolve(rows);
      return c;
    };
    const dbResults = [
      [{ userId: 'db-safety-officer-1' }],
      [{ permitId: 'permit-1' }],
      [{ userId: 'assigned-permit-safety-officer' }],
    ];
    const thenableDb = { select: jest.fn(() => chainWithoutCatch(dbResults.shift() ?? [])) };
    const testService = new CanonicalNotificationService(
      thenableDb as never,
      notificationsService,
      { listUsersForTenant: jest.fn().mockResolvedValue([]) } as never,
    );

    await testService.fromIncidentReported({
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      actorId: 'reporter-1',
      reference: 'INC-THENABLE',
      severityPath: 'accident',
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'reporter-1',
      expect.objectContaining({
        eventType: 'incident_reported',
        recipientUserIds: expect.arrayContaining(['db-safety-officer-1']),
      }),
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
      expect.objectContaining({ eventType: 'lototo_verification', entityType: 'lototo_plan' }),
    );
  });

  it('tells the receiver an isolation is proved and the authority when it can be restored', async () => {
    await service.fromLototoPayload({
      planId: 'cert-1',
      tenantId: 'tenant-1',
      action: 'isolation_isolated',
      actorId: 'authority-1',
      metadata: { recipientIds: ['receiver-1'], certificateNumber: 'EIC-2026-00001' },
    });
    await service.fromLototoPayload({
      planId: 'cert-1',
      tenantId: 'tenant-1',
      action: 'ready_to_restore',
      actorId: 'receiver-1',
      metadata: { recipientIds: ['authority-1'], certificateNumber: 'EIC-2026-00001' },
    });

    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'authority-1',
      expect.objectContaining({
        title: 'EIC-2026-00001 is isolated',
        recipientUserIds: ['receiver-1'],
        entityType: 'isolation_certificate',
        entityId: 'cert-1',
      }),
    );
    expect(notificationsService.generateSystem).toHaveBeenCalledWith(
      'tenant-1',
      'receiver-1',
      expect.objectContaining({
        title: 'EIC-2026-00001 is ready to restore',
        recipientUserIds: ['authority-1'],
        entityType: 'isolation_certificate',
      }),
    );
  });

  it('tells org admins and whoever sent it back when a permit is resubmitted', async () => {
    // Each db.select() chain resolves to the next queued result, in call order.
    const results: unknown[][] = [
      [{ role: 'permit-approver', slot: 'default' }], // active approval stage
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
      { id: 'hod-1', enabled: true, roles: ['permit-approver'] },
      { id: 'hod-2', enabled: true, roles: ['permit-approver'] },
      { id: 'issuer-1', enabled: true, roles: ['permit-receiver', 'tenant-admin'] },
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
