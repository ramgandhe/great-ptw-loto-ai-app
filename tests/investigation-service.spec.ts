import { ConflictException, ForbiddenException } from '@nestjs/common';
import { InvestigationService } from '../app/src/modules/investigation/investigation.service';

describe('InvestigationService (PUS-191)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const user = {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'safety',
    roles: ['safety-officer'],
    tenantId,
  };
  const incidentId = '33333333-3333-4333-8333-333333333333';

  function buildService(opts: {
    incidentStatus?: string;
    existingInvestigation?: boolean;
    investigationStatus?: string;
  }) {
    const incident = {
      id: incidentId,
      tenantId,
      status: opts.incidentStatus ?? 'open',
    };
    const investigation = opts.existingInvestigation
      ? {
          id: '44444444-4444-4444-8444-444444444444',
          tenantId,
          incidentId,
          status: opts.investigationStatus ?? 'assigned',
          findings: '',
        }
      : null;

    let selectCall = 0;
    const db = {
      select: jest.fn().mockImplementation(() => {
        selectCall += 1;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => Promise.resolve([]);
        chain.limit = () => {
          // odd calls tend to be incident, even investigation lookups — keep simple:
          if (selectCall === 1) {
            return Promise.resolve([incident]);
          }
          if (selectCall === 2) {
            return Promise.resolve(investigation ? [investigation] : []);
          }
          return Promise.resolve(investigation ? [investigation] : []);
        };
        return chain;
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: '44444444-4444-4444-8444-444444444444',
              incidentId,
              status: 'assigned',
            },
          ]),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    // For assign: select1=incident, select2=existing check
    // Re-wire more carefully for assign path:
    selectCall = 0;
    db.select = jest.fn().mockImplementation(() => {
      selectCall += 1;
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => chain;
      chain.orderBy = () => Promise.resolve([]);
      chain.limit = () => {
        if (selectCall === 1) {
          return Promise.resolve([incident]);
        }
        // existing investigation check / requireInvestigation
        return Promise.resolve(
          opts.existingInvestigation && investigation ? [investigation] : [],
        );
      };
      return chain;
    });

    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const cacheService = {
      getDetail: jest.fn().mockResolvedValue(null),
      setDetail: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
    };
    const logService = { logEvent: jest.fn() };

    const service = new InvestigationService(
      db as never,
      auditService as never,
      cacheService as never,
      logService as never,
    );

    return { service, auditService, logService };
  }

  it('assigns investigation for open incident', async () => {
    const { service, auditService } = buildService({});
    // getInvestigation after assign will fail without richer mocks — stub via spy
    jest.spyOn(InvestigationService.prototype as never, 'getInvestigation' as never).mockResolvedValue({
      investigation: { id: 'inv' },
    } as never);

    const result = await service.assign(
      incidentId,
      { investigatorId: '55555555-5555-4555-8555-555555555555' },
      user,
    );
    expect(result).toBeDefined();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'investigation.assigned' }),
    );
  });

  it('rejects assign when investigation already exists', async () => {
    const { service } = buildService({ existingInvestigation: true });
    await expect(
      service.assign(
        incidentId,
        { investigatorId: '55555555-5555-4555-8555-555555555555' },
        user,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects assign without tenant', async () => {
    const { service } = buildService({});
    await expect(
      service.assign(
        incidentId,
        { investigatorId: '55555555-5555-4555-8555-555555555555' },
        { ...user, tenantId: undefined },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
