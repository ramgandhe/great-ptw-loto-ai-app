import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permitExecution, permitExecutors, permitExecutionCompletions, permitVerifications, permits } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { WorkflowEngineService } from '../approval/workflow-engine.service';
import { PermitCacheService } from '../permit/permit-cache.service';
import { PermitService } from '../permit/permit.service';
import {
  ACTIVE_STATUS,
  APPROVED_STATUS,
  SUSPENDED_STATUS,
} from './execution.constants';
import { ActivatePermitDto } from './dto/activate-permit.dto';
import { CompleteExecutionDto, SendBackDto } from './dto/complete-execution.dto';
import { isPrimaryExecutor, isPermitIssuer, isPrivilegedPermitViewer, visiblePermitFilter } from '../permit/permit-access';
import { SuspendPermitDto } from './dto/suspend-permit.dto';
import { ExecutionCacheService } from './execution-cache.service';
import { ExecutionLogService } from './execution-log.service';
import { NotificationService } from './notification.service';
import { StatusTransitionService } from './status-transition.service';

@Injectable()
export class ExecutionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly statusTransitionService: StatusTransitionService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
    private readonly executionCacheService: ExecutionCacheService,
    private readonly executionLogService: ExecutionLogService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  async activate(permitId: string, dto: ActivatePermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== APPROVED_STATUS) {
      throw new ConflictException('Only approved permits can be activated');
    }

    await this.requireExecutor(permitId, user);

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
    if (
      !checklist.workDescribedComplete ||
      !checklist.procedureFollowed ||
      !checklist.lototoDone ||
      !checklist.gasTestingDone
    ) {
      throw new ConflictException('All execution completion checklist items must be completed');
    }

    if (
      !isPrivilegedPermitViewer(user) &&
      !(user.roles.includes('operator') && isPrimaryExecutor(detail, user.id))
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

    await this.db.transaction(async (tx) => {
      await tx.insert(permitExecutionCompletions).values({
        permitId,
        completedBy: user.id,
        comment: dto.comment.trim(),
        checklist: { ...dto.checklist },
        createdBy: user.id,
        updatedBy: user.id,
      });
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
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.executionCacheService.invalidatePermit(tenantId, permitId);
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
      !(user.roles.includes('job-issuer') && isPermitIssuer(detail, user.id))
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
    if (!isPrivilegedPermitViewer(user) && !user.roles.includes('hod')) {
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
