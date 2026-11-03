import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
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
  isolationPointEvidence,
  isolationPointProofs,
  isolationSanctionTests,
  IsolationCertificateStatus,
  lockboxCrewLocks,
  lototoProcedurePhotos,
  lototoProcedureSequenceSteps,
  lototoProcedures,
  competencies,
  permitExecutors,
  permits,
  workLocations,
} from '../../database/schema';
import { generateCertificateReference } from '../../database/certificate-reference';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../permit/permit.constants';
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
import { loadLototoOptions, saveLototoOptions, type LototoTenantOptions } from './lototo-options';

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
    private readonly storageService: StorageService,
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

  async getOptions(user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    return loadLototoOptions(this.db, tenantId);
  }

  async saveOptions(patch: Partial<LototoTenantOptions>, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const saved = await saveLototoOptions(this.db, tenantId, patch, user.id);
    await this.auditService.log({
      action: 'lototo.options.updated',
      entityType: 'lototo_tenant_options',
      entityId: tenantId,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: saved,
    });
    return saved;
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

    const rows = await this.db
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

    if (rows.length === 0) return rows;

    const ids = rows.map((row) => row.certificate.id);
    const [permitLinks, openTests] = await Promise.all([
      this.db
        .select({
          certificateId: isolationCertificatePermits.certificateId,
          permitId: isolationCertificatePermits.permitId,
        })
        .from(isolationCertificatePermits)
        .where(
          and(
            inArray(isolationCertificatePermits.certificateId, ids),
            ne(isolationCertificatePermits.attachmentStatus, 'detached'),
          ),
        ),
      this.db
        .select({
          certificateId: isolationSanctionTests.certificateId,
          id: isolationSanctionTests.id,
        })
        .from(isolationSanctionTests)
        .where(
          and(
            inArray(isolationSanctionTests.certificateId, ids),
            eq(isolationSanctionTests.status, 'in_test'),
          ),
        ),
    ]);

    const permitCount = new Map<string, number>();
    for (const link of permitLinks) {
      permitCount.set(link.certificateId, (permitCount.get(link.certificateId) ?? 0) + 1);
    }
    const underTest = new Set(openTests.map((row) => row.certificateId));

    return rows.map((row) => ({
      ...row,
      attachedPermitCount: permitCount.get(row.certificate.id) ?? 0,
      underTest: underTest.has(row.certificate.id),
      walkOverdue:
        row.certificate.isLongTerm &&
        row.certificate.nextAuditDueDate != null &&
        row.certificate.nextAuditDueDate.getTime() < Date.now(),
    }));
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

    const versionId = row.certificate.procedureVersionId;
    const photosForVersion = versionId
      ? await this.db
          .select()
          .from(lototoProcedurePhotos)
          .where(eq(lototoProcedurePhotos.versionId, versionId))
      : [];

    const sequenceSteps = versionId
      ? await this.db
          .select()
          .from(lototoProcedureSequenceSteps)
          .where(eq(lototoProcedureSequenceSteps.versionId, versionId))
          .orderBy(asc(lototoProcedureSequenceSteps.phase), asc(lototoProcedureSequenceSteps.sequenceOrder))
      : [];

    const evidenceRows = points.length
      ? await this.db
          .select()
          .from(isolationPointEvidence)
          .where(eq(isolationPointEvidence.certificateId, id))
          .orderBy(asc(isolationPointEvidence.uploadedAt))
      : [];
    const options = await loadLototoOptions(this.db, tenantId);

    const pointsWithInfo = await Promise.all(
      points.map(async (point) => {
        const photo = photosForVersion.find((row) => row.lockoutPointId === point.sourcePointId);
        const evidence = await Promise.all(
          evidenceRows
            .filter((row) => row.pointId === point.id)
            .map(async (row) => ({
              id: row.id,
              kind: row.kind,
              proofId: row.proofId,
              fileName: row.fileName,
              url: await this.storageService.presignedGetObject(row.storageKey, 3600),
              uploadedAt: row.uploadedAt,
            })),
        );
        return {
          ...point,
          proofs: proofs.filter((proof) => proof.pointId === point.id),
          infoPhoto: photo
            ? {
                id: photo.id,
                fileName: photo.fileName,
                url: await this.storageService.presignedGetObject(photo.storageKey, 3600),
              }
            : null,
          evidence,
        };
      }),
    );

    const stepsWithInfo = await Promise.all(
      sequenceSteps.map(async (step) => {
        const photo = photosForVersion.find((row) => row.sequenceStepId === step.id);
        return {
          id: step.id,
          phase: step.phase,
          sequenceOrder: step.sequenceOrder,
          title: step.title,
          action: step.action,
          infoText: step.infoText,
          verification: step.verification,
          note: step.note,
          infoPhoto: photo
            ? {
                id: photo.id,
                fileName: photo.fileName,
                url: await this.storageService.presignedGetObject(photo.storageKey, 3600),
              }
            : null,
        };
      }),
    );

    return {
      ...row.certificate,
      asset: row.asset,
      workLocation: row.location,
      points: pointsWithInfo,
      sequenceSteps: stepsWithInfo,
      options,
    };
  }

  async uploadPointEvidence(
    certificateId: string,
    pointId: string,
    kind: 'apply' | 'proof' | 'restore',
    file: UploadedFilePayload,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.validationService.requireTenant(user);
    if (!file) throw new BadRequestException('A photo file is required');
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException(`File exceeds maximum size of ${MAX_ATTACHMENT_SIZE_BYTES} bytes`);
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Evidence photos must be JPEG, PNG, or WebP');
    }
    await this.requireCertificate(certificateId, tenantId);
    const [point] = await this.db
      .select()
      .from(isolationCertificatePoints)
      .where(
        and(
          eq(isolationCertificatePoints.id, pointId),
          eq(isolationCertificatePoints.certificateId, certificateId),
        ),
      );
    if (!point) throw new NotFoundException('Isolation point not found');

    const storageKey = `${tenantId}/lototo/certificates/${certificateId}/${pointId}/${kind}/${randomUUID()}-${file.originalname}`;
    await this.storageService.putObject(storageKey, file.buffer, file.mimetype, file.size);
    const [row] = await this.db
      .insert(isolationPointEvidence)
      .values({
        tenantId,
        certificateId,
        pointId,
        kind,
        fileName: file.originalname,
        contentType: file.mimetype,
        storageBucket: this.storageService.getBucket(),
        storageKey,
        uploadedBy: user.id,
        createdBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
      })
      .returning();

    return {
      id: row.id,
      kind: row.kind,
      fileName: row.fileName,
      url: await this.storageService.presignedGetObject(row.storageKey, 3600),
      uploadedAt: row.uploadedAt,
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

    if (targetStatus === 'isolation_in_progress') {
      const options = await loadLototoOptions(this.db, tenantId);
      if (options.requireSecondApprovalBeforeIsolate) {
        const second = dto.secondApproverId?.trim();
        if (!second || second === user.id) {
          throw new ConflictException(
            'A second authorised person must approve before isolation can start',
          );
        }
        if (certificate.approverId && certificate.approverId === second) {
          throw new ConflictException('The second approver must be a different person from the first approver');
        }
      }
      // Soft competence check: audit only when the tenant tracks competencies and this user has none.
      const [anyCompetency] = await this.db
        .select({ id: competencies.id })
        .from(competencies)
        .where(and(eq(competencies.tenantId, tenantId), eq(competencies.status, 'active')))
        .limit(1);
      if (anyCompetency) {
        const [mine] = await this.db
          .select({ id: competencies.id })
          .from(competencies)
          .where(
            and(
              eq(competencies.tenantId, tenantId),
              eq(competencies.workforceUserId, user.id),
              eq(competencies.status, 'active'),
            ),
          )
          .limit(1);
        if (!mine) {
          await this.auditService.log({
            action: 'lototo.certificate.competence_warning',
            entityType: 'isolation_certificate',
            entityId: id,
            userId: optionalUuid(user.id),
            tenantId,
            metadata: { warning: 'Isolation started without an active competency on this user' },
          });
        }
      }
    }
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
    if (targetStatus === 'restored_verified') {
      await this.notifyAffected(updated, user.id, 'isolation_restored');
    }
    if (targetStatus === 'sanction_for_test') {
      await this.notifyAffected(updated, user.id, 'isolation_under_test');
    }

    return updated;
  }

  /** Attached permit issuers, executors, and the isolation authority hear status changes. */
  async notifyAffected(
    certificate: {
      id: string;
      tenantId: string;
      certificateNumber: string;
      isolationAuthorityId?: string | null;
      createdBy?: string | null;
    },
    actorId: string,
    action: 'isolation_isolated' | 'isolation_restored' | 'isolation_under_test',
  ): Promise<void> {
    if (!this.notifications) return;
    try {
      const links = await this.db
        .select({ permitId: isolationCertificatePermits.permitId, createdBy: permits.createdBy })
        .from(isolationCertificatePermits)
        .innerJoin(permits, eq(isolationCertificatePermits.permitId, permits.id))
        .where(
          and(
            eq(isolationCertificatePermits.certificateId, certificate.id),
            ne(isolationCertificatePermits.attachmentStatus, 'detached'),
          ),
        );
      const permitIds = links.map((row) => row.permitId);
      const executors = permitIds.length
        ? await this.db
            .select({ workforceUserId: permitExecutors.workforceUserId })
            .from(permitExecutors)
            .where(inArray(permitExecutors.permitId, permitIds))
        : [];
      const recipients = [
        ...new Set(
          [
            ...links.map((row) => row.createdBy),
            ...executors.map((row) => row.workforceUserId),
            certificate.isolationAuthorityId,
            certificate.createdBy,
          ].filter((id): id is string => Boolean(id)),
        ),
      ];
      if (recipients.length === 0) return;
      await this.notifications.enqueuePlanningNotification({
        planId: certificate.id,
        tenantId: certificate.tenantId,
        action,
        actorId,
        metadata: {
          recipientIds: recipients,
          certificateNumber: certificate.certificateNumber,
        },
      });
    } catch {
      // Status is already saved. A missed notice must not undo it.
    }
  }

  private async notifyIsolated(
    certificate: {
      id: string;
      tenantId: string;
      certificateNumber: string;
      isolationAuthorityId?: string | null;
      createdBy?: string | null;
    },
    actorId: string,
  ): Promise<void> {
    await this.notifyAffected(certificate, actorId, 'isolation_isolated');
    await this.notifyReady(certificate.id, actorId);
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
    const tagOnly = point.method === 'tag_only';
    const lockNumber = (dto.lockNumber ?? '').trim();
    if (!tagOnly && !lockNumber) {
      throw new BadRequestException('A lock number is required unless this point is tag-only');
    }
    if (tagOnly && !dto.tagNumber.trim()) {
      throw new BadRequestException('A tag number is required for tag-only points');
    }
    const options = await loadLototoOptions(this.db, tenantId);
    if (options.requireEvidencePhoto) {
      await this.assertPointEvidence(pointId, 'apply');
    }

    await this.db
      .update(isolationCertificatePoints)
      .set({
        positionConfirmed: dto.positionConfirmed.trim(),
        lockNumber: tagOnly ? lockNumber || 'TAG-ONLY' : lockNumber,
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

    const options = await loadLototoOptions(this.db, tenantId);
    if (options.requireEvidencePhoto) {
      await this.assertPointEvidence(pointId, 'restore');
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
    const options = await loadLototoOptions(this.db, tenantId);
    if (options.requireDistinctProver && point.appliedBy && point.appliedBy === user.id) {
      throw new ConflictException('A different person must prove this point');
    }
    if (options.requireEvidencePhoto && dto.result === 'pass') {
      await this.assertPointEvidence(pointId, 'proof');
    }
    assertProofAcceptable({
      proof: point.proof,
      result: dto.result,
      readings: dto.readings,
      instrumentMakeModel: dto.instrumentMakeModel,
      instrumentSerialNo: dto.instrumentSerialNo,
      calibrationExpiryDate: dto.calibrationExpiryDate,
    });

    const [proof] = await this.db
      .insert(isolationPointProofs)
      .values({
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
      })
      .returning();

    if (dto.result === 'pass') {
      await this.db
        .update(isolationPointEvidence)
        .set({ proofId: proof.id, updatedBy: optionalUuid(user.id), updatedAt: new Date() })
        .where(
          and(
            eq(isolationPointEvidence.pointId, pointId),
            eq(isolationPointEvidence.kind, 'proof'),
            isNull(isolationPointEvidence.proofId),
          ),
        );
    }

    return this.findOne(certificateId, user);
  }

  private async assertPointEvidence(pointId: string, kind: 'apply' | 'proof' | 'restore') {
    const [row] = await this.db
      .select({ id: isolationPointEvidence.id })
      .from(isolationPointEvidence)
      .where(and(eq(isolationPointEvidence.pointId, pointId), eq(isolationPointEvidence.kind, kind)))
      .limit(1);
    if (!row) {
      throw new ConflictException(`Upload an evidence photo for this ${kind} step first`);
    }
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
