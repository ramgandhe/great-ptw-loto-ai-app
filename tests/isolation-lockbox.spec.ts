import { ConflictException, ForbiddenException } from '@nestjs/common';
import { IsolationLockboxService } from '../app/src/modules/lototo/isolation-lockbox.service';

describe('TASK-LOTOTO-04: Group Lockout & Lockbox (Key Safe) Subsystem', () => {
  let service: IsolationLockboxService;
  let mockDb: any;
  let mockValidation: any;
  let mockAudit: any;

  const mockTenantId = '22222222-2222-2222-2222-222222222222';
  const mockUser = {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: mockTenantId,
    roles: ['permit-approver', 'permit-operator'],
  };

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn((cb) => cb(mockDb)),
    };
    mockValidation = {
      requireTenant: jest.fn().mockReturnValue(mockTenantId),
    };
    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new IsolationLockboxService(mockDb, mockValidation, mockAudit);
  });

  function setupLockbox(custodyStatus = 'open_for_keys') {
    const lockbox = {
      id: 'box-1',
      tenantId: mockTenantId,
      certificateId: 'cert-1',
      boxNumber: 'LBX-ZONE-01',
      masterLockSerial: 'ML-9901',
      custodyStatus,
    };
    (service as any).requireLockbox = jest.fn().mockResolvedValue(lockbox);
    return lockbox;
  }

  describe('Sealing and Personal Lock Application', () => {
    it('blocks applying personal locks if the lockbox is not yet sealed with master keys inside', async () => {
      setupLockbox('open_for_keys');

      await expect(
        service.applyPersonalLock(
          'box-1',
          {
            personalLockNumber: 'PL-101',
            workerName: 'John Doe',
          },
          mockUser as any,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('allows applying personal lock once lockbox is sealed', async () => {
      setupLockbox('keys_deposited_sealed');

      // No existing active lock for this worker
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            { id: 'lock-1', lockboxId: 'box-1', personalLockNumber: 'PL-101', workerName: 'John Doe' },
          ]),
        }),
      });

      const res = await service.applyPersonalLock(
        'box-1',
        {
          personalLockNumber: 'PL-101',
          workerName: 'John Doe',
        },
        mockUser as any,
      );

      expect(res.personalLockNumber).toBe('PL-101');
    });

    it('blocks duplicate active personal lock on the same box for the same worker', async () => {
      setupLockbox('keys_deposited_sealed');

      // Existing active lock found
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 'lock-1', personalLockNumber: 'PL-101', removedAt: null },
          ]),
        }),
      });

      await expect(
        service.applyPersonalLock(
          'box-1',
          {
            personalLockNumber: 'PL-102',
            workerName: 'John Doe',
          },
          mockUser as any,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Release Lockbox Safety Gate', () => {
    it('BLOCKS releasing lockbox / unsealing keys while workers still have personal locks attached', async () => {
      setupLockbox('keys_deposited_sealed');

      // Active crew locks present!
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 'lock-1', workerName: 'Alice Smith', personalLockNumber: 'PL-44' },
            { id: 'lock-2', workerName: 'Bob Jones', personalLockNumber: 'PL-88' },
          ]),
        }),
      });

      await expect(
        service.releaseLockbox('box-1', {}, mockUser as any),
      ).rejects.toThrow(ConflictException);
    });

    it('ALLOWS releasing lockbox when all workers have removed their personal locks', async () => {
      setupLockbox('keys_deposited_sealed');

      // No active crew locks remaining
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ status: 'restoration_in_progress' }]),
        }),
      });

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([
              { id: 'box-1', custodyStatus: 'keys_released' },
            ]),
          }),
        }),
      });

      const res = await service.releaseLockbox('box-1', {}, mockUser as any);
      expect(res.custodyStatus).toBe('keys_released');
    });
  });

  describe('Personal Lock Removal', () => {
    it('records removal timestamp when personal lock is removed', async () => {
      setupLockbox('keys_deposited_sealed');

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: 'lock-1',
              personalLockNumber: 'PL-101',
              workerName: 'John Doe',
              workforceUserId: mockUser.id,
              removedAt: null,
            },
          ]),
        }),
      });

      const now = new Date();
      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([
              { id: 'lock-1', removedAt: now },
            ]),
          }),
        }),
      });

      const res = await service.removePersonalLock('box-1', 'lock-1', mockUser as any);
      expect(res.removedAt).toBeDefined();
    });

    it('rejects removing someone else’s personal lock', async () => {
      setupLockbox('keys_deposited_sealed');

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: 'lock-1',
              personalLockNumber: 'PL-101',
              workforceUserId: '33333333-3333-3333-3333-333333333333',
              removedAt: null,
            },
          ]),
        }),
      });

      await expect(service.removePersonalLock('box-1', 'lock-1', mockUser as any)).rejects.toThrow(ForbiddenException);
    });

    it('rejects removing an already removed personal lock', async () => {
      setupLockbox('keys_deposited_sealed');

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 'lock-1', personalLockNumber: 'PL-101', removedAt: new Date() },
          ]),
        }),
      });

      await expect(
        service.removePersonalLock('box-1', 'lock-1', mockUser as any),
      ).rejects.toThrow(ConflictException);
    });
  });
});
