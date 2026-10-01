import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, arrayContains, desc, eq, inArray, ne, or } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { generatePermitReference } from '../../database/permit-reference';
import {
  permitAttachments,
  permitDrafts,
  permitExecutors,
  permitHazards,
  permitPpe,
  permitLototo,
  permitLototoCrew,
  permitLototoExtraPoints,
  permitLototoInstances,
  permitLototoStepNa,
  permitLototoVerifiers,
  permitGasTesting,
  permitViewers,
  permitSafetyOfficers,
  permits,
  permitTemplates,
  lototoProcedureLockoutPoints,
  lototoProcedures,
  gasTestingCatalogue,
  revalidationHistory,
  tenantUsers,
} from '../../database/schema';
import { MailService } from '../../infrastructure/mail/mail.service';
import { AuditService } from '../logging/audit.service';
import { ApprovalHistoryService } from '../approval/approval-history.service';
import { SimopsService } from '../simops/simops.service';
import { NotificationService } from '../approval/notification.service';
import { WorkflowEngineService } from '../approval/workflow-engine.service';
import { CreatePermitDto } from './dto/create-permit.dto';
import { buildFormResponses, missingFormAnswers, type PermitFormResponse } from './permit-forms';
import { RenewPermitDto } from './dto/renew-permit.dto';
import { UpdatePermitDto } from './dto/update-permit.dto';
import { isEditablePermitStatus, isSubmittablePermitStatus } from './permit.constants';
import {
  assertDraftUpdateAllowed,
  assertPeopleReassignAllowed,
  assertPermitCreateAllowed,
  assertPermitSubmitAllowed,
  sanitizeCreatePermitDto,
  sanitizeDraftUpdateDto,
} from './permit-collaboration';
import type { PermitLototoDto } from './dto/permit-relations.dto';
import { ReassignPermitPeopleDto } from './dto/reassign-permit-people.dto';
import { assertLototoWritable, isLototoFrozen } from './permit-lototo-freeze';
import { assertPermitVisible, visiblePermitFilter } from './permit-access';
import {
  PERMIT_CREATE_ROLES,
  PERMIT_EXECUTOR_DRAFT_ROLES,
} from './permit.constants';
import { PermitCacheService } from './permit-cache.service';
import { PermitLogService } from './permit-log.service';
import { PermitValidationService } from './permit-validation.service';

export type PermitLototoDetail = {
  id: string;
  procedureId: string;
  procedureVersionId: string;
  frozenAt: Date | null;
  extraPoints: (typeof permitLototoExtraPoints.$inferSelect)[];
  stepNa: Array<{
    basePointId: string | null;
    extraPointId: string | null;
    extraPointCode: string | null;
    reason: string;
  }>;
  crew: Array<{ workforceUserId: string }>;
  verifiers: Array<{ workforceUserId: string }>;
};

export interface PermitDetail {
  permit: typeof permits.$inferSelect;
  draft: typeof permitDrafts.$inferSelect | null;
  hazards: (typeof permitHazards.$inferSelect)[];
  ppe: (typeof permitPpe.$inferSelect)[];
  lototo: PermitLototoDetail[];
  gasTesting: (typeof permitGasTesting.$inferSelect)[];
  executors: (typeof permitExecutors.$inferSelect)[];
  viewers: (typeof permitViewers.$inferSelect)[];
  safetyOfficers: (typeof permitSafetyOfficers.$inferSelect)[];
  attachments: (typeof permitAttachments.$inferSelect)[];
}

@Injectable()
export class PermitService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: PermitValidationService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
    private readonly permitLogService: PermitLogService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngine: WorkflowEngineService,
    @Inject(forwardRef(() => ApprovalHistoryService))
    private readonly approvalHistoryService: ApprovalHistoryService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => NotificationService))
    private readonly approvalNotifications: NotificationService,
    @Inject(forwardRef(() => SimopsService))
    private readonly simopsService: SimopsService,
  ) {}

  async create(rawDto: CreatePermitDto, user: AuthenticatedUser): Promise<PermitDetail> {
    assertPermitCreateAllowed(user);
    const dto = sanitizeCreatePermitDto(user, rawDto);
    const tenantId = this.requireTenant(user);
    const formResponses = dto.formResponses ? await this.resolveFormResponses(tenantId, dto.formResponses) : [];

    const created = await this.db.transaction(async (tx) => {
      const [permit] = await tx
        .insert(permits)
        .values({
          tenantId,
          formResponses,
          status: 'draft',
          permitTypeId: dto.permitTypeId,
          title: dto.title,
          workScope: dto.workScope,
          plantId: dto.plantId,
          departmentId: dto.departmentId,
          locationId: dto.locationId,
          workstationId: dto.workstationId,
          machineryId: dto.machineryId,
          lototoRequired: dto.lototoRequired ?? false,
          gasTestingRequired: dto.gasTestingRequired ?? false,
          plannedStartAt: dto.plannedStartAt,
          plannedEndAt: dto.plannedEndAt,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      const [draft] = await tx
        .insert(permitDrafts)
        .values({
          permitId: permit.id,
          currentStep: dto.currentStep ?? 0,
          formSnapshot: dto.formSnapshot,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.insertRelations(tx, permit.id, user.id, tenantId, dto.machineryId, dto.workstationId, dto);

      await this.auditService.log({
        action: 'permit.created',
        entityType: 'permit',
        entityId: permit.id,
        userId: user.id,
        tenantId,
        metadata: { status: 'draft' },
      });

      this.permitLogService.logEvent({
        action: 'permit.created',
        permitId: permit.id,
        tenantId,
        userId: user.id,
        metadata: { status: 'draft' },
      });

      await this.permitCacheService.invalidateTenant(tenantId);

      const detail = await this.loadDetail(tx, permit.id, tenantId);
      return { ...detail, draft };
    });
    await this.notifyAssignedExecutors(created, tenantId, new Set());
    return created;
  }

  async findAll(
    user: AuthenticatedUser,
    status?: string,
  ): Promise<(typeof permits.$inferSelect)[]> {
    const tenantId = this.requireTenant(user);

    const cached = await this.permitCacheService.getPermitList<(typeof permits.$inferSelect)[]>(
      `${tenantId}:${user.id}`,
      status,
    );
    if (cached) {
      return cached;
    }

    const conditions = [eq(permits.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(permits.status, status));
    }

    const visibility = await visiblePermitFilter(this.db, user, tenantId);
    if (visibility) {
      conditions.push(visibility);
    }

    const isExecutorOnly =
      PERMIT_EXECUTOR_DRAFT_ROLES.some((role) => user.roles.includes(role)) &&
      !PERMIT_CREATE_ROLES.some((role) => user.roles.includes(role));

    let results: (typeof permits.$inferSelect)[];

    if (isExecutorOnly && status === 'draft') {
      const rows = await this.db
        .select({ permit: permits })
        .from(permits)
        .innerJoin(permitExecutors, eq(permitExecutors.permitId, permits.id))
        .where(
          and(
            eq(permits.tenantId, tenantId),
            eq(permits.status, 'draft'),
            eq(permitExecutors.workforceUserId, user.id),
          ),
        )
        .orderBy(desc(permits.updatedAt));
      results = rows.map((row) => row.permit);
    } else {
      results = await this.db
        .select()
        .from(permits)
        .where(and(...conditions))
        .orderBy(desc(permits.createdAt));
    }

    await this.permitCacheService.setPermitList(`${tenantId}:${user.id}`, status, results);
    return results;
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);

    const cached = await this.permitCacheService.getPermitDetail(tenantId, id);
    if (cached) {
      await assertPermitVisible(this.db, user, cached);
      return cached;
    }

    const detail = await this.loadDetail(this.db, id, tenantId);
    await assertPermitVisible(this.db, user, detail);
    await this.permitCacheService.setPermitDetail(tenantId, id, detail);
    return detail;
  }

  async removeDraft(id: string, user: AuthenticatedUser): Promise<{ id: string; deleted: boolean }> {
    const tenantId = this.requireTenant(user);
    const detail = await this.loadDetail(this.db, id, tenantId);

    if (detail.permit.status !== 'draft') {
      throw new ConflictException('Only draft permits can be deleted');
    }

    await this.db.delete(permits).where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));

    await this.auditService.log({
      action: 'permit.deleted',
      entityType: 'permit',
      entityId: id,
      userId: user.id,
      tenantId,
      metadata: { status: 'draft', title: detail.permit.title },
    });

    await this.permitCacheService.invalidatePermit(tenantId, id);
    this.permitLogService.logEvent({
      action: 'permit.deleted',
      permitId: id,
      tenantId,
      userId: user.id,
    });

    return { id, deleted: true };
  }

  async update(
    id: string,
    rawDto: UpdatePermitDto,
    user: AuthenticatedUser,
  ): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);
    const existing = await this.loadDetail(this.db, id, tenantId);

    if (!isEditablePermitStatus(existing.permit.status)) {
      throw new ConflictException('Only draft, deferred or rejected permits can be updated');
    }

    const dto = sanitizeDraftUpdateDto(user, rawDto);
    assertDraftUpdateAllowed(user, existing, dto);
    if (
      isLototoFrozen(existing.lototo) &&
      (dto.lototo !== undefined ||
        dto.lototoRequired !== undefined ||
        (dto.machineryId !== undefined && dto.machineryId !== existing.permit.machineryId))
    ) {
      assertLototoWritable(existing.lototo);
    }

    const previousExecutorIds = new Set(existing.executors.map((row) => row.workforceUserId));
    const formResponses =
      dto.formResponses !== undefined ? await this.resolveFormResponses(tenantId, dto.formResponses) : undefined;
    const updated = await this.db.transaction(async (tx) => {
      const permitUpdates: Partial<typeof permits.$inferInsert> = {
        updatedBy: user.id,
      };
      if (formResponses !== undefined) permitUpdates.formResponses = formResponses;

      if (dto.permitTypeId !== undefined) permitUpdates.permitTypeId = dto.permitTypeId;
      if (dto.title !== undefined) permitUpdates.title = dto.title;
      if (dto.workScope !== undefined) permitUpdates.workScope = dto.workScope;
      if (dto.plantId !== undefined) permitUpdates.plantId = dto.plantId;
      if (dto.departmentId !== undefined) permitUpdates.departmentId = dto.departmentId;
      if (dto.locationId !== undefined) permitUpdates.locationId = dto.locationId;
      if (dto.workstationId !== undefined) permitUpdates.workstationId = dto.workstationId;
      if (dto.machineryId !== undefined) permitUpdates.machineryId = dto.machineryId;
      if (dto.lototoRequired !== undefined) permitUpdates.lototoRequired = dto.lototoRequired;
      if (dto.gasTestingRequired !== undefined) permitUpdates.gasTestingRequired = dto.gasTestingRequired;
      if (dto.plannedStartAt !== undefined) permitUpdates.plannedStartAt = dto.plannedStartAt;
      if (dto.plannedEndAt !== undefined) permitUpdates.plannedEndAt = dto.plannedEndAt;

      if (Object.keys(permitUpdates).length > 1) {
        await tx
          .update(permits)
          .set(permitUpdates)
          .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));
      }

      if (dto.currentStep !== undefined || dto.formSnapshot !== undefined) {
        await tx
          .update(permitDrafts)
          .set({
            ...(dto.currentStep !== undefined ? { currentStep: dto.currentStep } : {}),
            ...(dto.formSnapshot !== undefined ? { formSnapshot: dto.formSnapshot } : {}),
            lastAutosavedAt: new Date(),
            updatedBy: user.id,
          })
          .where(eq(permitDrafts.permitId, id));
      }

      if (dto.hazards !== undefined) {
        await tx.delete(permitHazards).where(eq(permitHazards.permitId, id));
        if (dto.hazards.length > 0) {
          await this.insertHazards(tx, id, user.id, dto.hazards);
        }
      }

      if (dto.ppe !== undefined) {
        await tx.delete(permitPpe).where(eq(permitPpe.permitId, id));
        if (dto.ppe.length > 0) {
          await this.insertPpe(tx, id, user.id, dto.ppe);
        }
      }

      if (dto.lototo !== undefined) {
        await this.replaceLototo(
          tx,
          id,
          user.id,
          tenantId,
          dto.machineryId !== undefined ? dto.machineryId : existing.permit.machineryId,
          dto.lototo,
        );
      } else if (
        dto.machineryId !== undefined &&
        dto.machineryId !== existing.permit.machineryId
      ) {
        await this.replaceLototo(tx, id, user.id, tenantId, dto.machineryId, []);
      }

      if (dto.gasTesting !== undefined) {
        await tx.delete(permitGasTesting).where(eq(permitGasTesting.permitId, id));
        if (dto.gasTesting.length > 0) {
          await this.insertGasTesting(
            tx,
            id,
            user.id,
            tenantId,
            dto.workstationId !== undefined ? dto.workstationId : existing.permit.workstationId,
            dto.gasTesting,
          );
        }
      } else if (
        dto.workstationId !== undefined &&
        dto.workstationId !== existing.permit.workstationId
      ) {
        await tx.delete(permitGasTesting).where(eq(permitGasTesting.permitId, id));
      }

      if (dto.executors !== undefined) {
        await tx.delete(permitExecutors).where(eq(permitExecutors.permitId, id));
        if (dto.executors.length > 0) {
          await this.insertExecutors(tx, id, user.id, dto.executors);
        }
      }

      if (dto.viewers !== undefined) {
        await tx.delete(permitViewers).where(eq(permitViewers.permitId, id));
        if (dto.viewers.length > 0) {
          await this.insertAssignees(tx, permitViewers, id, user.id, dto.viewers);
        }
      }

      if (dto.safetyOfficers !== undefined) {
        await tx.delete(permitSafetyOfficers).where(eq(permitSafetyOfficers.permitId, id));
        if (dto.safetyOfficers.length > 0) {
          await this.insertAssignees(tx, permitSafetyOfficers, id, user.id, dto.safetyOfficers);
        }
      }

      await this.auditService.log({
        action: 'permit.updated',
        entityType: 'permit',
        entityId: id,
        userId: user.id,
        tenantId,
        metadata: { status: 'draft' },
      });

      this.permitLogService.logEvent({
        action: 'permit.updated',
        permitId: id,
        tenantId,
        userId: user.id,
        metadata: { status: 'draft' },
      });

      await this.permitCacheService.invalidatePermit(tenantId, id);

      return this.loadDetail(tx, id, tenantId);
    });
    if (dto.executors !== undefined) {
      await this.notifyAssignedExecutors(updated, tenantId, previousExecutorIds);
    }
    return updated;
  }

  async reassignPeople(id: string, dto: ReassignPermitPeopleDto, user: AuthenticatedUser): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);
    const existing = await this.loadDetail(this.db, id, tenantId);
    assertPeopleReassignAllowed(user, existing, dto.executors !== undefined);

    if (!dto.executors && !dto.lototo) {
      throw new BadRequestException('Nothing to reassign');
    }

    const previousExecutorIds = new Set(existing.executors.map((row) => row.workforceUserId));
    const updated = await this.db.transaction(async (tx) => {
      if (dto.executors) {
        await tx.delete(permitExecutors).where(eq(permitExecutors.permitId, id));
        await this.insertExecutors(tx, id, user.id, dto.executors);
      }
      if (dto.lototo) {
        for (const item of dto.lototo) {
          const instance = existing.lototo.find((row) => row.procedureId === item.procedureId);
          if (!instance) {
            throw new BadRequestException('LOTOTO procedure is not attached to this permit');
          }
          await tx.delete(permitLototoCrew).where(eq(permitLototoCrew.instanceId, instance.id));
          await tx.delete(permitLototoVerifiers).where(eq(permitLototoVerifiers.instanceId, instance.id));
          await tx.insert(permitLototoCrew).values(
            item.crew.map((row) => ({
              instanceId: instance.id,
              workforceUserId: row.workforceUserId,
              createdBy: user.id,
              updatedBy: user.id,
            })),
          );
          await tx.insert(permitLototoVerifiers).values(
            item.verifiers.map((row) => ({
              instanceId: instance.id,
              workforceUserId: row.workforceUserId,
              createdBy: user.id,
              updatedBy: user.id,
            })),
          );
        }
      }
      await this.auditService.log({
        action: 'permit.people.reassigned',
        entityType: 'permit',
        entityId: id,
        userId: user.id,
        tenantId,
        metadata: { status: existing.permit.status },
      });
      await this.permitCacheService.invalidatePermit(tenantId, id);
      return this.loadDetail(tx, id, tenantId);
    });
    if (dto.executors) {
      await this.notifyAssignedExecutors(updated, tenantId, previousExecutorIds);
    }
    return updated;
  }

  async submit(id: string, user: AuthenticatedUser): Promise<PermitDetail> {
    assertPermitSubmitAllowed(user);
    const tenantId = this.requireTenant(user);
    const detail = await this.loadDetail(this.db, id, tenantId);

    if (!isSubmittablePermitStatus(detail.permit.status)) {
      throw new ConflictException('Permit cannot be submitted in its current status');
    }

    const applicable = await this.db
      .select({ id: permitTemplates.id, name: permitTemplates.name, config: permitTemplates.config })
      .from(permitTemplates)
      .where(
        and(
          eq(permitTemplates.tenantId, tenantId),
          eq(permitTemplates.status, 'published'),
          or(
            eq(permitTemplates.appliesToAllTypes, true),
            arrayContains(permitTemplates.permitTypeIds, [detail.permit.permitTypeId]),
          ),
        ),
      );
    this.validationService.validateForSubmit(
      detail,
      missingFormAnswers(applicable, detail.permit.formResponses as PermitFormResponse[]),
    );

    const isResubmit = detail.permit.status === 'deferred' || detail.permit.status === 'rejected';
    const reference =
      detail.permit.reference ?? (await generatePermitReference(this.db, tenantId));
    const submittedAt = new Date();
    const fromStatus = detail.permit.status;

    await this.db.transaction(async (tx) => {
      await tx
        .update(permits)
        .set({
          status: 'pending_approval',
          reference,
          submittedAt,
          submittedBy: user.id,
          updatedBy: user.id,
        })
        .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));

      await this.approvalHistoryService.record(
        {
          permitId: id,
          action: isResubmit ? 'resubmitted' : 'submitted',
          fromStatus,
          toStatus: 'pending_approval',
          actorId: user.id,
          createdBy: user.id,
        },
        tx,
      );

      await this.workflowEngine.initializeAtSubmit(
        id,
        tenantId,
        detail.permit.permitTypeId,
        user.id,
        tx,
      );
    });

    await this.auditService.log({
      action: isResubmit ? 'permit.resubmitted' : 'permit.submitted',
      entityType: 'permit',
      entityId: id,
      userId: user.id,
      tenantId,
      metadata: { reference, status: 'pending_approval', fromStatus },
    });

    this.permitLogService.logEvent({
      action: isResubmit ? 'permit.resubmitted' : 'permit.submitted',
      permitId: id,
      tenantId,
      userId: user.id,
      metadata: { reference, status: 'pending_approval', fromStatus },
    });

    await this.permitCacheService.invalidatePermit(tenantId, id);

    // Tells the first approvers (usually the department HOD) the permit is waiting for them.
    await this.approvalNotifications.enqueueApprovalNotification({
      permitId: id,
      tenantId,
      action: isResubmit ? 'resubmitted' : 'submitted',
      actorId: user.id,
      metadata: { submittedAt: new Date().toISOString() },
    });

    await this.simopsService.syncOnSubmit(id, user);

    return this.loadDetail(this.db, id, tenantId);
  }

  /** FR-MDP-009: copy an expired permit into a new draft for issuer-led renewal. */
  async renewFromExpired(
    sourceId: string,
    dto: RenewPermitDto,
    user: AuthenticatedUser,
  ): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);
    const source = await this.loadDetail(this.db, sourceId, tenantId);

    if (source.permit.status !== 'expired') {
      throw new ConflictException('Only expired permits can be renewed');
    }

    if (!user.roles.includes('job-issuer') && source.permit.submittedBy !== user.id) {
      throw new ForbiddenException('Only the original issuer can renew this permit');
    }

    return this.db.transaction(async (tx) => {
      const [renewal] = await tx
        .insert(permits)
        .values({
          tenantId,
          status: 'draft',
          permitTypeId: source.permit.permitTypeId,
          title: source.permit.title,
          workScope: source.permit.workScope,
          plantId: source.permit.plantId,
          departmentId: source.permit.departmentId,
          locationId: source.permit.locationId,
          workstationId: source.permit.workstationId,
          machineryId: source.permit.machineryId,
          lototoRequired: source.permit.lototoRequired,
          gasTestingRequired: source.permit.gasTestingRequired,
          plannedStartAt: dto.plannedStartAt
            ? new Date(dto.plannedStartAt)
            : source.permit.plannedStartAt,
          plannedEndAt: dto.plannedEndAt
            ? new Date(dto.plannedEndAt)
            : source.permit.plannedEndAt,
          renewedFromPermitId: source.permit.id,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      if (source.draft) {
        await tx.insert(permitDrafts).values({
          permitId: renewal.id,
          currentStep: source.draft.currentStep,
          formSnapshot: source.draft.formSnapshot,
          createdBy: user.id,
          updatedBy: user.id,
        });
      }

      if (source.hazards.length > 0) {
        await tx.insert(permitHazards).values(
          source.hazards.map((hazard) => ({
            permitId: renewal.id,
            hazardCategoryId: hazard.hazardCategoryId,
            extraConsequences: hazard.extraConsequences ?? [],
            extraControls: hazard.extraControls ?? [],
            createdBy: user.id,
            updatedBy: user.id,
          })),
        );
      }

      if (source.ppe.length > 0) {
        await tx.insert(permitPpe).values(
          source.ppe.map((item) => ({
            permitId: renewal.id,
            ppeCatalogueId: item.ppeCatalogueId,
            quantity: item.quantity,
            createdBy: user.id,
            updatedBy: user.id,
          })),
        );
      }

      if (source.lototo.length > 0) {
        await this.replaceLototo(
          tx,
          renewal.id,
          user.id,
          tenantId,
          source.permit.machineryId,
          source.lototo.map((item) => ({
            procedureId: item.procedureId,
            extraPoints: item.extraPoints.map((point) => ({
              pointCode: point.pointCode,
              energyType: point.energyType,
              magnitude: point.magnitude ?? undefined,
              locationText: point.locationText ?? undefined,
              action: point.action ?? undefined,
              device: point.device ?? undefined,
              verificationMethod: point.verificationMethod ?? undefined,
            })),
            stepNa: item.stepNa.map((row) => ({
              basePointId: row.basePointId ?? undefined,
              extraPointCode: row.extraPointCode ?? undefined,
              reason: row.reason,
            })),
            crew: item.crew,
            verifiers: item.verifiers,
          })),
        );
      }

      if (source.gasTesting.length > 0) {
        await tx.insert(permitGasTesting).values(
          source.gasTesting.map((item) => ({
            permitId: renewal.id,
            gasTestingCatalogueId: item.gasTestingCatalogueId,
            workstationId: item.workstationId,
            parameter: item.parameter,
            unit: item.unit,
            minimum: item.minimum,
            maximum: item.maximum,
            createdBy: user.id,
            updatedBy: user.id,
          })),
        );
      }

      if (source.executors.length > 0) {
        await tx.insert(permitExecutors).values(
          source.executors.map((executor) => ({
            permitId: renewal.id,
            workforceUserId: executor.workforceUserId,
            isPrimary: executor.isPrimary,
            createdBy: user.id,
            updatedBy: user.id,
          })),
        );
      }

      await tx.insert(revalidationHistory).values({
        tenantId,
        permitId: source.permit.id,
        eventType: 'renewal_initiated',
        actorId: user.id,
        payload: {
          renewalPermitId: renewal.id,
          reference: source.permit.reference,
        },
        createdBy: user.id,
      });

      await this.auditService.log({
        action: 'permit.renewal_initiated',
        entityType: 'permit',
        entityId: renewal.id,
        userId: user.id,
        tenantId,
        metadata: { sourcePermitId: source.permit.id },
      });

      this.permitLogService.logEvent({
        action: 'permit.renewal_initiated',
        permitId: renewal.id,
        tenantId,
        userId: user.id,
        metadata: { sourcePermitId: source.permit.id },
      });

      await this.permitCacheService.invalidateTenant(tenantId);

      return this.loadDetail(tx, renewal.id, tenantId);
    });
  }

  private async loadDetail(
    db: Pick<Database, 'select' | 'query'>,
    id: string,
    tenantId: string,
  ): Promise<PermitDetail> {
    const [permit] = await db
      .select()
      .from(permits)
      .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    const [draft] = await db
      .select()
      .from(permitDrafts)
      .where(eq(permitDrafts.permitId, id));

    const hazards = await db
      .select()
      .from(permitHazards)
      .where(eq(permitHazards.permitId, id));

    const ppe = await db.select().from(permitPpe).where(eq(permitPpe.permitId, id));
    const lototo = await this.loadLototoAttachments(db, id);
    const gasTesting = await db
      .select()
      .from(permitGasTesting)
      .where(eq(permitGasTesting.permitId, id));

    const executors = await db
      .select()
      .from(permitExecutors)
      .where(eq(permitExecutors.permitId, id));

    const viewers = await db.select().from(permitViewers).where(eq(permitViewers.permitId, id));
    const safetyOfficers = await db
      .select()
      .from(permitSafetyOfficers)
      .where(eq(permitSafetyOfficers.permitId, id));

    const attachments = await db
      .select()
      .from(permitAttachments)
      .where(eq(permitAttachments.permitId, id));

    return {
      permit,
      draft: draft ?? null,
      hazards,
      ppe,
      lototo,
      gasTesting,
      executors,
      viewers,
      safetyOfficers,
      attachments,
    };
  }

  private async insertRelations(
    db: Pick<Database, 'insert' | 'select' | 'delete'>,
    permitId: string,
    userId: string,
    tenantId: string,
    machineryId: string | null | undefined,
    workstationId: string | null | undefined,
    dto: CreatePermitDto | UpdatePermitDto,
  ): Promise<void> {
    if (dto.hazards?.length) {
      await this.insertHazards(db, permitId, userId, dto.hazards);
    }
    if (dto.ppe?.length) {
      await this.insertPpe(db, permitId, userId, dto.ppe);
    }
    if (dto.lototo?.length) {
      await this.replaceLototo(db, permitId, userId, tenantId, machineryId, dto.lototo);
    }
    if (dto.gasTesting?.length) {
      await this.insertGasTesting(db, permitId, userId, tenantId, workstationId, dto.gasTesting);
    }
    if (dto.executors?.length) {
      await this.insertExecutors(db, permitId, userId, dto.executors);
    }
    if (dto.viewers?.length) {
      await this.insertAssignees(db, permitViewers, permitId, userId, dto.viewers);
    }
    if (dto.safetyOfficers?.length) {
      await this.insertAssignees(db, permitSafetyOfficers, permitId, userId, dto.safetyOfficers);
    }
  }

  private async insertHazards(
    db: Pick<Database, 'insert'>,
    permitId: string,
    userId: string,
    hazards: NonNullable<CreatePermitDto['hazards']>,
  ): Promise<void> {
    if (hazards.length === 0) {
      return;
    }

    await db.insert(permitHazards).values(
      hazards.map((hazard) => ({
        permitId,
        hazardCategoryId: hazard.hazardCategoryId,
        extraConsequences: (hazard.extraConsequences ?? []).map((value) => value.trim()).filter(Boolean),
        extraControls: (hazard.extraControls ?? []).map((value) => value.trim()).filter(Boolean),
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  private async insertPpe(
    db: Pick<Database, 'insert'>,
    permitId: string,
    userId: string,
    ppeItems: NonNullable<CreatePermitDto['ppe']>,
  ): Promise<void> {
    if (ppeItems.length === 0) {
      return;
    }

    await db.insert(permitPpe).values(
      ppeItems.map((item) => ({
        permitId,
        ppeCatalogueId: item.ppeCatalogueId,
        quantity: item.quantity ?? 1,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  private async loadLototoAttachments(
    db: Pick<Database, 'select'>,
    permitId: string,
  ): Promise<PermitLototoDetail[]> {
    const instances = await db
      .select()
      .from(permitLototoInstances)
      .where(eq(permitLototoInstances.permitId, permitId));
    if (instances.length === 0) {
      return [];
    }

    const instanceIds = instances.map((row) => row.id);
    const extras = await db
      .select()
      .from(permitLototoExtraPoints)
      .where(inArray(permitLototoExtraPoints.instanceId, instanceIds));
    const stepNa = await db
      .select()
      .from(permitLototoStepNa)
      .where(inArray(permitLototoStepNa.instanceId, instanceIds));
    const crew = await db
      .select()
      .from(permitLototoCrew)
      .where(inArray(permitLototoCrew.instanceId, instanceIds));
    const verifiers = await db
      .select()
      .from(permitLototoVerifiers)
      .where(inArray(permitLototoVerifiers.instanceId, instanceIds));

    const extrasByInstance = new Map<string, typeof extras>();
    for (const extra of extras) {
      const list = extrasByInstance.get(extra.instanceId) ?? [];
      list.push(extra);
      extrasByInstance.set(extra.instanceId, list);
    }
    const extraById = new Map(extras.map((row) => [row.id, row]));

    return instances.map((instance) => ({
      id: instance.id,
      procedureId: instance.procedureId,
      procedureVersionId: instance.procedureVersionId,
      frozenAt: instance.frozenAt,
      extraPoints: extrasByInstance.get(instance.id) ?? [],
      stepNa: stepNa
        .filter((row) => row.instanceId === instance.id)
        .map((row) => ({
          basePointId: row.basePointId,
          extraPointId: row.extraPointId,
          extraPointCode: row.extraPointId ? extraById.get(row.extraPointId)?.pointCode ?? null : null,
          reason: row.reason,
        })),
      crew: crew
        .filter((row) => row.instanceId === instance.id)
        .map((row) => ({ workforceUserId: row.workforceUserId })),
      verifiers: verifiers
        .filter((row) => row.instanceId === instance.id)
        .map((row) => ({ workforceUserId: row.workforceUserId })),
    }));
  }

  private async replaceLototo(
    db: Pick<Database, 'insert' | 'select' | 'delete'>,
    permitId: string,
    userId: string,
    tenantId: string,
    machineryId: string | null | undefined,
    lototoItems: PermitLototoDto[],
  ): Promise<void> {
    const existing = await db
      .select({ frozenAt: permitLototoInstances.frozenAt })
      .from(permitLototoInstances)
      .where(eq(permitLototoInstances.permitId, permitId));
    assertLototoWritable(existing);

    await db.delete(permitLototo).where(eq(permitLototo.permitId, permitId));
    await db.delete(permitLototoInstances).where(eq(permitLototoInstances.permitId, permitId));
    if (lototoItems.length === 0) {
      return;
    }
    if (!machineryId) {
      throw new BadRequestException('Machinery is required when attaching LOTOTO procedures');
    }

    const ids = [...new Set(lototoItems.map((item) => item.procedureId))];
    if (ids.length !== lototoItems.length) {
      throw new BadRequestException('Each LOTOTO procedure can only be attached once');
    }

    const rows = await db
      .select({
        id: lototoProcedures.id,
        machineryId: lototoProcedures.machineryId,
        publishedVersionId: lototoProcedures.publishedVersionId,
        status: lototoProcedures.status,
      })
      .from(lototoProcedures)
      .where(and(eq(lototoProcedures.tenantId, tenantId), inArray(lototoProcedures.id, ids)));

    if (rows.length !== ids.length) {
      throw new BadRequestException('One or more LOTOTO procedures were not found');
    }
    if (rows.some((row) => row.machineryId !== machineryId)) {
      throw new BadRequestException('LOTOTO procedures must belong to the selected machinery');
    }
    if (rows.some((row) => row.status !== 'published' || !row.publishedVersionId)) {
      throw new BadRequestException('Only published LOTOTO procedures can be attached');
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    const versionIds = rows.map((row) => row.publishedVersionId!);
    const basePoints = await db
      .select({
        id: lototoProcedureLockoutPoints.id,
        versionId: lototoProcedureLockoutPoints.versionId,
      })
      .from(lototoProcedureLockoutPoints)
      .where(inArray(lototoProcedureLockoutPoints.versionId, versionIds));
    const basePointIds = new Set(basePoints.map((point) => point.id));

    for (const item of lototoItems) {
      const procedure = byId.get(item.procedureId)!;
      const [instance] = await db
        .insert(permitLototoInstances)
        .values({
          permitId,
          procedureId: procedure.id,
          procedureVersionId: procedure.publishedVersionId!,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const extraPoints = (item.extraPoints ?? []).filter((point) => point.pointCode.trim());
      const extraByCode = new Map<string, string>();
      for (const [index, point] of extraPoints.entries()) {
        if (!point.energyType.trim()) {
          throw new BadRequestException('Extra isolation points need an energy type');
        }
        const [extra] = await db
          .insert(permitLototoExtraPoints)
          .values({
            instanceId: instance.id,
            sortOrder: index,
            pointCode: point.pointCode.trim(),
            energyType: point.energyType.trim(),
            magnitude: point.magnitude,
            locationText: point.locationText,
            action: point.action,
            device: point.device,
            verificationMethod: point.verificationMethod,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning();
        extraByCode.set(extra.pointCode, extra.id);
      }

      for (const na of item.stepNa ?? []) {
        if (!na.reason.trim()) {
          throw new BadRequestException('N/A isolation steps require a reason');
        }
        const hasBase = Boolean(na.basePointId);
        const extraCode = na.extraPointCode?.trim();
        if (hasBase === Boolean(extraCode)) {
          throw new BadRequestException('Each N/A step must target either a base point or an extra point');
        }
        if (na.basePointId && !basePointIds.has(na.basePointId)) {
          throw new BadRequestException('N/A base points must belong to the selected procedure');
        }
        const extraPointId = extraCode ? extraByCode.get(extraCode) : undefined;
        if (extraCode && !extraPointId) {
          throw new BadRequestException('N/A extra points must match an extra isolation point on this permit');
        }
        await db.insert(permitLototoStepNa).values({
          instanceId: instance.id,
          basePointId: na.basePointId,
          extraPointId,
          reason: na.reason.trim(),
          createdBy: userId,
          updatedBy: userId,
        });
      }

      const crewIds = [...new Set((item.crew ?? []).map((row) => row.workforceUserId).filter(Boolean))];
      const verifierIds = [
        ...new Set((item.verifiers ?? []).map((row) => row.workforceUserId).filter(Boolean)),
      ];
      if (crewIds.length > 0) {
        await db.insert(permitLototoCrew).values(
          crewIds.map((workforceUserId) => ({
            instanceId: instance.id,
            workforceUserId,
            createdBy: userId,
            updatedBy: userId,
          })),
        );
      }
      if (verifierIds.length > 0) {
        await db.insert(permitLototoVerifiers).values(
          verifierIds.map((workforceUserId) => ({
            instanceId: instance.id,
            workforceUserId,
            createdBy: userId,
            updatedBy: userId,
          })),
        );
      }
    }
  }

  private async insertGasTesting(
    db: Pick<Database, 'insert' | 'select'>,
    permitId: string,
    userId: string,
    tenantId: string,
    workstationId: string | null | undefined,
    items: NonNullable<CreatePermitDto['gasTesting']>,
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }
    if (!workstationId) {
      throw new BadRequestException('Workstation is required when attaching gas testing items');
    }

    const ids = [...new Set(items.map((item) => item.gasTestingCatalogueId))];
    const rows = await db
      .select()
      .from(gasTestingCatalogue)
      .where(and(eq(gasTestingCatalogue.tenantId, tenantId), inArray(gasTestingCatalogue.id, ids)));

    if (rows.length !== ids.length) {
      throw new BadRequestException('One or more gas testing items were not found');
    }
    if (rows.some((row) => row.workstationId !== workstationId)) {
      throw new BadRequestException('Gas testing items must belong to the selected workstation');
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    await db.insert(permitGasTesting).values(
      items.map((item) => {
        const source = byId.get(item.gasTestingCatalogueId)!;
        return {
          permitId,
          gasTestingCatalogueId: source.id,
          workstationId: source.workstationId,
          parameter: source.parameter,
          unit: source.unit,
          minimum: source.minimum,
          maximum: source.maximum,
          createdBy: userId,
          updatedBy: userId,
        };
      }),
    );
  }

  private async insertExecutors(
    db: Pick<Database, 'insert'>,
    permitId: string,
    userId: string,
    executors: NonNullable<CreatePermitDto['executors']>,
  ): Promise<void> {
    if (executors.length === 0) {
      return;
    }

    await db.insert(permitExecutors).values(
      executors.map((executor) => ({
        permitId,
        workforceUserId: executor.workforceUserId,
        isPrimary: executor.isPrimary ?? false,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  private async insertAssignees(
    db: Pick<Database, 'insert'>,
    table: typeof permitViewers | typeof permitSafetyOfficers,
    permitId: string,
    userId: string,
    rows: Array<{ workforceUserId: string }>,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await db.insert(table).values(
      rows.map((row) => ({
        permitId,
        workforceUserId: row.workforceUserId,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  private async notifyAssignedExecutors(
    detail: PermitDetail,
    tenantId: string,
    previousIds: Set<string>,
  ): Promise<void> {
    const added = detail.executors
      .map((row) => row.workforceUserId)
      .filter((id) => !previousIds.has(id));
    if (added.length === 0) {
      return;
    }

    const recipients = await this.db
      .select({ email: tenantUsers.email, firstName: tenantUsers.firstName })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), inArray(tenantUsers.keycloakUserId, added)));

    const appUrl = (
      this.configService.get<string>('appPublicUrl') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const permitUrl = `${appUrl}/permits/${detail.permit.id}`;
    const title = detail.permit.title;

    await Promise.all(
      recipients
        .filter((row) => row.email)
        .map((row) =>
          this.mailService.send({
            to: row.email,
            subject: `Assigned as executor: ${title}`,
            text: `Hello${row.firstName ? ` ${row.firstName}` : ''},\n\nYou have been assigned as an executor on permit "${title}".\n\nOpen the permit: ${permitUrl}\n\nComplete the on-site details. The job issuer will submit the permit.`,
          }),
        ),
    );
  }

  /** Copies each answered template's current form in with its answers; the template must belong to the tenant. */
  private async resolveFormResponses(
    tenantId: string,
    input: { templateId: string; answers: Record<string, unknown> }[],
  ): Promise<PermitFormResponse[]> {
    if (input.length === 0) return [];
    const templates = await this.db
      .select({ id: permitTemplates.id, name: permitTemplates.name, config: permitTemplates.config })
      .from(permitTemplates)
      .where(
        and(
          eq(permitTemplates.tenantId, tenantId),
          ne(permitTemplates.status, 'archived'),
          inArray(
            permitTemplates.id,
            input.map((response) => response.templateId),
          ),
        ),
      );
    return buildFormResponses(input, templates);
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
