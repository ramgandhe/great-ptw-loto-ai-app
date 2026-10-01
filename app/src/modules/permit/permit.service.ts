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
  auditLogs,
  permitAttachments,
  permitDrafts,
  permitExecutors,
  permitHazards,
  permitPpe,
  permitLototo,
  permitGasTesting,
  permitViewers,
  permitSafetyOfficers,
  permits,
  permitTemplates,
  lototoPlans,
  gasTestingCatalogue,
  revalidationHistory,
  tenantUsers,
} from '../../database/schema';
import { MailService } from '../../infrastructure/mail/mail.service';
import { AuditService } from '../logging/audit.service';
import { ApprovalHistoryService } from '../approval/approval-history.service';
import { NotificationService } from '../approval/notification.service';
import { WorkflowEngineService } from '../approval/workflow-engine.service';
import { CreatePermitDto } from './dto/create-permit.dto';
import {
  applyStageAnswers,
  buildFormResponses,
  diffFormAnswers,
  missingFormAnswers,
  type PermitFormResponse,
} from './permit-forms';
import { RenewPermitDto } from './dto/renew-permit.dto';
import { SaveDraftDto, StageAnswersDto, SubmitPermitDto } from './dto/save-draft.dto';
import { UpdatePermitDto } from './dto/update-permit.dto';
import { isEditablePermitStatus, isSubmittablePermitStatus } from './permit.constants';
import {
  assertDraftUpdateAllowed,
  assertPermitCreateAllowed,
  assertPermitSubmitAllowed,
  sanitizeDraftUpdateDto,
} from './permit-collaboration';
import { assertPermitVisible, visiblePermitFilter } from './permit-access';
import {
  PERMIT_CREATE_ROLES,
  PERMIT_EXECUTOR_DRAFT_ROLES,
} from './permit.constants';
import { PermitCacheService } from './permit-cache.service';
import { PermitLogService } from './permit-log.service';
import { PermitValidationService } from './permit-validation.service';

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export const REVISION_CONFLICT_CODE = 'PERMIT_REVISION_CONFLICT';

/** Refuses a save or submit made against an older copy of the permit (HTTP 409). */
function assertExpectedRevision(detail: PermitDetail, expectedRevision: number): void {
  if (detail.permit.draftRevision !== expectedRevision) {
    // `error` and `details` are what GlobalExceptionFilter passes to the client as code and details.
    throw new ConflictException({
      error: REVISION_CONFLICT_CODE,
      message: 'This permit changed since you opened it. Your changes are still here.',
      details: { currentRevision: detail.permit.draftRevision },
    });
  }
}

/** Refuses a final approval or closure while that stage's required form answers are empty. */
export function assertStageAnswered(missing: string[], action: 'approving' | 'closing'): void {
  if (missing.length) {
    throw new BadRequestException({
      error: 'STAGE_ANSWERS_MISSING',
      message: `Complete these before ${action}: ${missing.join('; ')}`,
      details: { missing },
    });
  }
}

export interface PermitDetail {
  permit: typeof permits.$inferSelect;
  draft: typeof permitDrafts.$inferSelect | null;
  hazards: (typeof permitHazards.$inferSelect)[];
  ppe: (typeof permitPpe.$inferSelect)[];
  lototo: (typeof permitLototo.$inferSelect)[];
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
  ) {}

  async create(dto: CreatePermitDto, user: AuthenticatedUser): Promise<PermitDetail> {
    assertPermitCreateAllowed(user);
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

    // Status is re-checked in the delete itself, so a permit submitted meanwhile is never deleted.
    const deleted = await this.db
      .delete(permits)
      .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId), eq(permits.status, 'draft')))
      .returning({ id: permits.id });
    if (deleted.length === 0) {
      throw new ConflictException('Only draft permits can be deleted');
    }

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
    input: SaveDraftDto,
    user: AuthenticatedUser,
  ): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);
    const { expectedRevision, ...rawDto } = input;
    const dto = sanitizeDraftUpdateDto(user, rawDto);
    const formResponses =
      dto.formResponses !== undefined ? await this.resolveFormResponses(tenantId, dto.formResponses) : undefined;

    let previousExecutorIds = new Set<string>();
    const updated = await this.db.transaction(async (tx) => {
      const existing = await this.loadLockedDetail(tx, id, tenantId);
      if (!isEditablePermitStatus(existing.permit.status)) {
        throw new ConflictException('Only draft, deferred or rejected permits can be updated');
      }
      assertDraftUpdateAllowed(user, existing, dto);
      assertExpectedRevision(existing, expectedRevision);
      previousExecutorIds = new Set(existing.executors.map((row) => row.workforceUserId));
      const revision = existing.permit.draftRevision + 1;

      const permitUpdates: Partial<typeof permits.$inferInsert> = {
        updatedBy: user.id,
        updatedAt: new Date(),
        draftRevision: revision,
      };
      if (formResponses !== undefined) {
        permitUpdates.formResponses = formResponses;
        await this.recordAnswerChanges(tx, existing, formResponses, revision, user.id, tenantId);
      }

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

      await tx
        .update(permits)
        .set(permitUpdates)
        .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));

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
        await tx.delete(permitLototo).where(eq(permitLototo.permitId, id));
        if (dto.lototo.length > 0) {
          await this.insertLototo(
            tx,
            id,
            user.id,
            tenantId,
            dto.machineryId !== undefined ? dto.machineryId : existing.permit.machineryId,
            dto.lototo,
          );
        }
      } else if (
        dto.machineryId !== undefined &&
        dto.machineryId !== existing.permit.machineryId
      ) {
        await tx.delete(permitLototo).where(eq(permitLototo.permitId, id));
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

  async submit(id: string, dto: SubmitPermitDto, user: AuthenticatedUser): Promise<PermitDetail> {
    assertPermitSubmitAllowed(user);
    const tenantId = this.requireTenant(user);

    // One transaction on the locked row: a competing save or a second submit waits, then sees
    // the new revision or status and is refused, so approvals are never initialised twice.
    const { reference, fromStatus, isResubmit } = await this.db.transaction(async (tx) => {
      const detail = await this.loadLockedDetail(tx, id, tenantId);
      if (!isSubmittablePermitStatus(detail.permit.status)) {
        throw new ConflictException('Permit cannot be submitted in its current status');
      }
      assertExpectedRevision(detail, dto.expectedRevision);

      const applicable = await this.applicableTemplates(tx, tenantId, detail.permit.permitTypeId);
      this.validationService.validateForSubmit(
        detail,
        missingFormAnswers(applicable, detail.permit.formResponses as PermitFormResponse[]),
      );

      const fromStatus = detail.permit.status;
      const isResubmit = fromStatus === 'deferred' || fromStatus === 'rejected';
      const reference = detail.permit.reference ?? (await generatePermitReference(tx, tenantId));

      // Bumping the revision here means a tab opened before submit cannot save over the permit
      // after it is rejected or deferred back to an editable status.
      await tx
        .update(permits)
        .set({
          status: 'pending_approval',
          reference,
          submittedAt: new Date(),
          submittedBy: user.id,
          updatedBy: user.id,
          updatedAt: new Date(),
          draftRevision: detail.permit.draftRevision + 1,
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
      return { reference, fromStatus, isResubmit };
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
            description: hazard.description,
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
        await tx.insert(permitLototo).values(
          source.lototo.map((item) => ({
            permitId: renewal.id,
            lototoPlanId: item.lototoPlanId,
            createdBy: user.id,
            updatedBy: user.id,
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

  /**
   * Records the template answers required at approval or closure, in the decision's transaction:
   * locks the permit, checks its status (and the revision when answers are sent), writes the same
   * per-answer audit as a draft save, and returns the stage's required answers still missing.
   * The caller checks the person's role and refuses its decision while answers are missing.
   */
  async saveStageAnswers(
    tx: Transaction,
    params: {
      permitId: string;
      tenantId: string;
      userId: string;
      stage: 'approval' | 'closure';
      status: string;
      input?: StageAnswersDto;
    },
  ): Promise<string[]> {
    const { permitId, tenantId, userId, stage, status, input } = params;
    const detail = await this.loadLockedDetail(tx, permitId, tenantId);
    if (detail.permit.status !== status) {
      throw new ConflictException('This permit moved on since you opened it. Reload to see where it is now.');
    }
    const applicable = await this.applicableTemplates(tx, tenantId, detail.permit.permitTypeId);
    let responses = detail.permit.formResponses as PermitFormResponse[];
    if (input?.formResponses.length) {
      assertExpectedRevision(detail, input.expectedRevision);
      const revision = detail.permit.draftRevision + 1;
      responses = applyStageAnswers(responses, input.formResponses, applicable, stage);
      await this.recordAnswerChanges(tx, detail, responses, revision, userId, tenantId);
      await tx
        .update(permits)
        .set({ formResponses: responses, draftRevision: revision, updatedBy: userId, updatedAt: new Date() })
        .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));
    }
    // The form copied onto the permit decides which fields belong to this stage.
    const forms = applicable.map((template) => ({
      ...template,
      config: responses.find((response) => response.templateId === template.id)?.config ?? template.config,
    }));
    return missingFormAnswers(forms, responses, stage);
  }

  private applicableTemplates(db: Pick<Database, 'select'>, tenantId: string, permitTypeId: string) {
    return db
      .select({ id: permitTemplates.id, name: permitTemplates.name, config: permitTemplates.config })
      .from(permitTemplates)
      .where(
        and(
          eq(permitTemplates.tenantId, tenantId),
          eq(permitTemplates.status, 'published'),
          or(eq(permitTemplates.appliesToAllTypes, true), arrayContains(permitTemplates.permitTypeIds, [permitTypeId])),
        ),
      );
  }

  /** Locks the tenant's permit row for the rest of the transaction, then loads it. */
  private async loadLockedDetail(tx: Transaction, id: string, tenantId: string): Promise<PermitDetail> {
    await tx
      .select({ id: permits.id })
      .from(permits)
      .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)))
      .for('update');
    return this.loadDetail(tx, id, tenantId);
  }

  /**
   * One audit row per changed form answer, written in the save's transaction: if the audit
   * insert fails, the answers are not saved either. Actor and time come from the server.
   */
  private async recordAnswerChanges(
    tx: Transaction,
    existing: PermitDetail,
    formResponses: PermitFormResponse[],
    revision: number,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const changes = diffFormAnswers(existing.permit.formResponses as PermitFormResponse[], formResponses);
    if (changes.length === 0) return;
    await tx.insert(auditLogs).values(
      changes.map((change) => ({
        action: 'permit.form_answer_changed',
        entityType: 'permit',
        entityId: existing.permit.id,
        userId,
        tenantId,
        metadata: { revision, ...change },
        createdBy: userId,
      })),
    );
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
    const lototo = await db.select().from(permitLototo).where(eq(permitLototo.permitId, id));
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
    db: Pick<Database, 'insert' | 'select'>,
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
      await this.insertLototo(db, permitId, userId, tenantId, machineryId, dto.lototo);
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
        description: hazard.description,
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

  private async insertLototo(
    db: Pick<Database, 'insert' | 'select'>,
    permitId: string,
    userId: string,
    tenantId: string,
    machineryId: string | null | undefined,
    lototoItems: NonNullable<CreatePermitDto['lototo']>,
  ): Promise<void> {
    if (lototoItems.length === 0) {
      return;
    }
    if (!machineryId) {
      throw new BadRequestException('Machinery is required when attaching LOTOTO procedures');
    }

    const ids = [...new Set(lototoItems.map((item) => item.lototoPlanId))];
    const rows = await db
      .select({ id: lototoPlans.id, machineryId: lototoPlans.machineryId })
      .from(lototoPlans)
      .where(and(eq(lototoPlans.tenantId, tenantId), inArray(lototoPlans.id, ids)));

    if (rows.length !== ids.length) {
      throw new BadRequestException('One or more LOTOTO procedures were not found');
    }
    if (rows.some((row) => row.machineryId !== machineryId)) {
      throw new BadRequestException('LOTOTO procedures must belong to the selected machinery');
    }

    await db.insert(permitLototo).values(
      lototoItems.map((item) => ({
        permitId,
        lototoPlanId: item.lototoPlanId,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
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
