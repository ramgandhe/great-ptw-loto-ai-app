import { ConflictException } from '@nestjs/common';
import { IsolationBlindService } from '../app/src/modules/lototo/isolation-blind.service';
import { IsolationCertificateService } from '../app/src/modules/lototo/isolation-certificate.service';

describe('TASK-LOTOTO-05: Mechanical Blind & Spade Tracking Register', () => {
  let blindService: IsolationBlindService;
  let certService: IsolationCertificateService;
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
    };
    mockValidation = {
      requireTenant: jest.fn().mockReturnValue(mockTenantId),
    };
    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    blindService = new IsolationBlindService(mockDb, mockValidation, mockAudit);
    certService = new IsolationCertificateService(mockDb, mockValidation, mockAudit);
  });

  function setupBlind(status = 'planned') {
    const blind = {
      id: 'blind-1',
      tenantId: mockTenantId,
      certificateId: 'cert-1',
      blindTagNumber: 'BLD-HC-001',
      lineTagNumber: '6"-HC-1002-316L',
      status,
    };
    (blindService as any).requireBlind = jest.fn().mockResolvedValue(blind);
    return blind;
  }

  describe('Blind Installation & Removal Lifecycle', () => {
    it('creates a planned blind under an active EIC', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 'cert-1', tenantId: mockTenantId }]),
        }),
      });

      mockDb.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            { id: 'blind-1', blindTagNumber: 'BLD-HC-001', status: 'planned' },
          ]),
        }),
      });

      const res = await blindService.createBlind(
        'cert-1',
        {
          blindTagNumber: 'BLD-HC-001',
          lineTagNumber: '6"-HC-1002-316L',
          blindType: 'slip_blind',
          flangeRating: 'Class 300 ANSI RF',
          blindSize: '6 inch',
        },
        mockUser as any,
      );

      expect(res.status).toBe('planned');
    });

    it('records installation and torque verification', async () => {
      setupBlind('planned');

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([
              { id: 'blind-1', status: 'installed_torqued', installedTorqueNm: 150 },
            ]),
          }),
        }),
      });

      const res = await blindService.recordInstallation(
        'blind-1',
        { installedTorqueNm: 150 },
        mockUser as any,
      );

      expect(res.status).toBe('installed_torqued');
    });

    it('blocks duplicate installation when blind is already installed', async () => {
      setupBlind('installed_torqued');

      await expect(
        blindService.recordInstallation('blind-1', { installedTorqueNm: 150 }, mockUser as any),
      ).rejects.toThrow(ConflictException);
    });

    it('blocks removal verification if blind was never installed', async () => {
      setupBlind('planned');

      await expect(
        blindService.recordRemoval('blind-1', { gasketReplaced: true }, mockUser as any),
      ).rejects.toThrow(ConflictException);
    });

    it('records verified removal with new gasket replacement', async () => {
      setupBlind('installed_torqued');

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([
              { id: 'blind-1', status: 'removal_verified', gasketReplaced: true },
            ]),
          }),
        }),
      });

      const res = await blindService.recordRemoval(
        'blind-1',
        { gasketReplaced: true },
        mockUser as any,
      );

      expect(res.status).toBe('removal_verified');
      expect(res.gasketReplaced).toBe(true);
    });
  });

  describe('De-Isolation Safety Gate with Blinds', () => {
    it('BLOCKS restoration if any mechanical blind remains installed', async () => {
      // Mock no active permits
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock installed blind still present!
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 'blind-1', tag: 'BLD-HC-001', line: '6"-HC-1002-316L' },
          ]),
        }),
      });

      await expect(certService.assertCanStartRestoration('cert-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('ALLOWS restoration when all blinds have had removal verified', async () => {
      // Mock no active permits
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock zero installed blinds, no open test, and no personal locks.
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(certService.assertCanStartRestoration('cert-1')).resolves.toBeUndefined();
    });
  });
});
