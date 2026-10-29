import { BadRequestException, ConflictException } from '@nestjs/common';
import { ZveVerificationService } from '../app/src/modules/lototo/zve-verification.service';

describe('TASK-LOTOTO-03: Structured Zero-Energy Verification (Tryout / ZVE) Engine', () => {
  let service: ZveVerificationService;
  let mockDb: any;
  let mockValidation: any;
  let mockAudit: any;

  const mockTenantId = '22222222-2222-2222-2222-222222222222';
  const mockUser = {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: mockTenantId,
    roles: ['permit-approver', 'safety-officer'],
  };

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
    };
    mockValidation = {
      requireTenant: jest.fn().mockReturnValue(mockTenantId),
    };
    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new ZveVerificationService(mockDb, mockValidation, mockAudit);
  });

  function setupCertificate(status = 'isolation_in_progress') {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([
          {
            id: 'cert-1',
            tenantId: mockTenantId,
            status,
            isolationAuthorityId: mockUser.id,
          },
        ]),
      }),
    });
    mockDb.insert = jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([
          { id: 'zve-1', certificateId: 'cert-1', pointCode: 'ISO-01', result: 'pass' },
        ]),
      }),
    });
  }

  describe('Zero-Energy Tryout Physics Validations', () => {
    it('accepts Electrical Live-Dead-Live test with verified 0.0V readings', async () => {
      setupCertificate();

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const res = await service.recordVerification(
        'cert-1',
        {
          pointCode: 'MCC-BKR-01',
          verificationCategory: 'electrical_live_dead_live',
          instrumentMakeModel: 'Fluke 87V Calibrated Multimeter',
          instrumentSerialNo: 'FLK-998822',
          calibrationExpiryDate: futureDate.toISOString(),
          readingsPayload: {
            phaseL1L2: 0,
            phaseL2L3: 0,
            phaseL3L1: 0,
            phaseL1N: 0,
            phaseL1G: 0,
            unit: 'V',
          },
          photoStorageKey: 'lototo/zve/zero-meter.jpg',
          photoChecksum: 'sha256-hash-sample',
        },
        mockUser as any,
      );

      expect(res.result).toBe('pass');
    });

    it('rejects Electrical Live-Dead-Live test when hazardous voltage remains (>0.0V)', async () => {
      setupCertificate();

      await expect(
        service.recordVerification(
          'cert-1',
          {
            pointCode: 'MCC-BKR-01',
            verificationCategory: 'electrical_live_dead_live',
            result: 'pass',
            readingsPayload: {
              phaseL1L2: 230,
              phaseL2L3: 230,
              phaseL3L1: 230,
            },
          },
          mockUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts Pressure Bleed & Vent verification when pressure is 0.0', async () => {
      setupCertificate();

      const res = await service.recordVerification(
        'cert-1',
        {
          pointCode: 'VLV-STEAM-01',
          verificationCategory: 'pressure_bleed_vent',
          readingsPayload: {
            residualPressure: 0,
            ventOpened: true,
            bleederDrained: true,
            unit: 'PSI',
          },
        },
        mockUser as any,
      );

      expect(res.result).toBe('pass');
    });

    it('rejects Pressure verification when residual pressure exists (>0)', async () => {
      setupCertificate();

      await expect(
        service.recordVerification(
          'cert-1',
          {
            pointCode: 'VLV-STEAM-01',
            verificationCategory: 'pressure_bleed_vent',
            result: 'pass',
            readingsPayload: {
              residualPressure: 15.5,
            },
          },
          mockUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects Chemical Sniff verification when toxic vapor or combustible gas is detected', async () => {
      setupCertificate();

      await expect(
        service.recordVerification(
          'cert-1',
          {
            pointCode: 'CHM-FLANGE-02',
            verificationCategory: 'chemical_sniff_purge',
            result: 'pass',
            readingsPayload: {
              lelPercent: 5.0, // Hazardous LEL detected!
              toxicPpm: 0,
            },
          },
          mockUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects Mechanical Jog/Bump test if machinery movement is observed', async () => {
      setupCertificate();

      await expect(
        service.recordVerification(
          'cert-1',
          {
            pointCode: 'MTR-CONV-01',
            verificationCategory: 'mechanical_jog_tryout',
            result: 'pass',
            readingsPayload: {
              movementDetected: true,
            },
          },
          mockUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Instrument Calibration Validation', () => {
    it('rejects verification if the testing instrument calibration has expired', async () => {
      setupCertificate();

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

      await expect(
        service.recordVerification(
          'cert-1',
          {
            pointCode: 'ISO-01',
            verificationCategory: 'electrical_live_dead_live',
            instrumentMakeModel: 'Old Meter',
            calibrationExpiryDate: pastDate.toISOString(),
            readingsPayload: { voltage: 0 },
          },
          mockUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Certificate Status Gate', () => {
    it('blocks recording verification when certificate is in draft status', async () => {
      setupCertificate('draft');

      await expect(
        service.recordVerification(
          'cert-1',
          {
            pointCode: 'ISO-01',
            verificationCategory: 'pressure_bleed_vent',
            readingsPayload: { residualPressure: 0 },
          },
          mockUser as any,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
