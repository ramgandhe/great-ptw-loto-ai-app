import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DailyProgressService } from '../app/src/modules/daily-progress/daily-progress.service';

describe('DailyProgressService (PUS-176)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const user = {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'issuer',
    roles: ['job-issuer'],
    tenantId,
  };

  function buildService(overrides: {
    permit?: { id: string; tenantId: string; status: string } | null;
    existingDay?: boolean;
  }) {
    const permit =
      overrides.permit === undefined
        ? { id: '33333333-3333-4333-8333-333333333333', tenantId, status: 'active' }
        : overrides.permit;

    const insertReturning = jest.fn().mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        permitId: permit?.id,
        operationalDate: '2026-07-31',
        status: 'submitted',
      },
    ]);

    const db = {
      select: jest.fn().mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.limit = () => Promise.resolve(permit ? [permit] : []);
        chain.orderBy = () => Promise.resolve([]);
        // Second select for existing day check after permit load — simplified:
        // We override limit based on call count via a counter.
        return chain;
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: insertReturning,
        }),
      }),
    };

    // More controlled select mock:
    let selectCall = 0;
    db.select = jest.fn().mockImplementation(() => {
      selectCall += 1;
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => chain;
      chain.orderBy = () => Promise.resolve([]);
      chain.limit = () => {
        if (selectCall === 1) {
          return Promise.resolve(permit ? [permit] : []);
        }
        // existing day lookup
        return Promise.resolve(overrides.existingDay ? [{ id: 'dup' }] : []);
      };
      return chain;
    });

    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const cacheService = {
      getPermitProgress: jest.fn().mockResolvedValue(null),
      setPermitProgress: jest.fn().mockResolvedValue(undefined),
      invalidatePermit: jest.fn().mockResolvedValue(undefined),
    };
    const logService = { logEvent: jest.fn() };

    const service = new DailyProgressService(
      db as never,
      auditService as never,
      cacheService as never,
      logService as never,
    );

    return { service, db, auditService, cacheService, logService, permit };
  }

  it('records submitted daily progress for an active permit', async () => {
    const { service, auditService, cacheService, logService } = buildService({});

    const row = await service.recordDailyProgress(
      '33333333-3333-4333-8333-333333333333',
      {
        operationalDate: '2026-07-31',
        completedWork: 'Done',
        summary: 'Day 1',
      },
      user,
    );

    expect(row.status).toBe('submitted');
    expect(auditService.log).toHaveBeenCalled();
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mdp.progress.submitted' }),
    );
    expect(cacheService.invalidatePermit).toHaveBeenCalled();
  });

  it('rejects duplicate operational day', async () => {
    const { service } = buildService({ existingDay: true });

    await expect(
      service.recordDailyProgress(
        '33333333-3333-4333-8333-333333333333',
        {
          operationalDate: '2026-07-31',
          completedWork: 'Done',
          summary: 'Day 1',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects progress on inactive permit', async () => {
    const { service } = buildService({
      permit: {
        id: '33333333-3333-4333-8333-333333333333',
        tenantId,
        status: 'closed',
      },
    });

    await expect(
      service.recordDailyProgress(
        '33333333-3333-4333-8333-333333333333',
        {
          operationalDate: '2026-07-31',
          completedWork: 'Done',
          summary: 'Day 1',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires tenant context', async () => {
    const { service } = buildService({});
    await expect(
      service.listDailyProgress('33333333-3333-4333-8333-333333333333', {
        ...user,
        tenantId: undefined,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when permit is missing', async () => {
    const { service } = buildService({ permit: null });
    await expect(
      service.listDailyProgress('33333333-3333-4333-8333-333333333333', user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
