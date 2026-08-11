import { NotificationDispatchService } from '../app/src/modules/notifications/notification-dispatch.service';
import { FR_NOT_EVENT_TRACEABILITY } from '../app/src/modules/notifications/notifications.constants';

describe('NotificationDispatchService (PUS-245 / FR-NOT-002–008)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const actorId = '22222222-2222-4222-8222-222222222222';
  const recipientId = '33333333-3333-4333-8333-333333333333';

  function buildService(opts: {
    prefs?: Array<Record<string, unknown>>;
    existing?: Record<string, unknown> | null;
  }) {
    let selectCall = 0;
    const insertReturning = jest.fn().mockResolvedValue([
      {
        id: 'n1',
        tenantId,
        eventType: 'permit_approved',
        dedupeKey: 'd1',
      },
    ]);
    const recipientReturning = jest.fn().mockResolvedValue([
      { id: 'r1', userId: recipientId, notificationId: 'n1', tenantId },
    ]);

    const db = {
      select: jest.fn().mockImplementation(() => {
        selectCall += 1;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.limit = () => {
          // first select in dispatch after prefs may be existing dedupe
          if (opts.existing && selectCall > 1) {
            return Promise.resolve([opts.existing]);
          }
          if (selectCall === 1) {
            // preferences query has no limit — handled via then
          }
          return Promise.resolve(opts.existing ? [opts.existing] : []);
        };
        chain.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve(opts.prefs ?? []).then(resolve);
        return chain;
      }),
      insert: jest.fn().mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        chain.values = () => chain;
        chain.returning = () => {
          if ((db.insert as jest.Mock).mock.calls.length === 1) {
            return insertReturning();
          }
          if ((db.insert as jest.Mock).mock.calls.length === 2) {
            return recipientReturning();
          }
          return Promise.resolve([]);
        };
        return chain;
      }),
    };

    const service = new NotificationDispatchService(
      db as never,
      { invalidateUser: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
      { log: jest.fn() } as never,
    );

    return { service, db };
  }

  it('maps every FR-NOT-002…008 requirement to a distinct event type', () => {
    expect(Object.keys(FR_NOT_EVENT_TRACEABILITY)).toEqual([
      'FR-NOT-002',
      'FR-NOT-003',
      'FR-NOT-004',
      'FR-NOT-005',
      'FR-NOT-006',
      'FR-NOT-007',
      'FR-NOT-008',
    ]);
    const events = Object.values(FR_NOT_EVENT_TRACEABILITY);
    expect(new Set(events).size).toBe(events.length);
  });

  it('dispatches FR-NOT-002 permit approved', async () => {
    const { service } = buildService({ prefs: [] });
    const result = await service.dispatch({
      tenantId,
      actorId,
      requirementId: 'FR-NOT-002',
      title: 'Permit approved',
      body: 'ok',
      recipientUserIds: [recipientId],
      dedupeKey: `fr-not:FR-NOT-002:p1:approved`,
      sourceModule: 'approval',
      entityType: 'permit',
      entityId: 'p1',
    });
    expect(result.suppressed).toBe(false);
    expect(result.deduplicated).toBe(false);
  });

  it('suppresses when preference disables channel/event', async () => {
    const { service, db } = buildService({
      prefs: [
        {
          tenantId,
          eventType: 'permit_rejected',
          channel: 'in_app',
          enabled: false,
          status: 'active',
        },
      ],
    });

    const result = await service.dispatch({
      tenantId,
      actorId,
      requirementId: 'FR-NOT-003',
      title: 'Permit rejected',
      body: 'no',
      recipientUserIds: [recipientId],
      dedupeKey: 'fr-not:FR-NOT-003:p1:rejected',
      sourceModule: 'approval',
    });

    expect(result).toEqual({ suppressed: true, reason: 'preference_disabled' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('deduplicates by tenant dedupe key (idempotent retry)', async () => {
    const existing = { id: 'n-existing', tenantId, dedupeKey: 'dup' };
    let selectCall = 0;
    const db = {
      select: jest.fn().mockImplementation(() => {
        selectCall += 1;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.limit = () => {
          if (selectCall === 1) {
            // prefs: return via then
            return Promise.resolve([]);
          }
          return Promise.resolve([existing]);
        };
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve);
        return chain;
      }),
      insert: jest.fn(),
    };

    // Fix prefs query: first select awaits where() directly without limit
    db.select = jest.fn().mockImplementation(() => {
      selectCall += 1;
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => {
        if (selectCall === 1) {
          return Promise.resolve([]);
        }
        const inner: Record<string, unknown> = {};
        inner.limit = () => Promise.resolve([existing]);
        return inner;
      };
      return chain;
    });

    const service = new NotificationDispatchService(
      db as never,
      { invalidateUser: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
      { log: jest.fn() } as never,
    );

    // second select for recipients after existing found
    let call = 0;
    db.select = jest.fn().mockImplementation(() => {
      call += 1;
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => {
        if (call === 1) return Promise.resolve([]);
        if (call === 2) {
          const limited: Record<string, unknown> = {};
          limited.limit = () => Promise.resolve([existing]);
          return limited;
        }
        return Promise.resolve([{ id: 'r1', userId: recipientId }]);
      };
      return chain;
    });

    const result = await service.dispatch({
      tenantId,
      actorId,
      requirementId: 'FR-NOT-004',
      title: 'Deferred',
      body: 'clarify',
      recipientUserIds: [recipientId],
      dedupeKey: 'dup',
      sourceModule: 'approval',
    });

    expect(result.deduplicated).toBe(true);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns no_recipients when recipient list empty', async () => {
    const { service } = buildService({ prefs: [] });
    const result = await service.dispatch({
      tenantId,
      actorId,
      requirementId: 'FR-NOT-005',
      title: 'Expiry',
      body: 'soon',
      recipientUserIds: [],
      dedupeKey: 'expiry-1',
      sourceModule: 'notifications',
    });
    expect(result).toEqual({ suppressed: true, reason: 'no_recipients' });
  });
});
