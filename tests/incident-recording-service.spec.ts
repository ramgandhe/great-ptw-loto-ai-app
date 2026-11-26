import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { IncidentsService } from '../app/src/modules/incidents/incidents.service';

describe('IncidentsService (PUS-186)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const user = {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'permit-operator',
    roles: ['permit-operator'],
    tenantId,
  };

  function buildService(opts: {
    incident?: Record<string, unknown> | null;
    list?: Record<string, unknown>[];
  }) {
    const incident =
      opts.incident === undefined
        ? {
            id: '33333333-3333-4333-8333-333333333333',
            tenantId,
            status: 'draft',
            title: 'Draft',
            description: 'Desc',
            reference: 'INC-2026-ABCD',
            locationDescription: '',
            priority: 'medium',
            plantId: null,
            locationId: null,
            workstationId: null,
          }
        : opts.incident;

    let selectCall = 0;
    const insertReturning = jest.fn().mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        tenantId,
        reference: 'INC-2026-ABCD',
        status: 'draft',
        incidentType: 'near_miss',
      },
    ]);
    const updateReturning = jest.fn().mockResolvedValue([
      {
        ...(incident ?? {}),
        status: 'open',
        reference: 'INC-2026-ABCD',
      },
    ]);

    const db = {
      select: jest.fn().mockImplementation(() => {
        selectCall += 1;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => Promise.resolve(opts.list ?? []);
        chain.limit = () => {
          if (!incident) {
            return Promise.resolve([]);
          }
          // first requireIncident / loadDetail hit
          return Promise.resolve([incident]);
        };
        chain.then = (
          resolve: (val: unknown) => unknown,
          reject?: (err: unknown) => unknown,
        ) =>
          Promise.resolve([
            {
              id: '55555555-5555-4555-8555-555555555555',
              siteId: '44444444-4444-4444-8444-444444444444',
              status: 'active',
            },
          ]).then(resolve, reject);
        return chain;
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: insertReturning,
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: updateReturning,
          }),
        }),
      }),
    };

    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const cacheService = {
      getList: jest.fn().mockResolvedValue(null),
      setList: jest.fn().mockResolvedValue(undefined),
      getDetail: jest.fn().mockResolvedValue(null),
      setDetail: jest.fn().mockResolvedValue(undefined),
      invalidateIncident: jest.fn().mockResolvedValue(undefined),
    };
    const logService = { logEvent: jest.fn() };
    const storageService = {
      getBucket: () => 'ptw-documents',
      putObject: jest.fn().mockResolvedValue(undefined),
    };
    const configService = { get: () => 'incidents/evidence' };

    const severityLifecycle = {
      applyOnSubmit: jest.fn().mockResolvedValue('open'),
      recordHodDecision: jest.fn().mockResolvedValue(undefined),
    };
    const canonicalNotificationService = {
      fromIncidentReported: jest.fn().mockResolvedValue(undefined),
    };

    const service = new IncidentsService(
      db as never,
      auditService as never,
      cacheService as never,
      logService as never,
      storageService as never,
      configService as never,
      severityLifecycle as never,
      canonicalNotificationService as never,
    );

    return {
      service,
      db,
      auditService,
      logService,
      cacheService,
      canonicalNotificationService,
      selectCall: () => selectCall,
    };
  }

  it('creates a draft near miss', async () => {
    const { service, auditService, logService, canonicalNotificationService } = buildService({});
    const result = await service.create(
      {
        incidentType: 'near_miss',
        title: 'Near miss',
        description: 'Almost slipped',
        occurredAt: '2026-07-31T10:00:00.000Z',
      },
      user,
    );

    expect(result.incident).toBeDefined();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.created' }),
    );
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.created' }),
    );
    expect(canonicalNotificationService.fromIncidentReported).not.toHaveBeenCalled();
  });

  it('creates a submitted incident and notifies safety officers', async () => {
    const { service, auditService, logService, canonicalNotificationService } = buildService({});
    const result = await service.create(
      {
        incidentType: 'incident',
        title: 'Workplace injury',
        description: 'Fell from ladder',
        occurredAt: '2026-07-31T10:00:00.000Z',
        siteId: '44444444-4444-4444-8444-444444444444',
        workLocationId: '55555555-5555-4555-8555-555555555555',
        submit: true,
      },
      user,
    );

    expect(result.incident).toBeDefined();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.submitted' }),
    );
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.submitted' }),
    );
    expect(canonicalNotificationService.fromIncidentReported).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId: user.id,
        severityPath: 'accident',
        reference: 'INC-2026-ABCD',
      }),
    );
  });

  it('submits a draft incident and notifies safety officers', async () => {
    const draftIncident = {
      id: '33333333-3333-4333-8333-333333333333',
      tenantId,
      status: 'draft',
      title: 'Near miss draft',
      description: 'Almost tripped',
      reference: 'INC-2026-ABCD',
      severityPath: 'near_miss',
      siteId: '44444444-4444-4444-8444-444444444444',
      workLocationId: '55555555-5555-4555-8555-555555555555',
    };
    const { service, auditService, canonicalNotificationService } = buildService({
      incident: draftIncident,
    });

    const result = await service.submit('33333333-3333-4333-8333-333333333333', user);

    expect(result.incident).toBeDefined();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.submitted' }),
    );
    expect(canonicalNotificationService.fromIncidentReported).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        incidentId: '33333333-3333-4333-8333-333333333333',
        actorId: user.id,
        reference: 'INC-2026-ABCD',
        severityPath: 'near_miss',
      }),
    );
  });

  it('does not crash create(submit: true) when notification dispatch fails', async () => {
    const { service, auditService, logService, cacheService, canonicalNotificationService } = buildService({});
    canonicalNotificationService.fromIncidentReported.mockRejectedValueOnce(
      new Error('Notification service unreachable'),
    );

    const result = await service.create(
      {
        incidentType: 'near_miss',
        title: 'Near miss title',
        description: 'Near miss description',
        occurredAt: '2026-11-26T10:00:00.000Z',
        siteId: '44444444-4444-4444-8444-444444444444',
        workLocationId: '55555555-5555-4555-8555-555555555555',
        submit: true,
      },
      user,
    );

    expect(result.incident).toBeDefined();
    expect(cacheService.invalidateIncident).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.notification_failed' }),
    );
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.notification_failed' }),
    );
  });

  it('does not crash submit() when notification dispatch fails', async () => {
    const draftIncident = {
      id: '33333333-3333-4333-8333-333333333333',
      tenantId,
      status: 'draft',
      title: 'Near miss draft',
      description: 'Almost tripped',
      reference: 'INC-2026-ABCD',
      severityPath: 'near_miss',
      siteId: '44444444-4444-4444-8444-444444444444',
      workLocationId: '55555555-5555-4555-8555-555555555555',
    };
    const { service, auditService, logService, cacheService, canonicalNotificationService } = buildService({
      incident: draftIncident,
    });
    canonicalNotificationService.fromIncidentReported.mockRejectedValueOnce(
      new Error('Notification write error'),
    );

    const result = await service.submit('33333333-3333-4333-8333-333333333333', user);

    expect(result.incident).toBeDefined();
    expect(cacheService.invalidateIncident).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.notification_failed' }),
    );
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.notification_failed' }),
    );
  });

  it('rejects submit when incident is not draft', async () => {
    const { service } = buildService({
      incident: {
        id: '33333333-3333-4333-8333-333333333333',
        tenantId,
        status: 'open',
        title: 'Open',
        description: 'Already open',
        reference: 'INC-1',
      },
    });

    await expect(service.submit('33333333-3333-4333-8333-333333333333', user)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects update without tenant', async () => {
    const { service } = buildService({});
    await expect(
      service.update(
        '33333333-3333-4333-8333-333333333333',
        { title: 'x' },
        { ...user, tenantId: undefined },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects missing evidence file', async () => {
    const { service } = buildService({});
    await expect(
      service.uploadEvidence(
        '33333333-3333-4333-8333-333333333333',
        undefined,
        {},
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found for unknown incident', async () => {
    const { service } = buildService({ incident: null });
    await expect(
      service.findOne('33333333-3333-4333-8333-333333333333', user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
