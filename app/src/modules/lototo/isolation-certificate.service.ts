import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  assets,
  isolationBlinds,
  isolationCertificatePermits,
  isolationCertificatePoints,
  isolationCertificates,
  isolationLockboxes,
  isolationPointProofs,
  isolationSanctionTests,
  IsolationCertificateStatus,
  lockboxCrewLocks,
  lototoProcedures,
  permits,
  workLocations,
} from '../../database/schema';
import { generateCertificateReference } from '../../database/certificate-reference';
import { AuditService } from '../logging/audit.service';
import {
  ApplyCertificatePointDto,
  CreateIsolationCertificateDto,
  RecordPointProofDto,
  TransitionIsolationCertificateDto,
  UpdateIsolationCertificateDto,
} from './dto/isolation-certificate.dto';
import { LototoValidationService } from './lototo-validation.service';
import { NotificationService } from './notification.service';
import { assertProofAcceptable, earlierUnappliedPoint } from './certificate-points';
import { copyProcedurePoints } from './issue-permit-certificates';

const VALID_TRANSITIONS: Record<IsolationCertificateStatus, IsolationCertificateStatus[]> = {
  draft: ['pending_approval', 'approved'],
  pending_approval: ['approved', 'draft'],
  approved: ['isolation_in_progress', 'draft'],
  isolation_in_progress: ['isolated_verified', 'approved'],
  isolated_verified: ['sanction_for_test', 'restoration_in_progress'],
  sanction_for_test: ['isolated_verified'],
  restoration_in_progress: ['restored_verified', 'isolated_verified'],
  restored_verified: ['closed'],
  closed: [],
};

@Injectable()
export class IsolationCertificateService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
    private readonly auditService: AuditService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  async create(dto: CreateIsolationCertificateDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);

    let procedureTitle: string | undefined;
    let resolvedVersionId = dto.procedureVersionId;
    let assetId = dto.assetId ?? null;
    let workLocationId = dto.workLocationId ?? null;
    let siteId = dto.siteId ?? null;

    if (dto.procedureId) {
      const [procedure] = await this.db
        .select()
        .from(lototoProcedures)
        .where(and(eq(lototoProcedures.id, dto.procedureId), eq(lototoProcedures.tenantId, tenantId)));

      if (!procedure) {
        throw new NotFoundException('LOTOTO procedure not found');
      }
      if (procedure.status !== 'published' || !procedure.publishedVersionId) {
        throw new ConflictException('Publish the procedure before starting an isolation');
      }
      procedureTitle = procedure.title;
      resolvedVersionId = procedure.publishedVersionId;
      assetId = assetId ?? procedure.assetId;
      workLocationId = workLocationId ?? procedure.workLocationId;
    }

    if (assetId) {
      const [asset] = await this.db
        .select()
        .from(assets)
        .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)));
      if (!asset) {
        throw new NotFoundException('Asset not found for this tenant');
      }
      workLocationId = workLocationId ?? asset.workLocationId;
      siteId = siteId ?? asset.siteId;
    }

    if (!workLocationId) {
      throw new BadRequestException('A work location is required');
    }
    await this.validationService.assertWorkLocationExists(tenantId, workLocationId);

    return await this.db.transaction(async (tx) => {
      const certificateNumber = await generateCertificateReference(tx, tenantId);

      const [certificate] = await tx
        .insert(isolationCertificates)
        .values({
          tenantId,
          certificateNumber,
          title: dto.title.trim() || procedureTitle || 'Energy Isolation Certificate',
          discipline: dto.discipline ?? 'combined',
          status: 'draft',
          procedureId: dto.procedureId ?? null,
          procedureVersionId: resolvedVersionId ?? null,
          siteId,
          workLocationId,
          assetId,
          isLongTerm: dto.isLongTerm ?? false,
          ltiReason: dto.ltiReason ?? null,
          ltiAuditIntervalDays: dto.ltiAuditIntervalDays ?? 30,
          description: dto.description ?? null,
          safetyPrecautions: dto.safetyPrecautions ?? null,
          isolationAuthorityId: optionalUuid(user.id),
          createdBy: optionalUuid(user.id),
          updatedBy: optionalUuid(user.id),
        })
        .returning();

      if (resolvedVersionId) {
        await copyProcedurePoints(tx, tenantId, certificate.id, resolvedVersionId, user.id);
      }

      await this.auditService.log({
        action: 'lototo.certificate.created',
        entityType: 'isolation_certificate',
        entityId: certificate.id,
        userId: optionalUuid(user.id),
        tenantId,
        metadata: {
          certificateNumber: certificate.certificateNumber,
          discipline: certificate.discipline,
          assetId: certificate.assetId,
        },
      });

      return certificate;
    });
  }

  async findAll(
    user: AuthenticatedUser,
    filters?: {
      status?: string;
      discipline?: string;
      workLocationId?: string;
      assetId?: string;
      isLongTerm?: boolean;
    },
  ) {
    const tenantId = this.validationService.requireTenant(user);
    const conditions = [eq(isolationCertificates.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(isolationCertificates.status, filters.status));
    }
    if (filters?.discipline) {
      conditions.push(eq(isolationCertificates.discipline, filters.discipline));
    }
    if (filters?.workLocationId) {
      conditions.push(eq(isolationCertificates.workLocationId, filters.workLocationId));
    }
    if (filters?.assetId) {
      conditions.push(eq(isolationCertificates.assetId, filters.assetId));
    }
    if (filters?.isLongTerm !== undefined) {
      conditions.push(eq(isolationCertificates.isLongTerm, filters.isLongTerm));
    }

    return this.db
      .select({
        certificate: isolationCertificates,
        assetName: assets.name,
        assetTag: assets.tag,
        locationName: workLocations.name,
      })
      .from(isolationCertificates)
      .leftJoin(assets, eq(isolationCertificates.assetId, assets.id))
      .leftJoin(workLocations, eq(isolationCertificates.workLocationId, workLocations.id))
      .where(and(...conditions))
      .orderBy(desc(isolationCertificates.createdAt));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);

    const [row] = await this.db
      .select({
        certificate: isolationCertificates,
        asset: assets,
        location: workLocations,
      })
      .from(isolationCertificates)
      .leftJoin(assets, eq(isolationCertificates.assetId, assets.id))
      .leftJoin(workLocations, eq(isolationCertificates.workLocationId, workLocations.id))
      .where(and(eq(isolationCertificates.id, id), eq(isolationCertificates.tenantId, tenantId)));

    if (!row) {
      throw new NotFoundException('Energy Isolation Certificate not found');
    }

    const points = await this.db
      .select()
      .from(isolationCertificatePoints)
      .where(eq(isolationCertificatePoints.certificateId, id))
      .orderBy(asc(isolationCertificatePoints.sortOrder));
    const proofs = points.length
      ? await this.db
          .select()
          .from(isolationPointProofs)
          .where(eq(isolationPointProofs.certificateId, id))
          .orderBy(asc(isolationPointProofs.verifiedAt))
      : [];

    return {
      ...row.certificate,
      asset: row.asset,
      workLocation: row.location,
      points: points.map((point) => ({
        ...point,
        proofs: proofs.filter((proof) => proof.pointId === point.id),
      })),
    };
  }

  async update(id: string, dto: UpdateIsolationCertificateDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(id, tenantId);

    if (certificate.status !== 'draft') {
      throw new ConflictException('Certificate can only be edited while in draft status');
    }

    const updates: Partial<typeof isolationCertificates.$inferInsert> = {
      updatedBy: optionalUuid(user.id),
      updatedAt: new Date(),
    };

    if (dto.title !== undefined) updates.title = dto.title.trim();
    if (dto.discipline !== undefined) updates.discipline = dto.discipline;
    if (dto.siteId !== undefined) updates.siteId = dto.siteId;
    if (dto.workLocationId !== undefined) {
      await this.validationService.assertWorkLocationExists(tenantId, dto.workLocationId);
      updates.workLocationId = dto.workLocationId;
    }
    if (dto.assetId !== undefined) updates.assetId = dto.assetId;
    if (dto.isLongTerm !== undefined) updates.isLongTerm = dto.isLongTerm;
    if (dto.ltiReason !== undefined) updates.ltiReason = dto.ltiReason;
    if (dto.ltiAuditIntervalDays !== undefined) updates.ltiAuditIntervalDays = dto.ltiAuditIntervalDays;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.safetyPrecautions !== undefined) updates.safetyPrecautions = dto.safetyPrecautions;

    const [updated] = await this.db
      .update(isolationCertificates)
      .set(updates)
      .where(eq(isolationCertificates.id, id))
      .returning();

    await this.auditService.log({
      action: 'lototo.certificate.updated',
      entityType: 'isolation_certificate',
      entityId: id,
      userId: optionalUuid(user.id),
      tenantId,
    });

    return updated;
  }

  async transition(id: string, dto: TransitionIsolationCertificateDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(id, tenantId);

    const currentStatus = certificate.status as IsolationCertificateStatus;
    const targetStatus = dto.status;

    this.assertValidTransition(currentStatus, targetStatus);

    if (targetStatus === 'restoration_in_progress') {
      await this.assertCanStartRestoration(id);
    }
    if (targetStatus === 'isolated_verified') {
      await this.assertPointsProved(id);
    }
    if (targetStatus === 'restored_verified') {
      await this.assertPointsRestored(id);
    }

    const now = new Date();
    const updates: Partial<typeof isolationCertificates.$inferInsert> = {
      status: targetStatus,
      updatedBy: optionalUuid(user.id),
      updatedAt: now,
    };

    if (targetStatus === 'approved') {
      updates.approvedAt = now;
      updates.approverId = optionalUuid(user.id);
    } else if (targetStatus === 'isolated_verified') {
      updates.isolatedAt = updates.isolatedAt ?? now;
      updates.verifiedAt = now;
    } else if (targetStatus === 'restoration_in_progress') {
      updates.restorationStartedAt = now;
    } else if (targetStatus === 'restored_verified') {
      updates.restoredAt = now;
    } else if (targetStatus === 'closed') {
      updates.closedAt = now;
    }

    const [updated] = await this.db
      .update(isolationCertificates)
      .set(updates)
      .where(eq(isolationCertificates.id, id))
      .returning();

    await this.auditService.log({
      action: 'lototo.certificate.transitioned',
      entityType: 'isolation_certificate',
      entityId: id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: {
        from: currentStatus,
        to: targetStatus,
        notes: dto.notes,
      },
    });

    if (targetStatus === 'isolated_verified') {
      await this.notifyIsolated(updated, user.id);
    }

    return updated;
  }

  /** The receiver of each attached permit hears that the isolation is proved. */
  private async notifyIsolated(
    certificate: { id: string; tenantId: string; certificateNumber: string },
    actorId: string,
  ): Promise<void> {
    if (!this.notifications) return;
    try {
      const attached = await this.db
        .select({ createdBy: permits.createdBy })
        .from(isolationCertificatePermits)
        .innerJoin(permits, eq(isolationCertificatePermits.permitId, permits.id))
        .where(
          and(
            eq(isolationCertificatePermits.certificateId, certificate.id),
            ne(isolationCertificatePermits.attachmentStatus, 'detached'),
          ),
        );
      const recipients = [...new Set(attached.map((row) => row.createdBy).filter((id): id is string => Boolean(id)))];
      if (recipients.length > 0) {
        await this.notifications.enqueuePlanningNotification({
          planId: certificate.id,
          tenantId: certificate.tenantId,
          action: 'isolation_isolated',
          actorId,
          metadata: {
            recipientIds: recipients,
            certificateNumber: certificate.certificateNumber,
          },
        });
      }
      await this.notifyReady(certificate.id, actorId);
    } catch {
      // The isolation is already saved. A missed notice must not undo it.
    }
  }

  /** The isolation authority hears once restoration is actually allowed. */
  async notifyReady(certificateId: string, actorId: string): Promise<void> {
    if (!this.notifications) return;
    try {
      const [certificate] = await this.db
        .select()
        .from(isolationCertificates)
        .where(eq(isolationCertificates.id, certificateId));
      if (!certificate || certificate.status !== 'isolated_verified') return;
      await this.assertCanStartRestoration(certificateId);
      const authorityId = certificate.isolationAuthorityId ?? certificate.createdBy;
      if (!authorityId) return;
      await this.notifications.enqueuePlanningNotification({
        planId: certificate.id,
        tenantId: certificate.tenantId,
        action: 'ready_to_restore',
        actorId,
        metadata: {
          recipientIds: [authorityId],
          certificateNumber: certificate.certificateNumber,
        },
      });
    } catch (error) {
      if (error instanceof ConflictException) return;
    }
  }

  async notifyReadyForPermit(permitId: string, actorId: string): Promise<void> {
    const rows = await this.db
      .select({ certificateId: isolationCertificatePermits.certificateId })
      .from(isolationCertificatePermits)
      .where(
        and(
          eq(isolationCertificatePermits.permitId, permitId),
          ne(isolationCertificatePermits.attachmentStatus, 'detached'),
        ),
      );
    for (const row of rows) {
      await this.notifyReady(row.certificateId, actorId);
    }
  }

  async applyPoint(certificateId: string, pointId: string, dto: ApplyCertificatePointDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(certificateId, tenantId);
    if (certificate.status !== 'isolation_in_progress') {
      throw new ConflictException('Start isolation before applying a point');
    }
    const points = await this.loadPoints(certificateId);
    const point = points.find((row) => row.id === pointId);
    if (!point) {
      throw new NotFoundException('Isolation point not found');
    }
    const earlier = earlierUnappliedPoint(points, pointId);
    if (earlier) {
      throw new ConflictException(`Apply ${earlier.pointCode} first`);
    }
    const passed = await this.pointHasPass(pointId);
    if (passed) {
      throw new ConflictException('This point already has a passing proof');
    }

    await this.db
      .update(isolationCertificatePoints)
      .set({
        positionConfirmed: dto.positionConfirmed.trim(),
        lockNumber: dto.lockNumber.trim(),
        tagNumber: dto.tagNumber.trim(),
        appliedBy: optionalUuid(user.id),
        appliedAt: new Date(),
        updatedBy: optionalUuid(user.id),
        updatedAt: new Date(),
      })
      .where(eq(isolationCertificatePoints.id, pointId));

    return this.findOne(certificateId, user);
  }

  async restorePoint(certificateId: string, pointId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(certificateId, tenantId);
    if (certificate.status !== 'restoration_in_progress') {
      throw new ConflictException('Start restoration before returning a point');
    }
    const points = await this.loadPoints(certificateId);
    const ordered = [...points].sort(
      (a, b) => (a.removeOrder ?? a.sortOrder) - (b.removeOrder ?? b.sortOrder) || a.sortOrder - b.sortOrder,
    );
    const point = ordered.find((row) => row.id === pointId);
    if (!point) {
      throw new NotFoundException('Isolation point not found');
    }
    const earlier = ordered.find((row) => row.id !== pointId && !row.restoredAt && ordered.indexOf(row) < ordered.indexOf(point));
    if (earlier) {
      throw new ConflictException(`Restore ${earlier.pointCode} first`);
    }
    if (point.restoredAt) {
      throw new ConflictException('This point is already restored');
    }

    await this.db
      .update(isolationCertificatePoints)
      .set({
        restoredBy: optionalUuid(user.id),
        restoredAt: new Date(),
        updatedBy: optionalUuid(user.id),
        updatedAt: new Date(),
      })
      .where(eq(isolationCertificatePoints.id, pointId));

    return this.findOne(certificateId, user);
  }

  async recordProof(certificateId: string, pointId: string, dto: RecordPointProofDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(certificateId, tenantId);
    if (certificate.status !== 'isolation_in_progress') {
      throw new ConflictException('Start isolation before proving a point');
    }
    const points = await this.loadPoints(certificateId);
    const point = points.find((row) => row.id === pointId);
    if (!point) {
      throw new NotFoundException('Isolation point not found');
    }
    if (!point.appliedAt) {
      throw new ConflictException('Apply this point before proving it');
    }
    if (!point.proof) {
      throw new ConflictException('This point has no proof type');
    }
    assertProofAcceptable({
      proof: point.proof,
      result: dto.result,
      readings: dto.readings,
      instrumentMakeModel: dto.instrumentMakeModel,
      instrumentSerialNo: dto.instrumentSerialNo,
      calibrationExpiryDate: dto.calibrationExpiryDate,
    });

    await this.db.insert(isolationPointProofs).values({
      tenantId,
      certificateId,
      pointId,
      proof: point.proof,
      result: dto.result,
      instrumentMakeModel: dto.instrumentMakeModel?.trim() || null,
      instrumentSerialNo: dto.instrumentSerialNo?.trim() || null,
      calibrationExpiryDate: dto.calibrationExpiryDate?.slice(0, 10) ?? null,
      readings: dto.readings,
      comment: dto.comment?.trim() || null,
      verifiedBy: user.id,
      createdBy: optionalUuid(user.id),
      updatedBy: optionalUuid(user.id),
    });

    return this.findOne(certificateId, user);
  }

  private async loadPoints(certificateId: string) {
    return this.db
      .select()
      .from(isolationCertificatePoints)
      .where(eq(isolationCertificatePoints.certificateId, certificateId))
      .orderBy(asc(isolationCertificatePoints.sortOrder));
  }

  private async pointHasPass(pointId: string) {
    const rows = await this.db
      .select({ id: isolationPointProofs.id })
      .from(isolationPointProofs)
      .where(and(eq(isolationPointProofs.pointId, pointId), eq(isolationPointProofs.result, 'pass')));
    return rows.length > 0;
  }

  private async assertPointsProved(certificateId: string) {
    const points = await this.loadPoints(certificateId);
    if (points.length === 0) {
      throw new ConflictException('This certificate has no isolation points');
    }
    const proofs = await this.db
      .select({ pointId: isolationPointProofs.pointId, result: isolationPointProofs.result })
      .from(isolationPointProofs)
      .where(eq(isolationPointProofs.certificateId, certificateId));
    const passed = new Set(proofs.filter((row) => row.result === 'pass').map((row) => row.pointId));
    const open = points.filter((point) => !passed.has(point.id));
    if (open.length > 0) {
      throw new ConflictException(
        `Prove every isolation point before the certificate can be isolated. Still open: ${open.map((point) => point.pointCode).join(', ')}`,
      );
    }
  }

  private async assertPointsRestored(certificateId: string) {
    const points = await this.loadPoints(certificateId);
    const waiting = points.filter((point) => !point.restoredAt);
    if (waiting.length > 0) {
      throw new ConflictException(
        `Restore every point before the certificate can be restored. Still isolated: ${waiting.map((point) => point.pointCode).join(', ')}`,
      );
    }
  }

  async assertCanStartRestoration(certificateId: string): Promise<void> {
    const attachedRows = await this.db
      .select({
        permitId: permits.id,
        reference: permits.reference,
        status: permits.status,
      })
      .from(isolationCertificatePermits)
      .innerJoin(permits, eq(isolationCertificatePermits.permitId, permits.id))
      .where(
        and(
          eq(isolationCertificatePermits.certificateId, certificateId),
          ne(isolationCertificatePermits.attachmentStatus, 'detached'),
        ),
      );

    const activePermits = attachedRows.filter(
      (p) => p.status === 'active' || p.status === 'suspended' || p.status === 'approved',
    );

    if (activePermits.length > 0) {
      const refs = activePermits.map((p) => p.reference || p.permitId).join(', ');
      throw new ConflictException(
        `Cannot start restoration: Active work permit(s) [${refs}] are still attached to this energy isolation`,
      );
    }

    // Safety Gate: Verify NO mechanical process blinds remain installed
    const installedBlinds = await this.db
      .select({
        id: isolationBlinds.id,
        tag: isolationBlinds.blindTagNumber,
        line: isolationBlinds.lineTagNumber,
      })
      .from(isolationBlinds)
      .where(
        and(
          eq(isolationBlinds.certificateId, certificateId),
          eq(isolationBlinds.status, 'installed_torqued'),
        ),
      );

    if (installedBlinds.length > 0) {
      const blindTags = installedBlinds.map((b) => `${b.tag} (Line: ${b.line})`).join(', ');
      throw new ConflictException(
        `Cannot start restoration: Mechanical process blind(s) [${blindTags}] remain installed. All blinds must have verified removal before de-isolation.`,
      );
    }

    const openTests = await this.db
      .select({ id: isolationSanctionTests.id })
      .from(isolationSanctionTests)
      .where(
        and(eq(isolationSanctionTests.certificateId, certificateId), eq(isolationSanctionTests.status, 'in_test')),
      );
    if (openTests.length > 0) {
      throw new ConflictException('Cannot start restoration while a test is still open');
    }

    const personalLocks = await this.db
      .select({ personalLockNumber: lockboxCrewLocks.personalLockNumber })
      .from(lockboxCrewLocks)
      .innerJoin(isolationLockboxes, eq(lockboxCrewLocks.lockboxId, isolationLockboxes.id))
      .where(and(eq(isolationLockboxes.certificateId, certificateId), isNull(lockboxCrewLocks.removedAt)));
    const stillOn = personalLocks.filter((row) => row.personalLockNumber);
    if (stillOn.length > 0) {
      throw new ConflictException(
        `Cannot start restoration while personal locks remain: ${stillOn.map((row) => row.personalLockNumber).join(', ')}`,
      );
    }
  }

  async attachPermit(certificateId: string, permitId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(certificateId, tenantId);

    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));

    if (!permit) {
      throw new NotFoundException('Permit not found for this tenant');
    }

    const [existing] = await this.db
      .select()
      .from(isolationCertificatePermits)
      .where(
        and(
          eq(isolationCertificatePermits.certificateId, certificateId),
          eq(isolationCertificatePermits.permitId, permitId),
        ),
      );

    if (existing && existing.attachmentStatus !== 'detached') {
      throw new ConflictException('Permit is already attached to this isolation certificate');
    }

    const now = new Date();
    if (existing) {
      const [updated] = await this.db
        .update(isolationCertificatePermits)
        .set({
          attachmentStatus: 'attached',
          attachedAt: now,
          attachedBy: optionalUuid(user.id),
          detachedAt: null,
          detachedBy: null,
          updatedBy: optionalUuid(user.id),
          updatedAt: now,
        })
        .where(eq(isolationCertificatePermits.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(isolationCertificatePermits)
      .values({
        tenantId,
        certificateId,
        permitId,
        attachmentStatus: 'attached',
        attachedAt: now,
        attachedBy: optionalUuid(user.id),
        createdBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
      })
      .returning();

    await this.auditService.log({
      action: 'lototo.certificate.permit_attached',
      entityType: 'isolation_certificate',
      entityId: certificateId,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { permitId, certificateNumber: certificate.certificateNumber },
    });

    return created;
  }

  async detachPermit(certificateId: string, permitId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    await this.requireCertificate(certificateId, tenantId);

    const [existing] = await this.db
      .select()
      .from(isolationCertificatePermits)
      .where(
        and(
          eq(isolationCertificatePermits.certificateId, certificateId),
          eq(isolationCertificatePermits.permitId, permitId),
        ),
      );

    if (!existing || existing.attachmentStatus === 'detached') {
      throw new NotFoundException('Permit is not currently attached to this isolation certificate');
    }

    const now = new Date();
    const [updated] = await this.db
      .update(isolationCertificatePermits)
      .set({
        attachmentStatus: 'detached',
        detachedAt: now,
        detachedBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
        updatedAt: now,
      })
      .where(eq(isolationCertificatePermits.id, existing.id))
      .returning();

    await this.auditService.log({
      action: 'lototo.certificate.permit_detached',
      entityType: 'isolation_certificate',
      entityId: certificateId,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { permitId },
    });

    return updated;
  }

  async getAttachedPermits(certificateId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    await this.requireCertificate(certificateId, tenantId);

    return this.db
      .select({
        id: isolationCertificatePermits.id,
        permitId: permits.id,
        reference: permits.reference,
        title: permits.title,
        status: permits.status,
        attachmentStatus: isolationCertificatePermits.attachmentStatus,
        attachedAt: isolationCertificatePermits.attachedAt,
        detachedAt: isolationCertificatePermits.detachedAt,
      })
      .from(isolationCertificatePermits)
      .innerJoin(permits, eq(isolationCertificatePermits.permitId, permits.id))
      .where(eq(isolationCertificatePermits.certificateId, certificateId))
      .orderBy(desc(isolationCertificatePermits.attachedAt));
  }

  private assertValidTransition(
    currentStatus: IsolationCertificateStatus,
    targetStatus: IsolationCertificateStatus,
  ) {
    if (currentStatus === targetStatus) {
      return;
    }

    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new ConflictException(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }
  }

  private async requireCertificate(id: string, tenantId: string) {
    const [certificate] = await this.db
      .select()
      .from(isolationCertificates)
      .where(and(eq(isolationCertificates.id, id), eq(isolationCertificates.tenantId, tenantId)));

    if (!certificate) {
      throw new NotFoundException('Energy Isolation Certificate not found');
    }

    return certificate;
  }
}
