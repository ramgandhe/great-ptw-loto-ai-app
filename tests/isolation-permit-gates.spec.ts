import { ConflictException } from '@nestjs/common';
import { IsolationCertificateService } from '../app/src/modules/lototo/isolation-certificate.service';
import { PermitLototoExecutionService } from '../app/src/modules/permit/permit-lototo-execution.service';

describe('TASK-LOTOTO-02: Multi-Permit Association & Safety Gate Integration', () => {
  const mockTenantId = '22222222-2222-2222-2222-222222222222';
  const mockUser = {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: mockTenantId,
    roles: ['permit-approver'],
  };

  describe('Permit Work-Start Gate with Attached EIC', () => {
    it('allows permit start when all attached EICs are in isolated_verified state', async () => {
      const service = Object.create(PermitLototoExecutionService.prototype) as PermitLototoExecutionService;
      (service as any).permitService = {
        findOne: async () => ({ permit: { id: 'permit-1', lototoRequired: true } }),
      };
      const select = jest.fn();
      select.mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: async () => [
              { id: 'eic-1', certificateNumber: 'EIC-2026-00001', status: 'isolated_verified' },
              { id: 'eic-2', certificateNumber: 'EIC-2026-00002', status: 'isolated_verified' },
            ],
          }),
        }),
      });
      select.mockReturnValueOnce({
        from: () => ({
          where: async () => [
            { id: 'p1', certificateId: 'eic-1', pointCode: 'A' },
            { id: 'p2', certificateId: 'eic-2', pointCode: 'B' },
          ],
        }),
      });
      select.mockReturnValueOnce({
        from: () => ({
          where: async () => [{ pointId: 'p1' }, { pointId: 'p2' }],
        }),
      });
      (service as any).db = { select };

      await expect(service.assertIsolationReadyToStart('permit-1', mockUser as any)).resolves.toBeUndefined();
    });

    it('blocks permit start when an isolated certificate still has an unproved point', async () => {
      const service = Object.create(PermitLototoExecutionService.prototype) as PermitLototoExecutionService;
      (service as any).permitService = {
        findOne: async () => ({ permit: { id: 'permit-1', lototoRequired: true } }),
      };
      const select = jest.fn();
      select.mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: async () => [{ id: 'eic-1', certificateNumber: 'EIC-2026-00001', status: 'isolated_verified' }],
          }),
        }),
      });
      select.mockReturnValueOnce({
        from: () => ({
          where: async () => [{ id: 'p1', certificateId: 'eic-1', pointCode: 'A' }],
        }),
      });
      select.mockReturnValueOnce({
        from: () => ({
          where: async () => [],
        }),
      });
      (service as any).db = { select };

      await expect(service.assertIsolationReadyToStart('permit-1', mockUser as any)).rejects.toThrow(ConflictException);
    });

    it('blocks permit start when an attached EIC is not yet verified zero-energy', async () => {
      const service = Object.create(PermitLototoExecutionService.prototype) as PermitLototoExecutionService;
      (service as any).permitService = {
        findOne: async () => ({ permit: { id: 'permit-1', lototoRequired: true } }),
      };
      (service as any).db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([
                { id: 'eic-1', certificateNumber: 'EIC-2026-00001', status: 'isolation_in_progress' },
              ]),
            }),
          }),
        }),
      };

      await expect(service.assertIsolationReadyToStart('permit-1', mockUser as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('falls back to procedural board verification if no EICs are explicitly linked', async () => {
      const service = Object.create(PermitLototoExecutionService.prototype) as PermitLototoExecutionService;
      (service as any).permitService = {
        findOne: async () => ({ permit: { id: 'permit-1', lototoRequired: true } }),
      };
      (service as any).db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
      service.getBoard = async () => ({ isolated: true } as any);

      await expect(service.assertIsolationReadyToStart('permit-1', mockUser as any)).resolves.toBeUndefined();
    });
  });

  describe('De-Isolation & Restoration Gate on EIC', () => {
    let certService: IsolationCertificateService;
    let mockDb: any;
    let mockValidation: any;
    let mockAudit: any;

    beforeEach(() => {
      mockDb = {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
      };
      mockValidation = {
        requireTenant: jest.fn().mockReturnValue(mockTenantId),
        assertWorkLocationExists: jest.fn().mockResolvedValue(undefined),
      };
      mockAudit = {
        log: jest.fn().mockResolvedValue(undefined),
      };
      certService = new IsolationCertificateService(mockDb, mockValidation, mockAudit);
    });

    it('blocks restoration if active or working permits are still attached to the EIC', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { permitId: 'permit-1', reference: 'PTW-2026-0001', status: 'active' },
              { permitId: 'permit-2', reference: 'PTW-2026-0002', status: 'execution_completed' },
            ]),
          }),
        }),
      });

      await expect(certService.assertCanStartRestoration('eic-1')).rejects.toThrow(ConflictException);
    });

    it('allows restoration if all attached permits have finished work or are closed', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              { permitId: 'permit-1', reference: 'PTW-2026-0001', status: 'execution_completed' },
              { permitId: 'permit-2', reference: 'PTW-2026-0002', status: 'closed' },
            ]),
          }),
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      await expect(certService.assertCanStartRestoration('eic-1')).resolves.toBeUndefined();
    });
  });

  describe('Permit Attachment & Detachment', () => {
    let certService: IsolationCertificateService;
    let mockDb: any;
    let mockValidation: any;
    let mockAudit: any;

    beforeEach(() => {
      mockDb = {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
      };
      mockValidation = {
        requireTenant: jest.fn().mockReturnValue(mockTenantId),
        assertWorkLocationExists: jest.fn().mockResolvedValue(undefined),
      };
      mockAudit = {
        log: jest.fn().mockResolvedValue(undefined),
      };
      certService = new IsolationCertificateService(mockDb, mockValidation, mockAudit);
      (certService as any).requireCertificate = jest.fn().mockResolvedValue({
        id: 'eic-1',
        certificateNumber: 'EIC-2026-00001',
      });
    });

    it('attaches permit to EIC successfully', async () => {
      // Mock permit exists
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 'permit-1', tenantId: mockTenantId }]),
        }),
      });
      // Mock no existing attachment
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });
      // Mock insert returning
      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            { id: 'att-1', certificateId: 'eic-1', permitId: 'permit-1', attachmentStatus: 'attached' },
          ]),
        }),
      });

      const res = await certService.attachPermit('eic-1', 'permit-1', mockUser as any);
      expect(res.attachmentStatus).toBe('attached');
    });

    it('rejects duplicate attachment when permit is already attached', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 'permit-1', tenantId: mockTenantId }]),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 'att-1', certificateId: 'eic-1', permitId: 'permit-1', attachmentStatus: 'attached' },
          ]),
        }),
      });

      await expect(certService.attachPermit('eic-1', 'permit-1', mockUser as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
