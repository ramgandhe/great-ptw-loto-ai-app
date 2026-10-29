import { IsolationCustodyService } from '../app/src/modules/lototo/isolation-custody.service';

describe('Isolation test, handover and long-term walks', () => {
  const tenantId = '22222222-2222-2222-2222-222222222222';
  const user = { id: '11111111-1111-1111-1111-111111111111', tenantId, roles: ['permit-approver'] };

  function service() {
    const update = jest.fn();
    const db: {
      select: jest.Mock;
      insert: jest.Mock;
      update: jest.Mock;
      transaction?: (run: (tx: Record<string, unknown>) => Promise<unknown>) => Promise<unknown>;
    } = {
      select: jest.fn(),
      insert: jest.fn(),
      update,
    };
    const custody = new IsolationCustodyService(
      db as never,
      { requireTenant: () => tenantId } as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
    );
    return { custody, db, update };
  }

  it('starts a test without changing the certificate status', async () => {
    const { custody, db, update } = service();
    db.select
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: async () => [{ id: 'cert-1', status: 'isolated_verified', tenantId }],
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: async () => [] }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: async () => [{ id: 'point-1' }] }),
      });
    db.insert.mockReturnValue({
      values: () => ({
        returning: async () => [{ id: 'test-1', status: 'in_test' }],
      }),
    });

    const test = await custody.startTest(
      'cert-1',
      { testReason: 'Motor rotation', pointIds: ['point-1'] },
      user as never,
    );

    expect(test.status).toBe('in_test');
    expect(update).not.toHaveBeenCalled();
  });

  it('records a walk without changing the certificate status', async () => {
    const { custody, db } = service();
    const sets: Array<Record<string, unknown>> = [];
    db.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          orderBy: async () => [{
            id: 'cert-1',
            status: 'isolated_verified',
            tenantId,
            isLongTerm: true,
            ltiAuditIntervalDays: 30,
          }],
        }),
      }),
    });
    db.transaction = async (run: (tx: typeof db) => Promise<unknown>) => {
      const tx = {
        ...db,
        insert: jest.fn().mockReturnValue({
          values: () => ({ returning: async () => [{ id: 'walk-1' }] }),
        }),
        update: jest.fn().mockReturnValue({
          set: (values: Record<string, unknown>) => {
            sets.push(values);
            return { where: async () => undefined };
          },
        }),
      };
      return run(tx);
    };

    await custody.recordWalk('cert-1', { notes: 'Locks in place' }, user as never);
    expect(sets[0]).not.toHaveProperty('status');
    expect(sets[0]).toHaveProperty('lastAuditedAt');
  });
});
