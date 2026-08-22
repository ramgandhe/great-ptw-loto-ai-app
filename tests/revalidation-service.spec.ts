import { ConflictException } from '@nestjs/common';
import { RevalidationService } from '../app/src/modules/revalidation/revalidation.service';

describe('RevalidationService (PUS-181)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const permitId = '33333333-3333-4333-8333-333333333333';
  const user = {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'hod',
    roles: ['hod'],
    tenantId,
  };

  it('rejects continue without passed revalidation', async () => {
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
            return Promise.resolve([{ id: permitId, tenantId, status: 'active' }]);
          }
          return Promise.resolve([]);
        };
        return chain;
      }),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const service = new RevalidationService(
      db as never,
      { log: jest.fn() } as never,
      { invalidatePermit: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

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
            return Promise.resolve([{ id: permitId, tenantId, status: 'active' }]);
          }
          return Promise.resolve([{ id: 'r1', outcome: 'failed' }]);
        };
        return chain;
      }),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const service = new RevalidationService(
      db as never,
      { log: jest.fn() } as never,
      { invalidatePermit: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

    await expect(service.continuePermit(permitId, user)).rejects.toBeInstanceOf(ConflictException);
  });
});
