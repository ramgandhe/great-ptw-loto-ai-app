import { ConflictException } from '@nestjs/common';
import { IsolationCertificateService } from '../app/src/modules/lototo/isolation-certificate.service';
import { IsolationCertificateStatus } from '../app/src/database/schema/isolation-certificate';

describe('IsolationCertificateService - Lifecycle & State Machine', () => {
  let service: IsolationCertificateService;
  let mockDb: any;
  let mockValidation: any;
  let mockAudit: any;

  const mockUser = {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    roles: ['permit-approver'],
  };

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn((cb) => cb(mockDb)),
    };
    mockValidation = {
      requireTenant: jest.fn().mockReturnValue(mockUser.tenantId),
      assertWorkLocationExists: jest.fn().mockResolvedValue(undefined),
    };
    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new IsolationCertificateService(mockDb, mockValidation, mockAudit);
  });

  describe('Lifecycle State Transitions', () => {
    function setupCertificateWithStatus(status: IsolationCertificateStatus, reads: unknown[][] = [[]]) {
      const cert = {
        id: '33333333-3333-3333-3333-333333333333',
        tenantId: mockUser.tenantId,
        status,
        certificateNumber: 'EIC-2026-00001',
      };
      (service as any).requireCertificate = jest.fn().mockResolvedValue(cert);
      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ ...cert, status }]),
          }),
        }),
      });
      let read = 0;
      mockDb.select = jest.fn().mockImplementation(() => {
        const query = {
          from: () => query,
          innerJoin: () => query,
          where: () => {
            const rows = reads[Math.min(read, reads.length - 1)] ?? [];
            read += 1;
            return {
              orderBy: () => Promise.resolve(rows),
              then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
                Promise.resolve(rows).then(resolve, reject),
            };
          },
        };
        return query;
      });
      return cert;
    }

    it('moves a certificate up to isolation in progress, and refuses isolated before any proof', async () => {
      // 1. draft -> pending_approval
      setupCertificateWithStatus('draft');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'pending_approval' }, mockUser as any),
      ).resolves.toBeDefined();

      // 2. pending_approval -> approved
      setupCertificateWithStatus('pending_approval');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'approved' }, mockUser as any),
      ).resolves.toBeDefined();

      // 3. approved -> isolation_in_progress
      setupCertificateWithStatus('approved');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'isolation_in_progress' }, mockUser as any),
      ).resolves.toBeDefined();

      // 4. isolation_in_progress -> isolated_verified needs a passing proof on every point
      setupCertificateWithStatus('isolation_in_progress');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'isolated_verified' }, mockUser as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('marks the certificate isolated when every copied point has passed', async () => {
      setupCertificateWithStatus('isolation_in_progress', [
        [{ id: 'point-1', pointCode: 'E-1' }],
        [{ pointId: 'point-1', result: 'pass' }],
      ]);
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'isolated_verified' }, mockUser as any),
      ).resolves.toBeDefined();
    });

    it('tells the permit receiver the isolation is proved, and the authority when restoration can start', async () => {
      const enqueue = jest.fn().mockResolvedValue(undefined);
      const noticed = new IsolationCertificateService(mockDb, mockValidation, mockAudit, { enqueuePlanningNotification: enqueue } as never);
      const cert = {
        id: '33333333-3333-3333-3333-333333333333',
        tenantId: mockUser.tenantId,
        status: 'isolation_in_progress',
        certificateNumber: 'EIC-2026-00009',
        isolationAuthorityId: 'authority-1',
        createdBy: 'authority-1',
      };
      (noticed as any).requireCertificate = jest.fn().mockResolvedValue(cert);
      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ ...cert, status: 'isolated_verified' }]),
          }),
        }),
      });
      const query = (rows: unknown[]) => {
        const chain = {
          from: () => chain,
          innerJoin: () => chain,
          where: () => chain,
          orderBy: () => Promise.resolve(rows),
          then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
        };
        return chain;
      };
      mockDb.select
        .mockReturnValueOnce(query([{ id: 'point-1', pointCode: 'E-1' }]))
        .mockReturnValueOnce(query([{ pointId: 'point-1', result: 'pass' }]))
        .mockReturnValueOnce(query([{ createdBy: 'receiver-1' }]))
        .mockReturnValueOnce(query([{ ...cert, status: 'isolated_verified' }]))
        .mockReturnValueOnce(query([]))
        .mockReturnValueOnce(query([]))
        .mockReturnValueOnce(query([]))
        .mockReturnValueOnce(query([]));

      await noticed.transition(cert.id, { status: 'isolated_verified' }, mockUser as any);

      expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
        action: 'isolation_isolated',
        metadata: expect.objectContaining({ recipientIds: ['receiver-1'], certificateNumber: 'EIC-2026-00009' }),
      }));
      expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
        action: 'ready_to_restore',
        metadata: expect.objectContaining({ recipientIds: ['authority-1'] }),
      }));
    });

    it('supports sanction for test sub-cycle: isolated_verified -> sanction_for_test -> isolated_verified', async () => {
      // Enter test
      setupCertificateWithStatus('isolated_verified');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'sanction_for_test' }, mockUser as any),
      ).resolves.toBeDefined();

      // Return to zero energy
      setupCertificateWithStatus('sanction_for_test');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'isolated_verified' }, mockUser as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('supports de-isolation & closure: isolated_verified -> restoration_in_progress -> restored_verified -> closed', async () => {
      // Begin restoration
      setupCertificateWithStatus('isolated_verified');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'restoration_in_progress' }, mockUser as any),
      ).resolves.toBeDefined();

      // Complete restoration verification
      setupCertificateWithStatus('restoration_in_progress');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'restored_verified' }, mockUser as any),
      ).resolves.toBeDefined();

      // Close certificate
      setupCertificateWithStatus('restored_verified');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'closed' }, mockUser as any),
      ).resolves.toBeDefined();
    });

    it('blocks illegal status jump from draft directly to isolated_verified', async () => {
      setupCertificateWithStatus('draft');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'isolated_verified' }, mockUser as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('blocks illegal jump from approved directly to closed', async () => {
      setupCertificateWithStatus('approved');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'closed' }, mockUser as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('blocks any transition out of closed terminal state', async () => {
      setupCertificateWithStatus('closed');
      await expect(
        service.transition('33333333-3333-3333-3333-333333333333', { status: 'draft' }, mockUser as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('Update Guard', () => {
    it('blocks update when certificate is not in draft status', async () => {
      (service as any).requireCertificate = jest.fn().mockResolvedValue({
        id: '33333333-3333-3333-3333-333333333333',
        tenantId: mockUser.tenantId,
        status: 'isolated_verified',
      });

      await expect(
        service.update('33333333-3333-3333-3333-333333333333', { title: 'New Title' }, mockUser as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
