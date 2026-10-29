import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { hazardCategories, permitExecution, permitExecutors, permitExecutionCompletions, permitVerifications, permits } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { WorkflowEngineService } from '../approval/workflow-engine.service';
import { PermitCacheService } from '../permit/permit-cache.service';
import { PermitService } from '../permit/permit.service';
import { PermitLototoExecutionService } from '../permit/permit-lototo-execution.service';
import {
  ACTIVE_STATUS,
  APPROVED_STATUS,
  SUSPENDED_STATUS,
} from './execution.constants';
import { ActivatePermitDto } from './dto/activate-permit.dto';
import { ExecutionStartDto } from './dto/execution-start.dto';
import {
  assertExecutionStartReady,
  emptyExecutionStart,
  requiredHazardControlKeys,
  type ExecutionStartState,
} from './execution-start';
import { CompleteExecutionDto, SendBackDto } from './dto/complete-execution.dto';
import { isPrimaryExecutor, isPermitIssuer, isPrivilegedPermitViewer, visiblePermitFilter } from '../permit/permit-access';
import { SuspendPermitDto } from './dto/suspend-permit.dto';
import { ExecutionCacheService } from './execution-cache.service';
import { ExecutionLogService } from './execution-log.service';
import { IsolationCertificateService } from '../lototo/isolation-certificate.service';
import { NotificationsService as InboxNotificationsService } from '../notifications/notifications.service';
import { NotificationService } from './notification.service';
import { StatusTransitionService } from './status-transition.service';
import { ReleaseExecutionDto } from './dto/release-execution.dto';

@Injectable()
export class ExecutionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly lototoExecutionService: PermitLototoExecutionService,
    private readonly statusTransitionService: StatusTransitionService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
    private readonly executionCacheService: ExecutionCacheService,
    private readonly executionLogService: ExecutionLogService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngine: WorkflowEngineService,
    @Optional()
    @Inject(InboxNotificationsService)
    private readonly inbox?: InboxNotificationsService,
    @Optional()
    private readonly isolationCertificates?: IsolationCertificateService,
  ) {}

  async activate(permitId: string, dto: ActivatePermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== APPROVED_STATUS) {
      throw new ConflictException('Only approved permits can be activated');
    }

    this.requireReleased(permit);
    await this.requireExecutor(permitId, user);
    const start = await this.requireStartReady(detail, dto.start, user);

    const actualStartAt = dto.actualStartAt ? new Date(dto.actualStartAt) : new Date();

    const [existingExecution] = await this.db
      .select()
      .from(permitExecution)
      .where(eq(permitExecution.permitId, permitId));

    const result = await this.db.transaction(async (tx) => {
      let execution = existingExecution;
      if (execution) {
        const [updated] = await tx
          .update(permitExecution)
          .set({
            suspendedAt: null,
            suspendedBy: null,
            suspensionReason: null,
            resumedAt: null,
            resumedBy: null,
            updatedBy: user.id,
          })
          .where(eq(permitExecution.id, execution.id))
          .returning();
        execution = updated;
      } else {
        const [created] = await tx
          .insert(permitExecution)
          .values({
            permitId,
            activatedBy: user.id,
            actualStartAt,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning();
        execution = created;
      }

      await tx
        .update(permits)
        .set({ executionStart: start, updatedBy: user.id })
        .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));

      await this.statusTransitionService.transition(
        {
          permitId,
          tenantId,
          executionId: execution.id,
          action: 'activated',
          fromStatus: APPROVED_STATUS,
          toStatus: ACTIVE_STATUS,
          actorId: user.id,
          comment: dto.comment,
        },
        tx,
      );

      return execution;
    });

    await this.auditService.log({
      action: 'permit.activated',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
      metadata: { executionId: result.id, actualStartAt: actualStartAt.toISOString() },
    });

    await this.notificationService.enqueueExecutionNotification({
      permitId,
      tenantId,
      action: 'activated',
      actorId: user.id,
      metadata: { executionId: result.id },
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.executionCacheService.invalidatePermit(tenantId, permitId);

    this.executionLogService.logEvent({
      action: 'execution.activated',
      permitId,
      tenantId,
      userId: user.id,
      metadata: { executionId: result.id },
    });

    return { execution: result, permit: { ...permit, status: ACTIVE_STATUS } };
  }

  async suspend(permitId: string, dto: SuspendPermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== ACTIVE_STATUS && permit.status !== APPROVED_STATUS) {
      throw new ConflictException('Only approved or active permits can be suspended');
    }

    const [execution] = await this.db
      .select()
      .from(permitExecution)
      .where(eq(permitExecution.permitId, permitId));

    const suspendedAt = new Date();
    const fromStatus = permit.status;

    await this.db.transaction(async (tx) => {
      if (execution) {
        await tx
          .update(permitExecution)
          .set({
            suspendedAt,
            suspendedBy: user.id,
            suspensionReason: dto.reason,
            updatedBy: user.id,
          })
          .where(eq(permitExecution.id, execution.id));
      }

      await this.statusTransitionService.transition(
        {
          permitId,
          tenantId,
          executionId: execution?.id,
          action: 'suspended',
          fromStatus,
          toStatus: SUSPENDED_STATUS,
          actorId: user.id,
          comment: dto.reason,
        },
        tx,
      );
    });

    await this.auditService.log({
      action: 'permit.suspended',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
      metadata: { executionId: execution?.id ?? null, reason: dto.reason, fromStatus },
    });

    await this.notificationService.enqueueExecutionNotification({
      permitId,
      tenantId,
      action: 'suspended',
      actorId: user.id,
      metadata: { executionId: execution?.id ?? null },
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.executionCacheService.invalidatePermit(tenantId, permitId);

    this.executionLogService.logEvent({
      action: 'execution.suspended',
      permitId,
      tenantId,
      userId: user.id,
      metadata: { executionId: execution?.id ?? null, reason: dto.reason },
    });

    return {
      execution: execution
        ? { ...execution, suspendedAt, suspensionReason: dto.reason }
        : null,
      permit: { ...permit, status: SUSPENDED_STATUS },
    };
  }

  async revalidateAfterSuspension(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== SUSPENDED_STATUS) {
      throw new ConflictException('Only suspended permits can be revalidated');
    }

    const [execution] = await this.db
      .select()
      .from(permitExecution)
      .where(eq(permitExecution.permitId, permitId));

    await this.db.transaction(async (tx) => {
      if (execution) {
        await tx
          .update(permitExecution)
          .set({
            suspendedAt: null,
            suspendedBy: null,
            suspensionReason: null,
            updatedBy: user.id,
          })
          .where(eq(permitExecution.id, execution.id));
      }

      await this.statusTransitionService.transition(
        {
          permitId,
          tenantId,
          executionId: execution?.id,
          action: 'revalidated',
          fromStatus: SUSPENDED_STATUS,
          toStatus: 'pending_approval',
          actorId: user.id,
          comment: 'Revalidation after suspension — full approval required',
        },
        tx,
      );

      await tx
        .update(permits)
        .set({
          executionReleasedAt: null,
          executionReleasedBy: null,
          executionReleaseSiteReady: false,
          executionReleaseDetailsCorrect: false,
          updatedBy: user.id,
        })
        .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));

      await this.workflowEngine.initializeAtSubmit(
        permitId,
        tenantId,
        permit.permitTypeId,
        user.id,
        tx,
      );
    });

    await this.auditService.log({
      action: 'permit.revalidated_after_suspension',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.executionCacheService.invalidatePermit(tenantId, permitId);

    this.executionLogService.logEvent({
      action: 'execution.revalidated',
      permitId,
      tenantId,
      userId: user.id,
    });

    return this.permitService.findOne(permitId, user);
  }

  async resume(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== SUSPENDED_STATUS) {
      throw new ConflictException('Only suspended permits can be resumed');
    }

    const execution = await this.getExecution(permitId);

    if (!execution.suspendedAt) {
      throw new ConflictException('Permit has no suspension record to resume from');
    }

    const resumedAt = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(permitExecution)
        .set({
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
          resumedAt,
          resumedBy: user.id,
          updatedBy: user.id,
        })
        .where(eq(permitExecution.id, execution.id));

      await this.statusTransitionService.transition(
        {
          permitId,
          tenantId,
          executionId: execution.id,
          action: 'resumed',
          fromStatus: SUSPENDED_STATUS,
          toStatus: ACTIVE_STATUS,
          actorId: user.id,
        },
        tx,
      );
    });

    await this.auditService.log({
      action: 'permit.resumed',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
      metadata: { executionId: execution.id },
    });

    await this.notificationService.enqueueExecutionNotification({
      permitId,
      tenantId,
      action: 'resumed',
      actorId: user.id,
      metadata: { executionId: execution.id },
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.executionCacheService.invalidatePermit(tenantId, permitId);

    this.executionLogService.logEvent({
      action: 'execution.resumed',
      permitId,
      tenantId,
      userId: user.id,
      metadata: { executionId: execution.id },
    });

    return { execution: { ...execution, suspendedAt: null, resumedAt }, permit: { ...permit, status: ACTIVE_STATUS } };
  }

  async getExecutionForPermit(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.permitService.findOne(permitId, user);

    const cached = await this.executionCacheService.getExecutionDetail<
      Awaited<ReturnType<ExecutionService['loadExecution']>>
    >(tenantId, permitId);

    if (cached) {
      return cached;
    }

    const execution = await this.loadExecution(permitId);
    await this.executionCacheService.setExecutionDetail(tenantId, permitId, execution);
    return execution;
  }

  async listActive(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);

    const cached = await this.executionCacheService.getActiveList<
      Awaited<ReturnType<ExecutionService['loadActivePermits']>>
    >(tenantId, user.id);

    if (cached) {
      return cached;
    }

    const rows = await this.loadActivePermits(tenantId, user);
    await this.executionCacheService.setActiveList(tenantId, user.id, rows);
    return rows;
  }

  private async loadActivePermits(tenantId: string, user: AuthenticatedUser) {
    const visibility = await visiblePermitFilter(this.db, user, tenantId);
    return this.db
      .select()
      .from(permitExecution)
      .innerJoin(permits, eq(permitExecution.permitId, permits.id))
      .where(
        and(
          eq(permits.tenantId, tenantId),
          eq(permits.status, ACTIVE_STATUS),
          ...(visibility ? [visibility] : []),
        ),
      );
  }

  private async loadExecution(permitId: string) {
    return this.getExecution(permitId);
  }

  private async getExecution(permitId: string) {
    const [execution] = await this.db
      .select()
      .from(permitExecution)
      .where(eq(permitExecution.permitId, permitId));

    if (!execution) {
      throw new NotFoundException('Permit execution record not found');
    }

    return execution;
  }

  async completeExecution(permitId: string, dto: CompleteExecutionDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    if (detail.permit.status !== ACTIVE_STATUS) {
      throw new ConflictException('Only active permits can be marked execution completed');
    }

    const checklist = dto.checklist;
    if (!checklist.workDescribedComplete || !checklist.procedureFollowed) {
      throw new ConflictException('All execution completion checklist items must be completed');
    }
    if (detail.permit.lototoRequired && !checklist.lototoDone) {
      throw new ConflictException('LOTOTO must be completed before declaring execution complete');
    }
    if (detail.permit.gasTestingRequired && !checklist.gasTestingDone) {
      throw new ConflictException('Gas testing must be completed before declaring execution complete');
    }

    if (
      !isPrivilegedPermitViewer(user) &&
      !(user.roles.includes('permit-operator') && isPrimaryExecutor(detail, user.id))
    ) {
      throw new ForbiddenException('Only the primary executor can declare execution completed');
    }

    const [existing] = await this.db
      .select({ id: permitExecutionCompletions.id })
      .from(permitExecutionCompletions)
      .where(eq(permitExecutionCompletions.permitId, permitId));
    if (existing) {
      await this.db.delete(permitExecutionCompletions).where(eq(permitExecutionCompletions.permitId, permitId));
    }

    const completion = await this.db.transaction(async (tx) => {
      const [record] = await tx.insert(permitExecutionCompletions).values({
        permitId,
        completedBy: user.id,
        comment: dto.comment.trim(),
        checklist: { ...dto.checklist },
        createdBy: user.id,
        updatedBy: user.id,
      }).returning();
      await this.statusTransitionService.transition(
        {
          permitId,
          tenantId,
          action: 'execution_completed',
          fromStatus: ACTIVE_STATUS,
          toStatus: 'execution_completed',
          actorId: user.id,
          comment: dto.comment.trim(),
        },
        tx,
      );
      return record;
    });

    const recipients = [...new Set(
      [detail.permit.createdBy, detail.permit.submittedBy].filter(
        (id): id is string => Boolean(id) && id !== user.id,
      ),
    )];
    // LOTOTO stays with the operator until the remove sequence passes. The receiver is told then.
    if (!detail.permit.lototoRequired && recipients.length > 0 && this.inbox) {
      try {
        await this.inbox.generateSystem(tenantId, user.id, {
          eventType: 'task_reminder',
          category: 'workflow',
          title: `Work finished: ${detail.permit.title}`,
          body: `Permit "${detail.permit.title}" is finished. Check the work and confirm completion.`,
          recipientUserIds: recipients,
          entityType: 'permit',
          entityId: permitId,
          dedupeKey: `${tenantId}:permit:${permitId}:execution_completed:${completion.id}`,
          sourceModule: 'execution',
        });
      } catch {
        // The completion is already saved. A missed notice must not undo it.
      }
    }

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.executionCacheService.invalidatePermit(tenantId, permitId);
    await this.isolationCertificates?.notifyReadyForPermit(permitId, user.id);
    return this.permitService.findOne(permitId, user);
  }

  async sendBackToExecutor(permitId: string, dto: SendBackDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    if (detail.permit.status !== 'execution_completed') {
      throw new ConflictException('Only execution-completed permits can be sent back to the executor');
    }
    if (
      !isPrivilegedPermitViewer(user) &&
      !(user.roles.includes('permit-receiver') && isPermitIssuer(detail, user.id))
    ) {
      throw new ForbiddenException('Only the permit issuer can send this permit back to the executor');
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(permitExecutionCompletions).where(eq(permitExecutionCompletions.permitId, permitId));
      await this.statusTransitionService.transition(
        {
          permitId,
          tenantId,
          action: 'sent_back',
          fromStatus: 'execution_completed',
          toStatus: ACTIVE_STATUS,
          actorId: user.id,
          comment: dto.comment.trim(),
        },
        tx,
      );
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.executionCacheService.invalidatePermit(tenantId, permitId);
    return this.permitService.findOne(permitId, user);
  }

  async sendBackToIssuer(permitId: string, dto: SendBackDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    if (detail.permit.status !== 'pending_closure') {
      throw new ConflictException('Only pending-closure permits can be sent back to the issuer');
    }
    if (!isPrivilegedPermitViewer(user) && !user.roles.includes('permit-approver')) {
      throw new ForbiddenException('Only the HOD can send this permit back to the issuer');
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(permitVerifications).where(eq(permitVerifications.permitId, permitId));
      await this.statusTransitionService.transition(
        {
          permitId,
          tenantId,
          action: 'sent_back',
          fromStatus: 'pending_closure',
          toStatus: 'execution_completed',
          actorId: user.id,
          comment: dto.comment.trim(),
        },
        tx,
      );
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.executionCacheService.invalidatePermit(tenantId, permitId);
    return this.permitService.findOne(permitId, user);
  }

  async releaseForExecution(permitId: string, dto: ReleaseExecutionDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== APPROVED_STATUS) {
      throw new ConflictException('Only an approved permit can be released for execution');
    }
    if (!isPermitIssuer(detail, user.id)) {
      throw new ForbiddenException('Only the permit receiver can release this permit for execution');
    }
    if (permit.executionReleasedAt) {
      throw new ConflictException('This permit is already released for execution');
    }
    if (!dto.siteReady || !dto.detailsCorrect) {
      throw new BadRequestException('Confirm both checks before releasing the permit');
    }

    const comment =
      'Site is ready for execution. The approved work, place and people are still correct.';

    await this.db.transaction(async (tx) => {
      await tx
        .update(permits)
        .set({
          executionReleasedAt: new Date(),
          executionReleasedBy: user.id,
          executionReleaseSiteReady: true,
          executionReleaseDetailsCorrect: true,
          updatedBy: user.id,
        })
        .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));

      await this.statusTransitionService.transition(
        {
          permitId,
          tenantId,
          action: 'execution_released',
          fromStatus: APPROVED_STATUS,
          toStatus: APPROVED_STATUS,
          actorId: user.id,
          comment,
          metadata: { siteReady: true, detailsCorrect: true },
        },
        tx,
      );
    });

    await this.auditService.log({
      action: 'permit.execution_released',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
      metadata: { siteReady: true, detailsCorrect: true },
    });

    const recipients = detail.executors
      .map((row) => row.workforceUserId)
      .filter((id) => id !== user.id);
    if (recipients.length > 0 && this.inbox) {
      try {
        await this.inbox.generateSystem(tenantId, user.id, {
          eventType: 'task_reminder',
          category: 'workflow',
          title: `Released for execution: ${permit.title}`,
          body: `Permit "${permit.title}" is released. You can start the work.`,
          recipientUserIds: recipients,
          entityType: 'permit',
          entityId: permitId,
          dedupeKey: `${tenantId}:permit:${permitId}:execution_released`,
          sourceModule: 'execution',
        });
      } catch {
        // The release is already saved. A missed notice must not undo it.
      }
    }

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    return this.permitService.findOne(permitId, user);
  }

  async saveExecutionStart(permitId: string, dto: ExecutionStartDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    if (detail.permit.status !== APPROVED_STATUS) {
      throw new ConflictException('Start-of-execution steps can only be recorded on an approved permit');
    }
    this.requireReleased(detail.permit);
    await this.requireExecutor(permitId, user);
    const start = this.normaliseStart(dto);
    await this.db
      .update(permits)
      .set({ executionStart: start, updatedBy: user.id })
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));
    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    return { ...detail.permit, executionStart: start };
  }

  private normaliseStart(dto?: ExecutionStartDto | ExecutionStartState | null): ExecutionStartState {
    if (!dto) {
      return emptyExecutionStart();
    }
    return {
      toolboxTalk: Boolean(dto.toolboxTalk),
      hazardControls: [...(dto.hazardControls ?? [])],
      ppeIds: [...(dto.ppeIds ?? [])],
      lototoVerified: Boolean(dto.lototoVerified),
      gasReadings: (dto.gasReadings ?? []).map((row) => ({
        gasTestingCatalogueId: row.gasTestingCatalogueId,
        value: Number(row.value),
      })),
    };
  }

  private async requireStartReady(
    detail: Awaited<ReturnType<PermitService['findOne']>>,
    dtoStart: ExecutionStartDto | undefined,
    user: AuthenticatedUser,
  ): Promise<ExecutionStartState> {
    const saved = this.normaliseStart(detail.permit.executionStart as ExecutionStartState | undefined);
    const start = dtoStart ? this.normaliseStart(dtoStart) : saved;
    const hazardIds = [...new Set(detail.hazards.map((row) => row.hazardCategoryId).filter((id): id is string => Boolean(id)))];
    const catalogues = new Map<string, { controls?: string[] | null }>();
    if (hazardIds.length > 0) {
      const rows = await this.db
        .select({ id: hazardCategories.id, controls: hazardCategories.controls })
        .from(hazardCategories)
        .where(inArray(hazardCategories.id, hazardIds));
      for (const row of rows) {
        catalogues.set(row.id, { controls: row.controls });
      }
    }
    let lototoIsolated = !detail.permit.lototoRequired;
    if (detail.permit.lototoRequired) {
      await this.lototoExecutionService.assertIsolationReadyToStart(detail.permit.id, user);
      lototoIsolated = true;
    }
    assertExecutionStartReady({
      start,
      lototoRequired: Boolean(detail.permit.lototoRequired),
      gasTestingRequired: Boolean(detail.permit.gasTestingRequired),
      lototoIsolated,
      requiredHazardKeys: requiredHazardControlKeys(
        detail.hazards.filter((row): row is typeof row & { hazardCategoryId: string } => Boolean(row.hazardCategoryId)),
        catalogues,
      ),
      requiredPpeIds: detail.ppe.map((row) => row.ppeCatalogueId),
      gasItems: detail.gasTesting
        .filter((row) => !row.removedReason?.trim())
        .map((row) => ({
          gasTestingCatalogueId: row.gasTestingCatalogueId ?? row.id,
          parameter: row.parameter,
          minimum: row.minimum,
          maximum: row.maximum,
          unit: row.unit,
        })),
    });
    return start;
  }

  private requireReleased(permit: { executionReleasedAt: Date | null }) {
    if (!permit.executionReleasedAt) {
      throw new ConflictException('The receiver must release this permit before work can start');
    }
  }

  private async requireExecutor(permitId: string, user: AuthenticatedUser) {
    if (user.roles.includes('platform-admin') || isTenantPrivileged(user.roles)) {
      return;
    }

    const [executor] = await this.db
      .select()
      .from(permitExecutors)
      .where(
        and(eq(permitExecutors.permitId, permitId), eq(permitExecutors.workforceUserId, user.id)),
      );

    if (!executor) {
      throw new ForbiddenException('You are not assigned as an executor for this permit');
    }
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
