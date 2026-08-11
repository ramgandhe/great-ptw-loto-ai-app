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
    username: 'operator',
    roles: ['operator'],
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

    const service = new IncidentsService(
      db as never,
      auditService as never,
      cacheService as never,
      logService as never,
      storageService as never,
      configService as never,
      severityLifecycle as never,
    );

    return { service, db, auditService, logService, cacheService, selectCall: () => selectCall };
  }

  it('creates a draft near miss', async () => {
    const { service, auditService, logService } = buildService({});
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
