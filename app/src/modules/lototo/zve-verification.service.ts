import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  isolationCertificates,
  zeroEnergyVerifications,
  ZveCategory,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { RecordZveVerificationDto } from './dto/zero-energy-verification.dto';
import { LototoValidationService } from './lototo-validation.service';

const ALLOWED_ZVE_STATUSES = [
  'isolation_in_progress',
  'isolated_verified',
  'sanction_for_test',
];

@Injectable()
export class ZveVerificationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
    private readonly auditService: AuditService,
  ) {}

  async recordVerification(
    certificateId: string,
    dto: RecordZveVerificationDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.validationService.requireTenant(user);

    // Verify certificate
    const [certificate] = await this.db
      .select()
      .from(isolationCertificates)
      .where(
        and(
          eq(isolationCertificates.id, certificateId),
          eq(isolationCertificates.tenantId, tenantId),
        ),
      );

    if (!certificate) {
      throw new NotFoundException('Energy Isolation Certificate not found');
    }

    if (!ALLOWED_ZVE_STATUSES.includes(certificate.status)) {
      throw new ConflictException(
        `Cannot record Zero-Energy Verification while certificate is in '${certificate.status}' status`,
      );
    }

    // Validate instrument calibration date
    if (dto.calibrationExpiryDate) {
      const expiry = new Date(dto.calibrationExpiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (expiry < today) {
        throw new BadRequestException(
          'Testing instrument calibration has expired. Calibrated instrument required for Zero-Energy Tryout.',
        );
      }
    }

    // If result is 'pass', strictly validate zero-energy physical readings
    const result = dto.result ?? 'pass';
    if (result === 'pass') {
      this.validateZeroReadings(dto.verificationCategory, dto.readingsPayload);
    }

    const [record] = await this.db
      .insert(zeroEnergyVerifications)
      .values({
        tenantId,
        certificateId,
        pointCode: dto.pointCode.trim(),
        verificationCategory: dto.verificationCategory,
        result,
        instrumentMakeModel: dto.instrumentMakeModel?.trim() ?? null,
        instrumentSerialNo: dto.instrumentSerialNo?.trim() ?? null,
        calibrationExpiryDate: dto.calibrationExpiryDate
          ? new Date(dto.calibrationExpiryDate)
          : null,
        readingsPayload: dto.readingsPayload,
        photoStorageKey: dto.photoStorageKey ?? null,
        photoChecksum: dto.photoChecksum ?? null,
        verifiedBy: optionalUuid(user.id) ?? certificate.isolationAuthorityId ?? user.id,
        verifiedAt: new Date(),
        comment: dto.comment?.trim() ?? null,
        createdBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
      })
      .returning();

    await this.auditService.log({
      action: 'lototo.zve_verification.recorded',
      entityType: 'zero_energy_verification',
      entityId: record.id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: {
        certificateId,
        pointCode: dto.pointCode,
        category: dto.verificationCategory,
        result,
      },
    });

    return record;
  }

  async getVerificationsForCertificate(certificateId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);

    return this.db
      .select()
      .from(zeroEnergyVerifications)
      .where(
        and(
          eq(zeroEnergyVerifications.certificateId, certificateId),
          eq(zeroEnergyVerifications.tenantId, tenantId),
        ),
      )
      .orderBy(desc(zeroEnergyVerifications.verifiedAt));
  }

  private validateZeroReadings(category: ZveCategory, payload: Record<string, unknown>) {
    switch (category) {
      case 'electrical_live_dead_live': {
        const numericValues = [
          payload.phaseL1L2,
          payload.phaseL2L3,
          payload.phaseL3L1,
          payload.phaseL1N,
          payload.phaseL1G,
          payload.voltage,
          payload.reading,
        ].filter((val) => typeof val === 'number');

        const hasNonZero = numericValues.some((v) => Number(v) > 0);
        if (hasNonZero) {
          throw new BadRequestException(
            'Electrical Live-Dead-Live test indicates hazardous residual voltage (> 0.0V). Pass result rejected.',
          );
        }
        break;
      }

      case 'pressure_bleed_vent': {
        const pressure = payload.residualPressure ?? payload.pressure ?? payload.reading;
        if (typeof pressure === 'number' && pressure > 0) {
          throw new BadRequestException(
            'Pressure line verification indicates residual pressure (> 0.0). Pass result rejected.',
          );
        }
        break;
      }

      case 'chemical_sniff_purge': {
        const lel = payload.lelPercent ?? payload.lel;
        const toxic = payload.toxicPpm ?? payload.toxic;
        if (typeof lel === 'number' && lel > 0) {
          throw new BadRequestException(
            'Chemical sniff test indicates combustible gas present (> 0% LEL). Pass result rejected.',
          );
        }
        if (typeof toxic === 'number' && toxic > 0) {
          throw new BadRequestException(
            'Chemical sniff test indicates toxic vapor detected (> 0 ppm). Pass result rejected.',
          );
        }
        break;
      }

      case 'mechanical_jog_tryout': {
        if (payload.movementDetected === true || payload.rotationObserved === true) {
          throw new BadRequestException(
            'Mechanical jog/bump tryout detected movement. Machine did not remain in zero energy state.',
          );
        }
        break;
      }

      case 'stored_energy_block': {
        if (payload.blockPinInserted === false || payload.springDecompressed === false) {
          throw new BadRequestException(
            'Mechanical blocking / spring decompression verification failed. Pin or block not secured.',
          );
        }
        break;
      }
    }
  }
}
