import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  forwardRef,
  Optional,
  UnprocessableEntityException,
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
  permitLototoCrew,
  permitLototoExtraPoints,
  permitLototoInstances,
  permitLototoStepNa,
  permitLototoVerifiers,
  permitLototoVerificationRuns,
  permitAssets,
  permitGasTesting,
  permitViewers,
  permitSafetyOfficers,
  permits,
  permitTemplates,
  lototoProcedureLockoutPoints,
  lototoProcedures,
  gasTestingCatalogue,
  assets,
  siteMembers,
  sites,
  workLocations,
  hazardCategories,
  permitTypes,
  revalidationHistory,
  tenantUsers,
} from '../../database/schema';
import { allowedEnergyCodes } from '../lototo/energy-source-codes';
import { hazardFitsPermitType } from '../master-data/default-hazards';
import { limitIsLooser } from '../master-data/gas-test-defaults';
import { GasTestingService } from '../master-data/gas-testing.service';
import { descendantIds } from '../place/place-rules';
import { MailService } from '../../infrastructure/mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  holderNextWork,
  holderStageLabel,
  nextHandoffTarget,
  parseDraftHolder,
  returnHandoffTarget,
  type DraftHolder,
} from './permit-draft-handoff';
import { isAssignedSafetyOfficer } from './permit-access';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import { ApprovalHistoryService } from '../approval/approval-history.service';
import { SimopsService } from '../simops/simops.service';
import { NotificationService } from '../approval/notification.service';
import { WorkflowEngineService } from '../approval/workflow-engine.service';
import { CreatePermitDto } from './dto/create-permit.dto';
import {
  applyStageAnswers,
  buildFormResponses,
  diffFormAnswers,
  formsToCheck,
  keepLaterStageAnswers,
  missingFormAnswers,
  type PermitFormResponse,
} from './permit-forms';
import { RenewPermitDto } from './dto/renew-permit.dto';
import { SaveDraftDto, StageAnswersDto, SubmitPermitDto } from './dto/save-draft.dto';
import { UpdatePermitDto } from './dto/update-permit.dto';
import { isEditablePermitStatus, isSubmittablePermitStatus } from './permit.constants';
import {
  assertDraftUpdateAllowed,
  assertPeopleReassignAllowed,
  assertPermitSegregationOfDuties,
  assertPermitCreateAllowed,
  assertPermitSubmitAllowed,
  sanitizeCreatePermitDto,
  sanitizeDraftUpdateDto,
  isAssignedExecutor,
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
import { resetStageAnswers } from './stage-reset';

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
  verification: Array<{
    phase: string;
    result: string | null;
    signedName: string | null;
    verifiedAt: Date | null;
  }>;
};

export interface PermitDetail {
  permit: typeof permits.$inferSelect;
  draft: typeof permitDrafts.$inferSelect | null;
  hazards: (typeof permitHazards.$inferSelect)[];
  ppe: (typeof permitPpe.$inferSelect)[];
  lototo: PermitLototoDetail[];
  gasTesting: (typeof permitGasTesting.$inferSelect)[];
  assets: (typeof permitAssets.$inferSelect)[];
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
    // Optional so specs that build the service by hand need not provide storage.
    @Optional() private readonly storageService?: StorageService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly gasTestingService?: GasTestingService,
  ) {}

  async create(rawDto: CreatePermitDto, user: AuthenticatedUser): Promise<PermitDetail> {
    assertPermitCreateAllowed(user);
    const dto = sanitizeCreatePermitDto(user, rawDto);
    const tenantId = this.requireTenant(user);
    // A new permit has no approval or closure signatures; only those decisions record them.
    const formResponses = dto.formResponses ? keepLaterStageAnswers([], await this.resolveFormResponses(tenantId, dto.formResponses)) : [];

    const created = await this.db.transaction(async (tx) => {
      const place =
        dto.siteId || dto.workLocationId
          ? await this.resolvePermitPlace(tx, tenantId, user, dto.siteId ?? null, dto.workLocationId ?? null)
          : { siteId: null, workLocationId: null, placePath: null };
      const [permit] = await tx
        .insert(permits)
        .values({
          tenantId,
          formResponses,
          status: 'draft',
          permitTypeId: dto.permitTypeId,
          title: dto.title,
          workScope: dto.workScope,
          emergencyPhone: dto.emergencyPhone?.trim() || null,
          plantId: dto.plantId,
          departmentId: dto.departmentId,
          locationId: dto.locationId,
          workstationId: dto.workstationId,
          machineryId: dto.machineryId,
          siteId: place.siteId,
          workLocationId: place.workLocationId,
          exactSpot: dto.exactSpot?.trim() || null,
          placePath: place.placePath,
          lototoRequired: dto.lototoRequired ?? false,
          gasTestingRequired: dto.gasTestingRequired ?? false,
          plannedStartAt: dto.plannedStartAt,
          plannedEndAt: dto.plannedEndAt,
          createdBy: user.id,
          updatedBy: user.id,
          draftHolder: 'receiver',
          draftHeldBy: user.id,
          receiverSiteVisited: dto.receiverSiteVisited ?? false,
          executorSiteVisited: dto.executorSiteVisited ?? false,
          safetyOfficerSiteVisited: dto.safetyOfficerSiteVisited ?? false,
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

      if (dto.assetIds?.length) {
        await this.replacePermitAssets(tx, permit.id, user.id, tenantId, place.siteId, dto.assetIds);
      }

      await this.insertRelations(
        tx,
        permit.id,
        user.id,
        tenantId,
        dto.machineryId,
        {
          workstationId: dto.workstationId,
          workLocationId: place.workLocationId,
          assetIds: dto.assetIds,
        },
        dto,
        user,
      );

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
    return created;
  }

  async findAll(
    user: AuthenticatedUser,
    status?: string,
    siteId?: string,
    workLocationId?: string,
  ): Promise<(typeof permits.$inferSelect)[]> {
    const tenantId = this.requireTenant(user);

    const listKey = `${tenantId}:${user.id}:${siteId ?? ''}:${workLocationId ?? ''}`;
    const cached = await this.permitCacheService.getPermitList<(typeof permits.$inferSelect)[]>(
      listKey,
      status,
    );
    if (cached) {
      return cached;
    }

    const conditions = [eq(permits.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(permits.status, status));
    }
    if (siteId) {
      conditions.push(eq(permits.siteId, siteId));
    }
    if (workLocationId) {
      const locations = await this.db
        .select({ id: workLocations.id, parentId: workLocations.parentId })
        .from(workLocations)
        .where(eq(workLocations.tenantId, tenantId));
      const parentOf = new Map(locations.map((row) => [row.id, row.parentId]));
      const ids = [workLocationId, ...descendantIds(workLocationId, parentOf)];
      conditions.push(inArray(permits.workLocationId, ids));
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

    await this.permitCacheService.setPermitList(listKey, status, results);
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
    // Under the row lock, so a submit or an attachment upload cannot slip in between check and delete.
    const detail = await this.db.transaction(async (tx) => {
      const locked = await this.loadLockedDetail(tx, id, tenantId);
      if (locked.permit.status !== 'draft') {
        throw new ConflictException('Only draft permits can be deleted');
      }
      await tx.delete(permits).where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));
      return locked;
    });

    // Attachment rows went with the permit; their stored files are removed once that committed.
    await Promise.all(
      detail.attachments.map((attachment) => this.storageService?.deleteObject(attachment.storageKey).catch(() => undefined)),
    );

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
  ): Promise<PermitDetail & { gasChanges?: string[] }> {
    const tenantId = this.requireTenant(user);
    const { expectedRevision, ...rawDto } = input;
    const updated = await this.db.transaction(async (tx) => {
      const existing = await this.loadLockedDetail(tx, id, tenantId);
      if (!isEditablePermitStatus(existing.permit.status)) {
        throw new ConflictException('Only draft, deferred or rejected permits can be updated');
      }
      const dto = sanitizeDraftUpdateDto(user, rawDto, existing);
      const formResponses =
        dto.formResponses !== undefined ? await this.resolveFormResponses(tenantId, dto.formResponses) : undefined;
      assertDraftUpdateAllowed(user, existing, dto);
      assertExpectedRevision(existing, expectedRevision);
      if (
        isLototoFrozen(existing.lototo) &&
        (dto.lototo !== undefined ||
          dto.lototoRequired !== undefined ||
          (dto.machineryId !== undefined && dto.machineryId !== existing.permit.machineryId))
      ) {
        assertLototoWritable(existing.lototo);
      }
      const revision = existing.permit.draftRevision + 1;

      const permitUpdates: Partial<typeof permits.$inferInsert> = {
        updatedBy: user.id,
        updatedAt: new Date(),
        draftRevision: revision,
      };
      if (formResponses !== undefined) {
        // Approval and closure fields are only written by those decisions, never by a draft save.
        const kept = keepLaterStageAnswers(existing.permit.formResponses as PermitFormResponse[], formResponses);
        permitUpdates.formResponses = kept;
        await this.recordAnswerChanges(tx, existing, kept, revision, user.id, tenantId);
      }

      if (dto.permitTypeId !== undefined) permitUpdates.permitTypeId = dto.permitTypeId;
      if (dto.title !== undefined) permitUpdates.title = dto.title;
      if (dto.workScope !== undefined) permitUpdates.workScope = dto.workScope;
      if (dto.emergencyPhone !== undefined) permitUpdates.emergencyPhone = dto.emergencyPhone.trim() || null;
      if (dto.plantId !== undefined) permitUpdates.plantId = dto.plantId;
      if (dto.departmentId !== undefined) permitUpdates.departmentId = dto.departmentId;
      if (dto.locationId !== undefined) permitUpdates.locationId = dto.locationId;
      if (dto.workstationId !== undefined) permitUpdates.workstationId = dto.workstationId;
      if (dto.machineryId !== undefined) permitUpdates.machineryId = dto.machineryId;
      if (dto.siteId !== undefined || dto.workLocationId !== undefined) {
        const siteId = dto.siteId !== undefined ? dto.siteId : existing.permit.siteId;
        const workLocationId = dto.workLocationId !== undefined ? dto.workLocationId : existing.permit.workLocationId;
        const place = await this.resolvePermitPlace(tx, tenantId, user, siteId, workLocationId);
        permitUpdates.siteId = place.siteId;
        permitUpdates.workLocationId = place.workLocationId;
        if (dto.workLocationId !== undefined) permitUpdates.placePath = place.placePath;
      }
      if (dto.exactSpot !== undefined) permitUpdates.exactSpot = dto.exactSpot.trim() || null;
      if (dto.lototoRequired !== undefined) permitUpdates.lototoRequired = dto.lototoRequired;
      if (dto.gasTestingRequired !== undefined) permitUpdates.gasTestingRequired = dto.gasTestingRequired;
      if (dto.plannedStartAt !== undefined) permitUpdates.plannedStartAt = dto.plannedStartAt;
      if (dto.plannedEndAt !== undefined) permitUpdates.plannedEndAt = dto.plannedEndAt;
      if (dto.receiverSiteVisited !== undefined) permitUpdates.receiverSiteVisited = dto.receiverSiteVisited;
      if (dto.executorSiteVisited !== undefined) permitUpdates.executorSiteVisited = dto.executorSiteVisited;
      if (dto.safetyOfficerSiteVisited !== undefined) {
        permitUpdates.safetyOfficerSiteVisited = dto.safetyOfficerSiteVisited;
      }
      if (dto.safetyApprovalComment !== undefined || dto.safetyApprovalSignedName !== undefined) {
        const comment = (dto.safetyApprovalComment ?? existing.permit.safetyApprovalComment ?? '').trim();
        const signedName = (dto.safetyApprovalSignedName ?? existing.permit.safetyApprovalSignedName ?? '').trim();
        permitUpdates.safetyApprovalComment = comment || null;
        permitUpdates.safetyApprovalSignedName = signedName || null;
        permitUpdates.safetyApprovedBy = comment && signedName ? user.id : null;
        permitUpdates.safetyApprovedAt = comment && signedName ? new Date() : null;
      }
      if (dto.safetyOfficers !== undefined) {
        const officerIds = dto.safetyOfficers
          .map((row) => row.workforceUserId)
          .filter((id): id is string => Boolean(id));
        const signer = permitUpdates.safetyApprovedBy ?? existing.permit.safetyApprovedBy;
        if (officerIds.length === 0 || (signer && !officerIds.includes(signer))) {
          permitUpdates.safetyApprovalComment = null;
          permitUpdates.safetyApprovalSignedName = null;
          permitUpdates.safetyApprovedBy = null;
          permitUpdates.safetyApprovedAt = null;
        }
      }

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
          const permitTypeId = dto.permitTypeId ?? existing.permit.permitTypeId;
          await this.insertHazards(tx, id, user.id, tenantId, permitTypeId, dto.hazards);
        }
      }

      if (dto.ppe !== undefined) {
        await tx.delete(permitPpe).where(eq(permitPpe.permitId, id));
        if (dto.ppe.length > 0) {
          await this.insertPpe(tx, id, user.id, dto.ppe);
        }
      }

      if (dto.executors !== undefined) {
        await tx.delete(permitExecutors).where(eq(permitExecutors.permitId, id));
        if (dto.executors.length > 0) {
          await this.insertExecutors(tx, id, user.id, dto.executors, [
            existing.permit.createdBy,
            existing.permit.submittedBy,
          ]);
        }
      }

      if (dto.lototo !== undefined) {
        const lototoAssets =
          dto.assetIds ?? (existing.assets ?? []).map((row) => row.assetId);
        await this.replaceLototo(
          tx,
          id,
          user.id,
          tenantId,
          dto.machineryId !== undefined ? dto.machineryId : existing.permit.machineryId,
          dto.lototo,
          lototoAssets,
        );
      } else if (
        dto.machineryId !== undefined &&
        dto.machineryId !== existing.permit.machineryId
      ) {
        await this.replaceLototo(tx, id, user.id, tenantId, dto.machineryId, []);
      }

      if (dto.assetIds !== undefined) {
        const siteId = permitUpdates.siteId !== undefined ? permitUpdates.siteId : existing.permit.siteId;
        await this.replacePermitAssets(tx, id, user.id, tenantId, siteId, dto.assetIds);
      }

      let gasChanges: string[] = [];
      if (dto.gasTesting !== undefined) {
        await tx.delete(permitGasTesting).where(eq(permitGasTesting.permitId, id));
        if (dto.gasTesting.length > 0) {
          await this.insertGasTesting(
            tx,
            id,
            user.id,
            tenantId,
            {
              workstationId: dto.workstationId !== undefined ? dto.workstationId : existing.permit.workstationId,
              workLocationId:
                permitUpdates.workLocationId !== undefined
                  ? permitUpdates.workLocationId
                  : existing.permit.workLocationId,
              assetIds: dto.assetIds ?? (existing.assets ?? []).map((row) => row.assetId),
            },
            dto.gasTesting,
            user,
          );
        }
      } else if (
        this.gasTestingService &&
        (dto.workLocationId !== undefined || dto.assetIds !== undefined)
      ) {
        const workLocationId =
          permitUpdates.workLocationId !== undefined
            ? permitUpdates.workLocationId
            : existing.permit.workLocationId;
        const assetIds = dto.assetIds ?? (existing.assets ?? []).map((row) => row.assetId);
        if (workLocationId) {
          gasChanges = await this.syncGasDefaults(tx, id, user, tenantId, workLocationId, assetIds);
        }
      } else if (
        dto.workstationId !== undefined &&
        dto.workstationId !== existing.permit.workstationId
      ) {
        await tx.delete(permitGasTesting).where(eq(permitGasTesting.permitId, id));
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

      const detail = await this.loadDetail(tx, id, tenantId);
      return gasChanges.length > 0 ? { ...detail, gasChanges } : detail;
    });
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
        await this.insertExecutors(tx, id, user.id, dto.executors, [
          existing.permit.createdBy,
          existing.permit.submittedBy,
        ]);
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

  async handoffDraft(
    id: string,
    dto: { to: DraftHolder; expectedRevision: number },
    user: AuthenticatedUser,
  ): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);
    const updated = await this.db.transaction(async (tx) => {
      const detail = await this.loadLockedDetail(tx, id, tenantId);
      if (!isEditablePermitStatus(detail.permit.status)) {
        throw new ConflictException('Only an editable permit can be handed over');
      }
      assertExpectedRevision(detail, dto.expectedRevision);
      const holder = parseDraftHolder(detail.permit.draftHolder);
      const hasSafetyOfficer = detail.safetyOfficers.length > 0;
      const expected = nextHandoffTarget(holder, hasSafetyOfficer);
      if (!expected || dto.to !== expected) {
        throw new BadRequestException('That handoff is not allowed from the current holder');
      }
      this.assertCanMoveDraft(user, detail, 'handoff');
      this.assertHandoffReady(detail, expected);

      const heldBy = this.heldByFor(expected, detail);
      const revision = detail.permit.draftRevision + 1;
      await tx
        .update(permits)
        .set({
          draftHolder: expected,
          draftHeldBy: heldBy,
          draftReturnReason: null,
          draftRevision: revision,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(permits.id, id));
      await this.permitCacheService.invalidatePermit(tenantId, id);
      return this.loadDetail(tx, id, tenantId);
    });
    await this.notifyDraftHolder(updated, tenantId, user.id, 'handoff');
    return updated;
  }

  async returnDraft(
    id: string,
    dto: { expectedRevision: number; reason: string },
    user: AuthenticatedUser,
  ): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);
    const updated = await this.db.transaction(async (tx) => {
      const detail = await this.loadLockedDetail(tx, id, tenantId);
      if (!isEditablePermitStatus(detail.permit.status)) {
        throw new ConflictException('Only an editable permit can be returned');
      }
      assertExpectedRevision(detail, dto.expectedRevision);
      const holder = parseDraftHolder(detail.permit.draftHolder);
      const hasSafetyOfficer = detail.safetyOfficers.length > 0;
      const expected = returnHandoffTarget(holder, hasSafetyOfficer);
      if (!expected) {
        throw new BadRequestException('This draft cannot be returned further');
      }
      this.assertCanMoveDraft(user, detail, 'return');
      const reason = dto.reason.trim();
      if (!reason) {
        throw new BadRequestException('Why return is required');
      }

      const heldBy = this.heldByFor(expected, detail);
      const revision = detail.permit.draftRevision + 1;
      await tx
        .update(permits)
        .set({
          draftHolder: expected,
          draftHeldBy: heldBy,
          draftReturnReason: reason,
          draftRevision: revision,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(permits.id, id));
      await this.permitCacheService.invalidatePermit(tenantId, id);
      return this.loadDetail(tx, id, tenantId);
    });
    await this.notifyDraftHolder(updated, tenantId, user.id, 'return');
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
      if (parseDraftHolder(detail.permit.draftHolder) !== 'ready_for_review') {
        throw new BadRequestException('Submit after the draft is handed over for review');
      }
      assertExpectedRevision(detail, dto.expectedRevision);

      const placed = await this.backfillPlaceFromLegacy(tx, detail.permit);
      const applicable = await this.applicableTemplates(tx, tenantId, placed.permitTypeId);
      const assetRows = await tx
        .select({ assetId: permitAssets.assetId })
        .from(permitAssets)
        .where(eq(permitAssets.permitId, id));
      if (assetRows.length === 0 && placed.machineryId) {
        const [asset] = await tx
          .select({ id: assets.id })
          .from(assets)
          .where(and(eq(assets.id, placed.machineryId), eq(assets.tenantId, tenantId)));
        if (asset) {
          await tx.insert(permitAssets).values({
            permitId: id,
            assetId: asset.id,
            createdBy: user.id,
            updatedBy: user.id,
          });
          assetRows.push({ assetId: asset.id });
        }
      }
      this.validationService.validateForSubmit(
        { ...detail, permit: placed, assetIds: assetRows.map((row) => row.assetId) },
        missingFormAnswers(applicable, placed.formResponses as PermitFormResponse[]),
      );
      assertPermitSegregationOfDuties({
        receiverIds: [detail.permit.createdBy, user.id],
        executorIds: detail.executors.map((row) => row.workforceUserId),
      });

      const fromStatus = detail.permit.status;
      const isResubmit = fromStatus === 'deferred' || fromStatus === 'rejected';
      const reference = detail.permit.reference ?? (await generatePermitReference(tx, tenantId));
      const submittedAt = new Date();

      // Bumping the revision here means a tab opened before submit cannot save over the permit
      // after it is rejected or deferred back to an editable status.
      await tx
        .update(permits)
        .set({
          status: 'pending_approval',
          reference,
          submittedAt,
          submittedBy: user.id,
          submittedSignedName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username,
          permitVersion: isResubmit ? detail.permit.permitVersion + 1 : 1,
          permitVersionAt: submittedAt,
          approvedAt: null,
          approvedBy: null,
          approvedSignedName: null,
          updatedBy: user.id,
          updatedAt: new Date(),
          draftRevision: detail.permit.draftRevision + 1,
        })
        .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));
      // Signatures from an earlier approval or closure round do not carry into this one.
      await resetStageAnswers(tx, { permitId: id, tenantId, toStatus: 'pending_approval', actorId: user.id });

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

    if (!user.roles.includes('permit-receiver') && source.permit.submittedBy !== user.id) {
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
          emergencyPhone: source.permit.emergencyPhone,
          plantId: source.permit.plantId,
          departmentId: source.permit.departmentId,
          locationId: source.permit.locationId,
          workstationId: source.permit.workstationId,
          machineryId: source.permit.machineryId,
          siteId: source.permit.siteId,
          workLocationId: source.permit.workLocationId,
          exactSpot: source.permit.exactSpot,
          placePath: source.permit.placePath,
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
            omittedConsequences: hazard.omittedConsequences ?? [],
            omittedControls: hazard.omittedControls ?? [],
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
          source.assets.map((row) => row.assetId),
        );
      }

      if (source.assets.length > 0) {
        await tx.insert(permitAssets).values(
          source.assets.map((row) => ({
            permitId: renewal.id,
            assetId: row.assetId,
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
            sourceKind: item.sourceKind,
            sourceId: item.sourceId,
            removedReason: item.removedReason,
            handAdded: item.handAdded,
            createdBy: user.id,
            updatedBy: user.id,
          })),
        );
      }

      const renewalExecutors = source.executors.filter((executor) => executor.workforceUserId !== user.id);
      if (renewalExecutors.length > 0) {
        await tx.insert(permitExecutors).values(
          renewalExecutors.map((executor) => ({
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
      user: AuthenticatedUser;
      stage: 'approval' | 'closure';
      status: string;
      input?: StageAnswersDto;
    },
  ): Promise<string[]> {
    const { permitId, tenantId, user, stage, status, input } = params;
    const userId = user.id;
    const detail = await this.loadLockedDetail(tx, permitId, tenantId);
    if (detail.permit.status !== status) {
      throw new ConflictException('This permit moved on since you opened it. Reload to see where it is now.');
    }
    const applicable = await this.applicableTemplates(tx, tenantId, detail.permit.permitTypeId);
    let responses = detail.permit.formResponses as PermitFormResponse[];
    if (input?.formResponses.length) {
      assertExpectedRevision(detail, input.expectedRevision);
      const revision = detail.permit.draftRevision + 1;
      const signer = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
      responses = applyStageAnswers(responses, input.formResponses, applicable, stage, signer);
      await this.recordAnswerChanges(tx, detail, responses, revision, userId, tenantId);
      await tx
        .update(permits)
        .set({ formResponses: responses, draftRevision: revision, updatedBy: userId, updatedAt: new Date() })
        .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));
    }
    // Captured forms count as captured, whatever has since happened to their templates.
    return missingFormAnswers(formsToCheck(responses, applicable), responses, stage);
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
    const lototo = await this.loadLototoAttachments(db, id);
    const gasTesting = await db
      .select()
      .from(permitGasTesting)
      .where(eq(permitGasTesting.permitId, id));

    const assetsOnPermit = await db.select().from(permitAssets).where(eq(permitAssets.permitId, id));

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
      assets: assetsOnPermit,
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
    place: { workstationId?: string | null; workLocationId?: string | null; assetIds?: string[] },
    dto: CreatePermitDto | UpdatePermitDto,
    user?: AuthenticatedUser,
  ): Promise<void> {
    if (dto.hazards?.length) {
      await this.insertHazards(db, permitId, userId, tenantId, dto.permitTypeId, dto.hazards);
    }
    if (dto.ppe?.length) {
      await this.insertPpe(db, permitId, userId, dto.ppe);
    }
    if (dto.executors?.length) {
      await this.insertExecutors(db, permitId, userId, dto.executors, [userId]);
    }
    if (dto.lototo?.length) {
      await this.replaceLototo(db, permitId, userId, tenantId, machineryId, dto.lototo, place.assetIds ?? []);
    }
    if (dto.gasTesting?.length) {
      await this.insertGasTesting(db, permitId, userId, tenantId, place, dto.gasTesting, user);
    }
    if (dto.viewers?.length) {
      await this.insertAssignees(db, permitViewers, permitId, userId, dto.viewers);
    }
    if (dto.safetyOfficers?.length) {
      await this.insertAssignees(db, permitSafetyOfficers, permitId, userId, dto.safetyOfficers);
    }
  }

  private async insertHazards(
    db: Pick<Database, 'insert' | 'select'>,
    permitId: string,
    userId: string,
    tenantId: string,
    permitTypeId: string | null | undefined,
    hazards: NonNullable<CreatePermitDto['hazards']>,
  ): Promise<void> {
    if (hazards.length === 0) {
      return;
    }

    await this.assertHazardsFitPermitType(db, tenantId, permitTypeId, hazards);

    await db.insert(permitHazards).values(
      hazards.map((hazard) => ({
        permitId,
        hazardCategoryId: hazard.hazardCategoryId,
        extraConsequences: (hazard.extraConsequences ?? []).map((value) => value.trim()).filter(Boolean),
        extraControls: (hazard.extraControls ?? []).map((value) => value.trim()).filter(Boolean),
        omittedConsequences: (hazard.omittedConsequences ?? []).map((value) => value.trim()).filter(Boolean),
        omittedControls: (hazard.omittedControls ?? []).map((value) => value.trim()).filter(Boolean),
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  private async assertHazardsFitPermitType(
    db: Pick<Database, 'select'>,
    tenantId: string,
    permitTypeId: string | null | undefined,
    hazards: NonNullable<CreatePermitDto['hazards']>,
  ): Promise<void> {
    if (!permitTypeId) {
      return;
    }
    const [permitType] = await db
      .select({ code: permitTypes.code })
      .from(permitTypes)
      .where(and(eq(permitTypes.id, permitTypeId), eq(permitTypes.tenantId, tenantId)));
    if (!permitType?.code) {
      return;
    }
    const ids = [...new Set(hazards.map((hazard) => hazard.hazardCategoryId))];
    const rows = await db
      .select({
        id: hazardCategories.id,
        name: hazardCategories.name,
        permitTypeCodes: hazardCategories.permitTypeCodes,
      })
      .from(hazardCategories)
      .where(and(eq(hazardCategories.tenantId, tenantId), inArray(hazardCategories.id, ids)));
    const unfit = rows.filter((row) => !hazardFitsPermitType(row.permitTypeCodes, permitType.code));
    if (unfit.length > 0) {
      throw new BadRequestException(
        `${unfit.map((row) => row.name).join(', ')} ${unfit.length === 1 ? 'is' : 'are'} not used on this permit type`,
      );
    }
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
    const verificationRuns = await db
      .select()
      .from(permitLototoVerificationRuns)
      .where(inArray(permitLototoVerificationRuns.instanceId, instanceIds));

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
      verification: verificationRuns
        .filter((row) => row.instanceId === instance.id && row.signedName)
        .map((row) => ({
          phase: row.phase,
          result: row.result,
          signedName: row.signedName,
          verifiedAt: row.verifiedAt,
        })),
    }));
  }

  private async replaceLototo(
    db: Pick<Database, 'insert' | 'select' | 'delete'>,
    permitId: string,
    userId: string,
    tenantId: string,
    machineryId: string | null | undefined,
    lototoItems: PermitLototoDto[],
    assetIds: string[] = [],
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
    const selected = new Set([...assetIds, machineryId].filter((id): id is string => Boolean(id)));
    if (selected.size === 0) {
      throw new BadRequestException('An asset is required when attaching LOTOTO procedures');
    }

    const ids = [...new Set(lototoItems.map((item) => item.procedureId))];
    if (ids.length !== lototoItems.length) {
      throw new BadRequestException('Each LOTOTO procedure can only be attached once');
    }

    const rows = await db
      .select({
        id: lototoProcedures.id,
        machineryId: lototoProcedures.machineryId,
        assetId: lototoProcedures.assetId,
        publishedVersionId: lototoProcedures.publishedVersionId,
        status: lototoProcedures.status,
      })
      .from(lototoProcedures)
      .where(and(eq(lototoProcedures.tenantId, tenantId), inArray(lototoProcedures.id, ids)));

    if (rows.length !== ids.length) {
      throw new BadRequestException('One or more LOTOTO procedures were not found');
    }
    if (rows.some((row) => !selected.has(row.assetId ?? '') && !selected.has(row.machineryId ?? ''))) {
      throw new BadRequestException('LOTOTO procedures must belong to a selected asset');
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
      const allowedEnergy = await allowedEnergyCodes(db, tenantId);
      for (const [index, point] of extraPoints.entries()) {
        if (!point.energyType.trim()) {
          throw new BadRequestException('Extra isolation points need an energy type');
        }
        if (!allowedEnergy.has(point.energyType.trim())) {
          throw new BadRequestException('Choose an energy source from the list');
        }
        const [extra] = await db
          .insert(permitLototoExtraPoints)
          .values({
            instanceId: instance.id,
            sortOrder: index,
            pointCode: point.pointCode.trim(),
            energyType: point.energyType.trim(),
            energyOtherText: point.energyOtherText?.trim() || null,
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
      const [primaryOperator] = await db
        .select({ workforceUserId: permitExecutors.workforceUserId })
        .from(permitExecutors)
        .where(and(eq(permitExecutors.permitId, permitId), eq(permitExecutors.isPrimary, true)));
      const verifierIds = [
        ...new Set(
          [
            ...(item.verifiers ?? []).map((row) => row.workforceUserId),
            ...(item.verifiers?.length ? [] : [primaryOperator?.workforceUserId]),
          ].filter(Boolean),
        ),
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

  /** Old drafts store plant, location and workstation. Submit copies those onto the new place fields. */
  private async backfillPlaceFromLegacy(
    db: Pick<Database, 'select' | 'update'>,
    permit: typeof permits.$inferSelect,
  ) {
    let workLocationId = permit.workLocationId;
    let siteId = permit.siteId;
    if (!workLocationId) {
      for (const candidate of [permit.workstationId, permit.locationId, permit.departmentId]) {
        if (!candidate) continue;
        const [found] = await db
          .select({ id: workLocations.id, siteId: workLocations.siteId })
          .from(workLocations)
          .where(and(eq(workLocations.id, candidate), eq(workLocations.tenantId, permit.tenantId)));
        if (found) {
          workLocationId = found.id;
          siteId = siteId ?? found.siteId;
          break;
        }
      }
    }
    if (!siteId && permit.plantId) {
      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(and(eq(sites.id, permit.plantId), eq(sites.tenantId, permit.tenantId)));
      siteId = site?.id ?? null;
    }
    if (!siteId && workLocationId) {
      const [location] = await db
        .select({ siteId: workLocations.siteId })
        .from(workLocations)
        .where(eq(workLocations.id, workLocationId));
      siteId = location?.siteId ?? null;
    }
    if (siteId === permit.siteId && workLocationId === permit.workLocationId) {
      return permit;
    }
    const [updated] = await db
      .update(permits)
      .set({ siteId, workLocationId, updatedAt: new Date() })
      .where(eq(permits.id, permit.id))
      .returning();
    return updated ?? permit;
  }

  /** Keep hand-added and removed rows. Add, tighten, or drop catalogue defaults. */
  private async syncGasDefaults(
    db: Pick<Database, 'insert' | 'select' | 'delete' | 'update'>,
    permitId: string,
    user: AuthenticatedUser,
    tenantId: string,
    workLocationId: string,
    assetIds: string[],
  ): Promise<string[]> {
    const defaults = await this.gasTestingService!.defaults(user, workLocationId, assetIds);
    const current = await db.select().from(permitGasTesting).where(eq(permitGasTesting.permitId, permitId));
    const byKey = new Map(current.map((row) => [row.parameter.trim().toLowerCase(), row]));
    const seen = new Set<string>();
    const changes: string[] = [];
    for (const item of defaults) {
      const key = item.parameter.trim().toLowerCase();
      seen.add(key);
      const existing = byKey.get(key);
      if (!existing) {
        await db.insert(permitGasTesting).values({
          permitId,
          gasTestingCatalogueId: null,
          workstationId: item.minimumSource.id,
          parameter: item.parameter,
          unit: item.unit,
          minimum: item.minimum,
          maximum: item.maximum,
          sourceKind: item.minimumSource.kind,
          sourceId: item.minimumSource.id,
          handAdded: false,
          createdBy: user.id,
          updatedBy: user.id,
        });
        changes.push(`Added ${item.parameter} from ${item.minimumSource.name}`);
        continue;
      }
      if (existing.removedReason?.trim() || existing.handAdded) continue;
      const minimum = Math.max(existing.minimum, item.minimum);
      const maximum = Math.min(existing.maximum, item.maximum);
      if (minimum > maximum) continue;
      if (minimum !== existing.minimum || maximum !== existing.maximum) {
        await db
          .update(permitGasTesting)
          .set({
            minimum,
            maximum,
            unit: item.unit,
            sourceKind: item.minimumSource.kind,
            sourceId: item.minimumSource.id,
            updatedBy: user.id,
            updatedAt: new Date(),
          })
          .where(eq(permitGasTesting.id, existing.id));
        changes.push(`Tightened ${item.parameter} to ${minimum}–${maximum} ${item.unit}`);
      }
    }
    for (const row of current) {
      const key = row.parameter.trim().toLowerCase();
      if (seen.has(key) || row.handAdded || row.removedReason?.trim()) continue;
      await db.delete(permitGasTesting).where(eq(permitGasTesting.id, row.id));
      changes.push(`Removed ${row.parameter}; it is no longer a default for this place`);
    }
    const remaining = await db
      .select({ removedReason: permitGasTesting.removedReason })
      .from(permitGasTesting)
      .where(eq(permitGasTesting.permitId, permitId));
    const required = remaining.some((row) => !row.removedReason?.trim());
    await db
      .update(permits)
      .set({ gasTestingRequired: required, updatedAt: new Date() })
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));
    return changes;
  }

  private async insertGasTesting(
    db: Pick<Database, 'insert' | 'select'>,
    permitId: string,
    userId: string,
    tenantId: string,
    place: { workstationId?: string | null; workLocationId?: string | null; assetIds?: string[] },
    items: NonNullable<CreatePermitDto['gasTesting']>,
    user?: AuthenticatedUser,
  ): Promise<void> {
    if (items.length === 0) return;
    const catalogueItems = items.filter((item) => item.gasTestingCatalogueId);
    const handItems = items.filter((item) => !item.gasTestingCatalogueId);
    const seen = new Set<string>();
    const take = (parameter: string) => {
      const key = parameter.trim().toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestException(`Gas test ${parameter.trim()} is listed more than once`);
      }
      seen.add(key);
    };
    const values: Array<typeof permitGasTesting.$inferInsert> = [];

    if (catalogueItems.length > 0) {
      const ids = [...new Set(catalogueItems.map((item) => item.gasTestingCatalogueId!))];
      const rows = await db
        .select()
        .from(gasTestingCatalogue)
        .where(and(eq(gasTestingCatalogue.tenantId, tenantId), inArray(gasTestingCatalogue.id, ids)));
      if (rows.length !== ids.length) {
        throw new BadRequestException('One or more gas testing items were not found');
      }
      const locationIds = await this.locationAndAncestors(db, tenantId, place.workLocationId);
      const assetIds = new Set(place.assetIds ?? []);
      const byId = new Map(rows.map((row) => [row.id, row]));
      const merged = this.gasTestingService && user && place.workLocationId
        ? await this.gasTestingService.defaults(user, place.workLocationId, [...assetIds])
        : [];
      const mergedByParameter = new Map(merged.map((row) => [row.parameter.trim().toLowerCase(), row]));
      for (const item of catalogueItems) {
        const source = byId.get(item.gasTestingCatalogueId!)!;
        const onAsset = Boolean(source.assetId && assetIds.has(source.assetId));
        const onLocation = Boolean(
          (source.workLocationId && locationIds.has(source.workLocationId)) ||
            (source.workstationId && locationIds.has(source.workstationId)),
        );
        const onWorkstation = Boolean(place.workstationId && source.workstationId === place.workstationId);
        if (!onAsset && !onLocation && !onWorkstation) {
          throw new BadRequestException('Gas testing items must belong to the selected place or asset');
        }
        const minimum = item.minimum ?? source.minimum;
        const maximum = item.maximum ?? source.maximum;
        const floor = mergedByParameter.get(source.parameter.trim().toLowerCase()) ?? source;
        if (limitIsLooser({ minimum, maximum }, floor)) {
          throw new UnprocessableEntityException(
            `Gas test ${source.parameter} cannot be given a wider limit than the configured range`,
          );
        }
        const placeId = source.workstationId ?? source.workLocationId ?? source.assetId ?? place.workLocationId ?? place.workstationId;
        if (!placeId) {
          throw new BadRequestException('Gas testing item is not linked to a place or asset');
        }
        take(source.parameter);
        values.push({
          permitId,
          gasTestingCatalogueId: source.id,
          workstationId: placeId,
          parameter: source.parameter,
          unit: source.unit,
          minimum,
          maximum,
          removedReason: item.removedReason?.trim() || null,
          sourceKind: source.assetId ? 'asset' : 'work_location',
          sourceId: source.assetId ?? source.workLocationId ?? source.workstationId,
          handAdded: false,
          createdBy: userId,
          updatedBy: userId,
        });
      }
    }

    if (handItems.length > 0) {
      const placeId = place.workLocationId ?? place.workstationId;
      if (!placeId) {
        throw new BadRequestException('A work location is required when adding a gas test');
      }
      for (const item of handItems) {
        if (item.removedReason) {
          throw new BadRequestException('A hand-added gas test cannot be removed; leave it out of the list');
        }
        const parameter = item.parameter?.trim();
        const unit = item.unit?.trim();
        if (!parameter || !unit || item.minimum == null || item.maximum == null) {
          throw new BadRequestException('A hand-added gas test needs a parameter, unit, minimum and maximum');
        }
        if (item.minimum >= item.maximum) {
          throw new BadRequestException('Minimum must be less than maximum');
        }
        take(parameter);
        values.push({
          permitId,
          gasTestingCatalogueId: null,
          workstationId: placeId,
          parameter,
          unit,
          minimum: item.minimum,
          maximum: item.maximum,
          handAdded: true,
          createdBy: userId,
          updatedBy: userId,
        });
      }
    }

    if (values.length > 0) {
      await db.insert(permitGasTesting).values(values);
    }
  }

  private async locationAndAncestors(
    db: Pick<Database, 'select'>,
    tenantId: string,
    workLocationId: string | null | undefined,
  ) {
    const ids = new Set<string>();
    const seen = new Set<string>();
    let current = workLocationId ?? null;
    while (current && !seen.has(current)) {
      seen.add(current);
      ids.add(current);
      const [row] = await db
        .select({ parentId: workLocations.parentId })
        .from(workLocations)
        .where(and(eq(workLocations.id, current), eq(workLocations.tenantId, tenantId)));
      current = row?.parentId ?? null;
    }
    return ids;
  }

  private async resolvePermitPlace(
    db: Pick<Database, 'select'>,
    tenantId: string,
    user: AuthenticatedUser,
    siteId: string | null,
    workLocationId: string | null,
  ) {
    let site = siteId;
    let placePath: string | null = null;
    if (workLocationId) {
      const [location] = await db
        .select({
          siteId: workLocations.siteId,
          pathText: workLocations.pathText,
          status: workLocations.status,
        })
        .from(workLocations)
        .where(and(eq(workLocations.id, workLocationId), eq(workLocations.tenantId, tenantId)));
      if (!location || location.status === 'archived') {
        throw new BadRequestException('Work location not found');
      }
      if (site && site !== location.siteId) {
        throw new BadRequestException('Work location is not on the selected site');
      }
      site = location.siteId;
      placePath = location.pathText;
    }
    if (site) {
      const [found] = await db
        .select({ id: sites.id, status: sites.status })
        .from(sites)
        .where(and(eq(sites.id, site), eq(sites.tenantId, tenantId)));
      if (!found || found.status === 'archived') {
        throw new BadRequestException('Site not found');
      }
      if (!isTenantPrivileged(user.roles) && !user.roles.includes('platform-admin')) {
        const [member] = await db
          .select({ id: siteMembers.id })
          .from(siteMembers)
          .where(
            and(eq(siteMembers.tenantId, tenantId), eq(siteMembers.siteId, site), eq(siteMembers.userId, user.id)),
          );
        if (!member) throw new NotFoundException('Site not found');
      }
    }
    return { siteId: site, workLocationId, placePath };
  }

  private async replacePermitAssets(
    db: Pick<Database, 'insert' | 'select' | 'delete'>,
    permitId: string,
    userId: string,
    tenantId: string,
    siteId: string | null,
    assetIds: string[],
  ) {
    const unique = [...new Set(assetIds)];
    if (unique.length > 0) {
      if (!siteId) throw new BadRequestException('A site is required when selecting assets');
      const rows = await db
        .select({ id: assets.id, siteId: assets.siteId, status: assets.status })
        .from(assets)
        .where(and(eq(assets.tenantId, tenantId), inArray(assets.id, unique)));
      if (rows.length !== unique.length || rows.some((row) => row.siteId !== siteId || row.status === 'archived')) {
        throw new BadRequestException('Assets must be active records on the permit site');
      }
    }
    await db.delete(permitAssets).where(eq(permitAssets.permitId, permitId));
    if (unique.length > 0) {
      await db.insert(permitAssets).values(
        unique.map((assetId) => ({
          permitId,
          assetId,
          createdBy: userId,
          updatedBy: userId,
        })),
      );
    }
  }

  private async insertExecutors(
    db: Pick<Database, 'insert'>,
    permitId: string,
    userId: string,
    executors: NonNullable<CreatePermitDto['executors']>,
    receiverIds: Array<string | null | undefined>,
  ): Promise<void> {
    if (executors.length === 0) {
      return;
    }

    assertPermitSegregationOfDuties({
      receiverIds,
      executorIds: executors.map((executor) => executor.workforceUserId),
    });

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

  private assertCanMoveDraft(
    user: AuthenticatedUser,
    detail: PermitDetail,
    action: 'handoff' | 'return',
  ): void {
    if (isTenantPrivileged(user.roles) || user.roles.includes('platform-admin')) {
      return;
    }
    if (action === 'handoff') {
      const holder = parseDraftHolder(detail.permit.draftHolder);
      if (holder === 'receiver' && detail.permit.createdBy === user.id) {
        return;
      }
      if (holder === 'operator' && isAssignedExecutor(detail, user.id)) {
        return;
      }
      if (holder === 'safety_officer' && isAssignedSafetyOfficer(detail, user.id)) {
        return;
      }
      throw new ForbiddenException('Only the current holder can hand this draft over');
    }
    const heldBy = detail.permit.draftHeldBy;
    if (heldBy && heldBy === user.id) {
      return;
    }
    const holder = parseDraftHolder(detail.permit.draftHolder);
    if (holder === 'operator' && isAssignedExecutor(detail, user.id)) {
      return;
    }
    if (holder === 'safety_officer' && isAssignedSafetyOfficer(detail, user.id)) {
      return;
    }
    if (holder === 'ready_for_review' && detail.permit.createdBy === user.id) {
      return;
    }
    throw new ForbiddenException('Only the current holder can return this draft');
  }

  private assertHandoffReady(detail: PermitDetail, to: DraftHolder): void {
    const { permit, executors, hazards, ppe } = detail;
    const errors: string[] = [];
    if (to === 'operator') {
      if (!permit.title?.trim()) errors.push('title is required');
      if (!permit.siteId && !permit.departmentId) errors.push('site is required');
      if (!permit.workLocationId && !permit.locationId) errors.push('work location is required');
      if (!permit.plannedStartAt || !permit.plannedEndAt) errors.push('planned start and end are required');
      if (executors.length === 0) errors.push('assign a primary executor');
    }
    if (to === 'safety_officer' || to === 'ready_for_review') {
      if (!permit.workLocationId && !permit.workstationId) errors.push('work location is required');
      if (hazards.length === 0) errors.push('at least one hazard is required');
      if (ppe.length === 0) errors.push('at least one PPE item is required');
    }
    if (to === 'ready_for_review' && parseDraftHolder(detail.permit.draftHolder) === 'safety_officer') {
      if (!permit.safetyApprovalComment?.trim() || !permit.safetyApprovalSignedName?.trim()) {
        errors.push('Safety Approval comment and typed name are required');
      }
    }
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Complete your sections before handing over',
        error: 'VALIDATION_ERROR',
        details: errors,
      });
    }
  }

  private heldByFor(holder: DraftHolder, detail: PermitDetail): string | null {
    if (holder === 'receiver' || holder === 'ready_for_review') {
      return detail.permit.createdBy;
    }
    if (holder === 'operator') {
      const primary = detail.executors.find((row) => row.isPrimary) ?? detail.executors[0];
      return primary?.workforceUserId ?? null;
    }
    return detail.safetyOfficers[0]?.workforceUserId ?? null;
  }

  private async notifyDraftHolder(
    detail: PermitDetail,
    tenantId: string,
    actorId: string,
    action: 'handoff' | 'return',
  ): Promise<void> {
    const heldBy = detail.permit.draftHeldBy;
    if (!heldBy || heldBy === actorId) {
      return;
    }
    const holder = parseDraftHolder(detail.permit.draftHolder);
    const work = holderNextWork(holder);
    const role = holderStageLabel(holder);
    const appUrl = (this.configService.get<string>('appPublicUrl') ?? 'http://localhost:3000').replace(/\/$/, '');
    const permitUrl = `${appUrl}/permits/${detail.permit.id}/edit`;
    const title = detail.permit.title;
    const verb = action === 'handoff' ? 'handed over to you' : 'returned to you';
    const reason = action === 'return' ? detail.permit.draftReturnReason?.trim() : '';
    const body = [
      `Permit "${title}" was ${verb}. You hold the draft as ${role}. Complete: ${work}.`,
      reason ? `Why return: ${reason}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await this.notificationsService?.generateSystem(tenantId, actorId, {
        eventType: 'task_reminder',
        category: 'workflow',
        title: action === 'handoff' ? `Draft handed to you: ${title}` : `Draft returned to you: ${title}`,
        body,
        entityType: 'permit',
        entityId: detail.permit.id,
        recipientUserIds: [heldBy],
        sourceModule: 'permit',
      });
    } catch {
      // In-app notify is best-effort; email still goes out.
    }

    const [recipient] = await this.db
      .select({ email: tenantUsers.email, firstName: tenantUsers.firstName })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.keycloakUserId, heldBy)))
      .limit(1);
    if (recipient?.email) {
      await this.mailService.send({
        to: recipient.email,
        subject: action === 'handoff' ? `Draft handed to you: ${title}` : `Draft returned to you: ${title}`,
        text: `Hello${recipient.firstName ? ` ${recipient.firstName}` : ''},\n\n${body}\n\nOpen the permit: ${permitUrl}\n`,
      });
    }
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
