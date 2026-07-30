import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import { RestorationController } from '../app/src/modules/restoration/restoration.controller';
import { LototoHistoryController } from '../app/src/modules/restoration/lototo-history.controller';

describe('Restoration controllers are thin (PUS-161)', () => {
  const user: AuthenticatedUser = { id: 'u1', username: 'u', roles: ['isolation-officer'], tenantId: 't1' };

  it('RestorationController delegates to services without logic', async () => {
    const restorationService = {
      getRestoration: jest.fn().mockResolvedValue({ execution: {} }),
      removeLock: jest.fn().mockResolvedValue({ id: 'lr1' }),
      removeTag: jest.fn().mockResolvedValue({ id: 'tr1' }),
      restoreEquipment: jest.fn().mockResolvedValue({ id: 'er1' }),
      completeRestoration: jest.fn().mockResolvedValue({ status: 'restored' }),
    };
    const verificationService = { record: jest.fn().mockResolvedValue({ id: 'rv1' }) };
    const controller = new RestorationController(restorationService as never, verificationService as never);

    await controller.removeLock('e1', { appliedLockId: 'l1', reason: 'r' } as never, user);
    expect(restorationService.removeLock).toHaveBeenCalledWith('e1', 'l1', 'r', user);

    await controller.restoreEquipment('e1', { isolationPointId: 'p1' } as never, user);
    expect(restorationService.restoreEquipment).toHaveBeenCalledWith('e1', expect.any(Object), user);

    await controller.verify('e1', { isolationPointId: 'p1', result: 'pass' } as never, user);
    expect(verificationService.record).toHaveBeenCalledWith('e1', expect.any(Object), user);

    await controller.complete('e1', user);
    expect(restorationService.completeRestoration).toHaveBeenCalledWith('e1', user);
  });

  it('LototoHistoryController delegates reads to the history service', async () => {
    const historyService = {
      listForExecution: jest.fn().mockResolvedValue([]),
      listForPlan: jest.fn().mockResolvedValue([]),
    };
    const controller = new LototoHistoryController(historyService as never);
    await controller.forExecution('e1', user);
    expect(historyService.listForExecution).toHaveBeenCalledWith('e1', user);
    await controller.forPlan('p1', user);
    expect(historyService.listForPlan).toHaveBeenCalledWith('p1', user);
  });
});
