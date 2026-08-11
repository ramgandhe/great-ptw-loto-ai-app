import { ValidityTransitionService } from '../app/src/modules/revalidation/validity-transition.service';

describe('ValidityTransitionService (PUS-242)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const permitId = '33333333-3333-4333-8333-333333333333';
  const actorId = '00000000-0000-4000-8000-000000000099';

  it('skips when a validity check already exists for the operational day (idempotent)', async () => {
    let selectCall = 0;
    const db = {
      select: jest.fn().mockImplementation(() => {
        selectCall += 1;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.limit = () => {
          if (selectCall === 1) {
            return Promise.resolve([{ timezone: 'UTC' }]);
          }
          return Promise.resolve([{ id: 'existing-check' }]);
        };
        return chain;
      }),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const service = new ValidityTransitionService(
      db as never,
      { log: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

    const result = await service.checkPermit(
      {
        id: permitId,
        tenantId,
        status: 'active',
        plannedStartAt: new Date(Date.now() - 86400000),
        plannedEndAt: new Date(Date.now() + 5 * 86400000),
        submittedBy: null,
        createdBy: actorId,
        reference: 'PTW-1',
      } as never,
      new Date(),
      actorId,
    );

    expect(result).toBe('skipped');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('notifies issuer when remaining hours are ≤48', async () => {
    let selectCall = 0;
    const insertReturning = jest.fn().mockResolvedValue([
      { id: 'check-1' },
    ]);
    const notificationReturning = jest.fn().mockResolvedValue([{ id: 'n1' }]);

    const db = {
      select: jest.fn().mockImplementation(() => {
        selectCall += 1;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.limit = () => {
          if (selectCall === 1) return Promise.resolve([{ timezone: 'UTC' }]);
          return Promise.resolve([]);
        };
        return chain;
      }),
      insert: jest.fn().mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        chain.values = () => chain;
        chain.onConflictDoNothing = () => chain;
        chain.returning = () => {
          // first insert = validity check; later = notification
          if ((db.insert as jest.Mock).mock.calls.length === 1) {
            return insertReturning();
          }
          return notificationReturning();
        };
        return chain;
      }),
      update: jest.fn().mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        chain.set = () => chain;
        chain.where = () => Promise.resolve([]);
        return chain;
      }),
    };

    const service = new ValidityTransitionService(
      db as never,
      { log: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

    const now = new Date();
    const result = await service.checkPermit(
      {
        id: permitId,
        tenantId,
        status: 'active',
        plannedStartAt: new Date(now.getTime() - 86400000),
        plannedEndAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        submittedBy: actorId,
        createdBy: actorId,
        reference: 'PTW-1',
      } as never,
      now,
      actorId,
    );

    expect(result).toBe('notified');
  });
});
