import { ConflictException } from '@nestjs/common';
import { RevalidationService } from '../app/src/modules/revalidation/revalidation.service';

describe('RevalidationService (PUS-181 / PUS-242)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const permitId = '33333333-3333-4333-8333-333333333333';
  const user = {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'supervisor',
    roles: ['supervisor'],
    tenantId,
  };

  const futureEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expiredEnd = new Date(Date.now() - 60 * 60 * 1000);

  function buildService(db: unknown, validity = { resolveTenantTimezone: jest.fn().mockResolvedValue('UTC') }) {
    return new RevalidationService(
      db as never,
      { log: jest.fn() } as never,
      { invalidatePermit: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
      validity as never,
    );
  }

  it('rejects continue without passed revalidation for server operational day', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn().mockImplementation(() => {
        selectCall += 1;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => chain;
        chain.limit = () => {
          if (selectCall === 1) {
            return Promise.resolve([
              {
                id: permitId,
                tenantId,
                status: 'active',
                plannedStartAt: new Date(Date.now() - 86400000),
                plannedEndAt: futureEnd,
              },
            ]);
          }
          return Promise.resolve([]);
        };
        return chain;
      }),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const service = buildService(db);
    await expect(service.continuePermit(permitId, user)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects continue when latest revalidation failed', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn().mockImplementation(() => {
        selectCall += 1;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => chain;
        chain.limit = () => {
          if (selectCall === 1) {
            return Promise.resolve([
              {
                id: permitId,
                tenantId,
                status: 'active',
                plannedStartAt: new Date(Date.now() - 86400000),
                plannedEndAt: futureEnd,
              },
            ]);
          }
          return Promise.resolve([{ id: 'r1', outcome: 'failed' }]);
        };
        return chain;
      }),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const service = buildService(db);
    await expect(service.continuePermit(permitId, user)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects continue when permit validity is expired (server clock)', async () => {
    const db = {
      select: jest.fn().mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => chain;
        chain.limit = () =>
          Promise.resolve([
            {
              id: permitId,
              tenantId,
              status: 'active',
              plannedStartAt: new Date(Date.now() - 10 * 86400000),
              plannedEndAt: expiredEnd,
            },
          ]);
        return chain;
      }),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const service = buildService(db);
    await expect(service.continuePermit(permitId, user)).rejects.toThrow(/validity decision/);
  });

  it('rejects revalidate when client operational date differs from server TZ date', async () => {
    const db = {
      select: jest.fn().mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => chain;
        chain.limit = () =>
          Promise.resolve([
            {
              id: permitId,
              tenantId,
              status: 'active',
              plannedStartAt: new Date(Date.now() - 86400000),
              plannedEndAt: futureEnd,
            },
          ]);
        return chain;
      }),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const service = buildService(db, {
      resolveTenantTimezone: jest.fn().mockResolvedValue('UTC'),
    });

    await expect(
      service.revalidate(
        permitId,
        {
          operationalDate: '1999-01-01',
          outcome: 'passed',
          findings: 'ok',
        },
        user,
      ),
    ).rejects.toThrow(/Operational date must match server date/);
  });
});
