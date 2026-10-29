import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  isolationBlinds,
  isolationCertificatePoints,
  isolationCertificates,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  CreateBlindDto,
  RecordBlindInstallDto,
  RecordBlindRemovalDto,
} from './dto/isolation-blind.dto';
import { IsolationCertificateService } from './isolation-certificate.service';
import { LototoValidationService } from './lototo-validation.service';

@Injectable()
export class IsolationBlindService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
    private readonly auditService: AuditService,
    @Optional() private readonly certificates?: IsolationCertificateService,
  ) {}

  async createBlind(
    certificateId: string,
    dto: CreateBlindDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.validationService.requireTenant(user);

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

    if (dto.pointId) {
      const [point] = await this.db
        .select({ id: isolationCertificatePoints.id, method: isolationCertificatePoints.method })
        .from(isolationCertificatePoints)
        .where(
          and(
            eq(isolationCertificatePoints.id, dto.pointId),
            eq(isolationCertificatePoints.certificateId, certificateId),
          ),
        );
      if (!point || point.method !== 'blind') {
        throw new ConflictException('A blind is recorded on a blind point');
      }
    }

    const [blind] = await this.db
      .insert(isolationBlinds)
      .values({
        tenantId,
        certificateId,
        blindTagNumber: dto.blindTagNumber.trim(),
        lineTagNumber: dto.lineTagNumber.trim(),
        pidReference: dto.pidReference?.trim() ?? null,
        blindType: dto.blindType ?? 'slip_blind',
        flangeRating: dto.flangeRating?.trim() ?? null,
        blindSize: dto.blindSize?.trim() ?? null,
        materialThickness: dto.materialThickness?.trim() ?? null,
        pointId: dto.pointId ?? null,
        status: 'planned',
        createdBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
      })
      .returning();

    await this.auditService.log({
      action: 'lototo.blind.created',
      entityType: 'isolation_blind',
      entityId: blind.id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: {
        certificateId,
        blindTagNumber: blind.blindTagNumber,
        lineTagNumber: blind.lineTagNumber,
      },
    });

    return blind;
  }

  async getBlindsForCertificate(certificateId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);

    return this.db
      .select()
      .from(isolationBlinds)
      .where(
        and(
          eq(isolationBlinds.certificateId, certificateId),
          eq(isolationBlinds.tenantId, tenantId),
        ),
      )
      .orderBy(desc(isolationBlinds.createdAt));
  }

  async recordInstallation(
    blindId: string,
    dto: RecordBlindInstallDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.validationService.requireTenant(user);
    const blind = await this.requireBlind(blindId, tenantId);

    if (blind.status === 'installed_torqued') {
      throw new ConflictException('Mechanical blind is already marked as installed');
    }
    if (blind.status === 'removal_verified') {
      throw new ConflictException('Cannot re-install a blind that has already had removal verified');
    }

    const now = new Date();
    const [updated] = await this.db
      .update(isolationBlinds)
      .set({
        status: 'installed_torqued',
        installedAt: now,
        installedBy: optionalUuid(user.id),
        installedTorqueNm: dto.installedTorqueNm ?? null,
        updatedBy: optionalUuid(user.id),
        updatedAt: now,
      })
      .where(eq(isolationBlinds.id, blindId))
      .returning();

    await this.auditService.log({
      action: 'lototo.blind.installed',
      entityType: 'isolation_blind',
      entityId: blindId,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: {
        blindTagNumber: blind.blindTagNumber,
        torqueNm: dto.installedTorqueNm,
        notes: dto.notes,
      },
    });

    return updated;
  }

  async recordRemoval(
    blindId: string,
    dto: RecordBlindRemovalDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.validationService.requireTenant(user);
    const blind = await this.requireBlind(blindId, tenantId);

    if (blind.status === 'planned') {
      throw new ConflictException('Cannot verify removal of a mechanical blind that has not been installed');
    }
    if (blind.status === 'removal_verified') {
      throw new ConflictException('Mechanical blind removal has already been verified');
    }

    const now = new Date();
    const [updated] = await this.db
      .update(isolationBlinds)
      .set({
        status: 'removal_verified',
        removedAt: now,
        removedBy: optionalUuid(user.id),
        gasketReplaced: dto.gasketReplaced ?? true,
        updatedBy: optionalUuid(user.id),
        updatedAt: now,
      })
      .where(eq(isolationBlinds.id, blindId))
      .returning();

    await this.auditService.log({
      action: 'lototo.blind.removal_verified',
      entityType: 'isolation_blind',
      entityId: blindId,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: {
        blindTagNumber: blind.blindTagNumber,
        gasketReplaced: updated.gasketReplaced,
        notes: dto.notes,
      },
    });

    await this.certificates?.notifyReady(blind.certificateId, user.id);
    return updated;
  }

  private async requireBlind(blindId: string, tenantId: string) {
    const [blind] = await this.db
      .select()
      .from(isolationBlinds)
      .where(
        and(
          eq(isolationBlinds.id, blindId),
          eq(isolationBlinds.tenantId, tenantId),
        ),
      );

    if (!blind) {
      throw new NotFoundException('Mechanical blind record not found');
    }

    return blind;
  }
}
