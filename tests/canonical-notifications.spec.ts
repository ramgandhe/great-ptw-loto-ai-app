import { CanonicalNotificationService } from '../app/src/modules/notifications/canonical-notification.service';
import { NotificationsService } from '../app/src/modules/notifications/notifications.service';

describe('CanonicalNotificationService (FR-NOT-002–008)', () => {
  const notificationsService = {
    generateSystem: jest.fn().mockResolvedValue({ notification: {}, recipients: [] }),
  } as unknown as NotificationsService;

  const db = {
    select: jest.fn(),
  };

  const service = new CanonicalNotificationService(db as never, notificationsService);

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
});
