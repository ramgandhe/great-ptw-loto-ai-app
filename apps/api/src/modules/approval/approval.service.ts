import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  permitApprovals,
  permits,
  workflowAssignments,
  workflowSteps,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { PermitCacheService } from '../permit/permit-cache.service';
import { PermitService } from '../permit/permit.service';
import { ApprovalCacheService } from './approval-cache.service';
import { ApprovalLogService } from './approval-log.service';
import { PENDING_APPROVAL_STATUS } from './approval.constants';
import { ApprovalHistoryService } from './approval-history.service';
import { ApprovePermitDto } from './dto/approve-permit.dto';
import { DeferPermitDto } from './dto/defer-permit.dto';
import { RejectPermitDto } from './dto/reject-permit.dto';
import { NotificationService } from './notification.service';
import { WorkflowEngineService } from './workflow-engine.service';

@Injectable()
export class ApprovalService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly approvalHistoryService: ApprovalHistoryService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
    private readonly approvalCacheService: ApprovalCacheService,
    private readonly approvalLogService: ApprovalLogService,
  ) {}

  async listPending(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);

    const cached = await this.approvalCacheService.getPendingList<
      Awaited<ReturnType<ApprovalService['loadPending']>>
    >(tenantId, user.id);

    if (cached) {
      return cached;
    }

    const rows = await this.loadPending(tenantId, user);
    await this.approvalCacheService.setPendingList(tenantId, user.id, rows);
    return rows;
  }

  private async loadPending(tenantId: string, user: AuthenticatedUser) {
    const rows = await this.db
      .select({
        assignment: workflowAssignments,
        step: workflowSteps,
        permit: permits,
      })
      .from(workflowAssignments)
      .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
      .innerJoin(permits, eq(workflowAssignments.permitId, permits.id))
      .where(
        and(
          eq(permits.tenantId, tenantId),
          eq(permits.status, PENDING_APPROVAL_STATUS),
          eq(workflowAssignments.status, 'active'),
          eq(workflowAssignments.assigneeId, user.id),
        ),
      );

    return rows.filter((row) =>
      this.workflowEngine.userHasApproverRole(user.roles, row.step.approverRole),
    );
  }

  async review(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);

    if (detail.permit.status === PENDING_APPROVAL_STATUS) {
      await this.workflowEngine.ensureAssignmentsInitialized(
        permitId,
        tenantId,
        detail.permit.permitTypeId,
        user.id,
      );
    }

    const workflow = await this.workflowEngine.listAssignmentsForPermit(permitId);
    const active = await this.workflowEngine.getActiveAssignmentWithStep(permitId);
    const decisions = await this.db
      .select()
      .from(permitApprovals)
      .where(eq(permitApprovals.permitId, permitId));

    return {
      ...detail,
      workflow,
      activeAssignment: active,
      decisions,
    };
  }

  async approve(permitId: string, dto: ApprovePermitDto, user: AuthenticatedUser) {
    const context = await this.prepareDecision(permitId, user, 'approve');
    const { permit, assignment, step } = context;

    if (step.commentRequiredOnApprove && !dto.comment?.trim()) {
      throw new BadRequestException('Approval comment is required for this workflow step');
    }

    await this.db.transaction(async (tx) => {
      const [approval] = await tx
        .insert(permitApprovals)
        .values({
          permitId,
          workflowStepId: step.id,
          workflowAssignmentId: assignment.id,
          decision: 'approve',
          comment: dto.comment,
          decidedBy: user.id,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.workflowEngine.completeAssignment(assignment.id, user.id, tx);

      const hasNext = await this.workflowEngine.hasNextStep(permitId, step.stepSequence, tx);

      if (hasNext) {
        await this.workflowEngine.activateNextStep(permitId, step.stepSequence, user.id, tx);
        await this.approvalHistoryService.record(
          {
            permitId,
            action: 'stage_advanced',
            fromStatus: permit.status,
            toStatus: PENDING_APPROVAL_STATUS,
            actorId: user.id,
            comment: dto.comment,
            workflowStepId: step.id,
            permitApprovalId: approval.id,
            createdBy: user.id,
          },
          tx,
        );
      } else {
        await tx
          .update(permits)
          .set({ status: 'approved', updatedBy: user.id })
          .where(and(eq(permits.id, permitId), eq(permits.tenantId, permit.tenantId)));

        await this.approvalHistoryService.record(
          {
            permitId,
            action: 'approved',
            fromStatus: permit.status,
            toStatus: 'approved',
            actorId: user.id,
            comment: dto.comment,
            workflowStepId: step.id,
            permitApprovalId: approval.id,
            createdBy: user.id,
          },
          tx,
        );
      }

      await this.auditService.log({
        action: 'permit.approved',
        entityType: 'permit',
        entityId: permitId,
        userId: user.id,
        tenantId: permit.tenantId,
        metadata: { workflowStepId: step.id, final: !hasNext },
      });

      await this.notificationService.enqueueApprovalNotification({
        permitId,
        tenantId: permit.tenantId,
        action: hasNext ? 'stage_advanced' : 'approved',
        actorId: user.id,
        metadata: { workflowStepId: step.id },
      });

      await this.permitCacheService.invalidatePermit(permit.tenantId, permitId);
      await this.approvalCacheService.invalidateTenant(permit.tenantId);

      this.approvalLogService.logEvent({
        action: hasNext ? 'approval.stage_advanced' : 'approval.approved',
        permitId,
        tenantId: permit.tenantId,
        userId: user.id,
        metadata: { workflowStepId: step.id, final: !hasNext },
      });
    });

    return this.review(permitId, user);
  }

  async reject(permitId: string, dto: RejectPermitDto, user: AuthenticatedUser) {
    const context = await this.prepareDecision(permitId, user, 'reject');
    const { permit, assignment, step } = context;

    if (step.commentRequiredOnReject && !dto.comment?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    return this.recordTerminalDecision({
      permitId,
      permit,
      assignment,
      step,
      user,
      decision: 'reject',
      historyAction: 'rejected',
      toStatus: 'rejected',
      comment: dto.comment,
      auditAction: 'permit.rejected',
      notificationAction: 'rejected',
    });
  }

  async defer(permitId: string, dto: DeferPermitDto, user: AuthenticatedUser) {
    const context = await this.prepareDecision(permitId, user, 'defer');
    const { permit, assignment, step } = context;

    if (step.commentRequiredOnDefer && !dto.comment?.trim()) {
      throw new BadRequestException('Deferral comment is required');
    }

    return this.recordTerminalDecision({
      permitId,
      permit,
      assignment,
      step,
      user,
      decision: 'defer',
      historyAction: 'deferred',
      toStatus: 'deferred',
      comment: dto.comment,
      auditAction: 'permit.deferred',
      notificationAction: 'deferred',
    });
  }

  async getHistory(permitId: string, user: AuthenticatedUser) {
    await this.permitService.findOne(permitId, user);
    return this.approvalHistoryService.findByPermit(permitId);
  }

  private async prepareDecision(
    permitId: string,
    user: AuthenticatedUser,
    decision: 'approve' | 'reject' | 'defer',
  ) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== PENDING_APPROVAL_STATUS) {
      throw new ConflictException(`Cannot ${decision} a permit that is not pending approval`);
    }

    await this.workflowEngine.ensureAssignmentsInitialized(
      permitId,
      tenantId,
      permit.permitTypeId,
      user.id,
    );

    const active = await this.workflowEngine.getActiveAssignmentWithStep(permitId);
    if (!active) {
      throw new ConflictException('No active workflow step for this permit');
    }

    const { assignment, step } = active;

    if (assignment.assigneeId !== user.id) {
      throw new ForbiddenException('You are not assigned to the current approval step');
    }

    if (!this.workflowEngine.userHasApproverRole(user.roles, step.approverRole)) {
      throw new ForbiddenException('You do not have permission to act on this approval step');
    }

    const [existing] = await this.db
      .select()
      .from(permitApprovals)
      .where(
        and(eq(permitApprovals.permitId, permitId), eq(permitApprovals.workflowStepId, step.id)),
      );

    if (existing) {
      throw new ConflictException('This approval step has already been decided');
    }

    return { permit, assignment, step };
  }

  private async recordTerminalDecision(params: {
    permitId: string;
    permit: typeof permits.$inferSelect;
    assignment: typeof workflowAssignments.$inferSelect;
    step: typeof workflowSteps.$inferSelect;
    user: AuthenticatedUser;
    decision: 'reject' | 'defer';
    historyAction: 'rejected' | 'deferred';
    toStatus: 'rejected' | 'deferred';
    comment: string;
    auditAction: string;
    notificationAction: string;
  }) {
    const {
      permitId,
      permit,
      assignment,
      step,
      user,
      decision,
      historyAction,
      toStatus,
      comment,
      auditAction,
      notificationAction,
    } = params;

    await this.db.transaction(async (tx) => {
      const [approval] = await tx
        .insert(permitApprovals)
        .values({
          permitId,
          workflowStepId: step.id,
          workflowAssignmentId: assignment.id,
          decision,
          comment,
          decidedBy: user.id,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.workflowEngine.completeAssignment(assignment.id, user.id, tx);

      await tx
        .update(permits)
        .set({ status: toStatus, updatedBy: user.id })
        .where(and(eq(permits.id, permitId), eq(permits.tenantId, permit.tenantId)));

      await this.approvalHistoryService.record(
        {
          permitId,
          action: historyAction,
          fromStatus: permit.status,
          toStatus,
          actorId: user.id,
          comment,
          workflowStepId: step.id,
          permitApprovalId: approval.id,
          createdBy: user.id,
        },
        tx,
      );

      await this.auditService.log({
        action: auditAction,
        entityType: 'permit',
        entityId: permitId,
        userId: user.id,
        tenantId: permit.tenantId,
        metadata: { workflowStepId: step.id },
      });

      await this.notificationService.enqueueApprovalNotification({
        permitId,
        tenantId: permit.tenantId,
        action: notificationAction,
        actorId: user.id,
        metadata: { workflowStepId: step.id },
      });

      await this.permitCacheService.invalidatePermit(permit.tenantId, permitId);
      await this.approvalCacheService.invalidateTenant(permit.tenantId);

      this.approvalLogService.logEvent({
        action: `approval.${historyAction}`,
        permitId,
        tenantId: permit.tenantId,
        userId: user.id,
        metadata: { workflowStepId: step.id },
      });
    });

    return this.review(permitId, user);
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
