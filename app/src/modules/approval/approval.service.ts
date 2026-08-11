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
import { PENDING_APPROVAL_STATUS, HOD_INITIAL_REVIEW_ACTION, userHasHodRole } from './approval.constants';
import { ApprovalHistoryService } from './approval-history.service';
import { ApprovePermitDto } from './dto/approve-permit.dto';
import { DeferPermitDto } from './dto/defer-permit.dto';
import { RejectPermitDto } from './dto/reject-permit.dto';
import { SafetyOfficerVetoDto } from './dto/safety-officer-veto.dto';
import { NotificationService } from './notification.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { PermitLifecycleService } from '../permit/permit-lifecycle.service';
import { DelegationService } from './delegation.service';

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
    private readonly permitLifecycleService: PermitLifecycleService,
    private readonly delegationService: DelegationService,
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
        ),
      );

    return rows.filter((row) =>
      this.workflowEngine.userHasApproverRole(user.roles, row.step.approverRole),
    );
  }

  async review(permitId: string, user: AuthenticatedUser) {
    this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);

    if (
      detail.permit.status === PENDING_APPROVAL_STATUS &&
      (await this.workflowEngine.listAssignmentsForPermit(permitId)).length === 0
    ) {
      await this.workflowEngine.initializeAtSubmit(
        permitId,
        detail.permit.tenantId,
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
      ...(await this.permitService.findOne(permitId, user)),
      workflow,
      activeAssignment: active,
      decisions,
    };
  }

  async approve(permitId: string, dto: ApprovePermitDto, user: AuthenticatedUser) {
    const context = await this.prepareDecision(permitId, user, 'approve');
    const { permit, assignment, step, onBehalfOf } = context;

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
          onBehalfOf,
          decidedBy: user.id,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.workflowEngine.completeAssignment(assignment.id, user.id, tx);

      const resolution = await this.workflowEngine.resolveAfterApprove(
        permitId,
        step,
        user.id,
        tx,
      );
      const isHod = userHasHodRole(user.roles) || Boolean(onBehalfOf);

      if (resolution.advanced) {
        await this.approvalHistoryService.record(
          {
            permitId,
            action: isHod && !onBehalfOf ? HOD_INITIAL_REVIEW_ACTION : 'stage_advanced',
            fromStatus: permit.status,
            toStatus: PENDING_APPROVAL_STATUS,
            actorId: user.id,
            comment: dto.comment,
            workflowStepId: step.id,
            permitApprovalId: approval.id,
            metadata: {
              ...(isHod && !onBehalfOf ? { decisionKind: HOD_INITIAL_REVIEW_ACTION } : {}),
              stageAdvanced: true,
              ...(onBehalfOf
                ? {
                    onBehalfOf,
                    approvedByXOnBehalfOfY: true,
                    actorLabel: `approved by ${user.id} on behalf of ${onBehalfOf}`,
                  }
                : {}),
            },
            createdBy: user.id,
          },
          tx,
        );
      } else if (resolution.final && resolution.stageComplete) {
        this.permitLifecycleService.assertTransition(permit.status, 'approved');

        await tx
          .update(permits)
          .set({ status: 'approved', updatedBy: user.id })
          .where(and(eq(permits.id, permitId), eq(permits.tenantId, permit.tenantId)));

        await this.approvalHistoryService.record(
          {
            permitId,
            action: isHod && !onBehalfOf ? HOD_INITIAL_REVIEW_ACTION : 'approved',
            fromStatus: permit.status,
            toStatus: 'approved',
            actorId: user.id,
            comment: dto.comment,
            workflowStepId: step.id,
            permitApprovalId: approval.id,
            metadata: {
              ...(isHod && !onBehalfOf
                ? { decisionKind: HOD_INITIAL_REVIEW_ACTION, final: true }
                : { final: true }),
              ...(onBehalfOf
                ? {
                    onBehalfOf,
                    approvedByXOnBehalfOfY: true,
                    actorLabel: `approved by ${user.id} on behalf of ${onBehalfOf}`,
                  }
                : {}),
            },
            createdBy: user.id,
          },
          tx,
        );
      } else {
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
            metadata: {
              parallelPending: true,
              stageComplete: false,
              ...(onBehalfOf
                ? {
                    onBehalfOf,
                    approvedByXOnBehalfOfY: true,
                    actorLabel: `approved by ${user.id} on behalf of ${onBehalfOf}`,
                  }
                : {}),
            },
            createdBy: user.id,
          },
          tx,
        );
      }

      const advancedOrPartial = resolution.advanced || !resolution.stageComplete;
      const finalized = resolution.final && resolution.stageComplete;

      await this.auditService.log({
        action:
          isHod && !onBehalfOf ? `permit.${HOD_INITIAL_REVIEW_ACTION}` : 'permit.approved',
        entityType: 'permit',
        entityId: permitId,
        userId: user.id,
        tenantId: permit.tenantId,
        metadata: {
          workflowStepId: step.id,
          final: finalized,
          onBehalfOf,
          ...(onBehalfOf
            ? { actorLabel: `approved by ${user.id} on behalf of ${onBehalfOf}` }
            : {}),
        },
      });

      await this.notificationService.enqueueApprovalNotification({
        permitId,
        tenantId: permit.tenantId,
        action: finalized ? 'approved' : 'stage_advanced',
        actorId: user.id,
        metadata: { workflowStepId: step.id, onBehalfOf },
      });

      await this.permitCacheService.invalidatePermit(permit.tenantId, permitId);
      await this.approvalCacheService.invalidateTenant(permit.tenantId);

      this.approvalLogService.logEvent({
        action: finalized
          ? 'approval.approved'
          : advancedOrPartial
            ? 'approval.stage_advanced'
            : 'approval.approved',
        permitId,
        tenantId: permit.tenantId,
        userId: user.id,
        metadata: { workflowStepId: step.id, final: finalized, onBehalfOf },
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
      reasonCode: dto.reasonCode,
      auditAction: 'permit.rejected',
      notificationAction: 'rejected',
      onBehalfOf: context.onBehalfOf,
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
      pauseSla: true,
      onBehalfOf: context.onBehalfOf,
    });
  }

  /** FR-ROL-002: Safety Officer hard override — cancels permit before closure. */
  async safetyOfficerVeto(permitId: string, dto: SafetyOfficerVetoDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status === 'closed') {
      throw new ConflictException('Cannot veto a closed permit');
    }

    if (permit.status === 'rejected') {
      throw new ConflictException('Permit is already rejected');
    }

    this.permitLifecycleService.assertTransition(permit.status, 'rejected');

    await this.db.transaction(async (tx) => {
      await tx
        .update(permits)
        .set({ status: 'rejected', updatedBy: user.id })
        .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));

      await this.workflowEngine.resetWorkflow(permitId, tx);

      await this.approvalHistoryService.record(
        {
          permitId,
          action: 'rejected',
          fromStatus: permit.status,
          toStatus: 'rejected',
          actorId: user.id,
          comment: dto.comment,
          metadata: { safetyOfficerVeto: true, hardOverride: true },
          createdBy: user.id,
        },
        tx,
      );

      await this.auditService.log({
        action: 'permit.safety_officer_veto',
        entityType: 'permit',
        entityId: permitId,
        userId: user.id,
        tenantId,
        metadata: { fromStatus: permit.status },
      });

      await this.notificationService.enqueueApprovalNotification({
        permitId,
        tenantId,
        action: 'rejected',
        actorId: user.id,
        metadata: { safetyOfficerVeto: true },
      });

      await this.permitCacheService.invalidatePermit(tenantId, permitId);
      await this.approvalCacheService.invalidateTenant(tenantId);

      this.approvalLogService.logEvent({
        action: 'approval.safety_officer_veto',
        permitId,
        tenantId,
        userId: user.id,
        metadata: { fromStatus: permit.status },
      });
    });

    return this.review(permitId, user);
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
    this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== PENDING_APPROVAL_STATUS) {
      throw new ConflictException(`Cannot ${decision} a permit that is not pending approval`);
    }

    if (permit.approvalBlockedAt) {
      throw new ConflictException(
        'Permit approval is blocked after maximum SLA escalations; Administrator intervention required',
      );
    }

    const existingAssignments = await this.workflowEngine.listAssignmentsForPermit(permitId);
    if (existingAssignments.length === 0) {
      await this.workflowEngine.initializeAtSubmit(
        permitId,
        permit.tenantId,
        permit.permitTypeId,
        user.id,
      );
    }

    const active = await this.workflowEngine.getActiveAssignmentWithStep(permitId);
    if (!active) {
      throw new ConflictException('No active workflow step for this permit');
    }

    const { assignment, step } = active;

    let onBehalfOf: string | null = null;
    const hasRole = this.workflowEngine.userHasApproverRole(user.roles, step.approverRole);

    if (!hasRole) {
      const delegation = await this.delegationService.findActiveForDelegate(
        permit.tenantId,
        user.id,
        step.approverRole,
      );
      if (!delegation) {
        throw new ForbiddenException(
          `You do not have permission to act on this approval step. Required role: ${step.approverRole}`,
        );
      }
      onBehalfOf = delegation.delegatorId;
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

    return { permit, assignment, step, onBehalfOf };
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
    reasonCode?: string;
    auditAction: string;
    notificationAction: string;
    pauseSla?: boolean;
    onBehalfOf?: string | null;
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
      reasonCode,
      auditAction,
      notificationAction,
      pauseSla,
      onBehalfOf,
    } = params;

    this.permitLifecycleService.assertTransition(permit.status, toStatus);

    await this.db.transaction(async (tx) => {
      const [approval] = await tx
        .insert(permitApprovals)
        .values({
          permitId,
          workflowStepId: step.id,
          workflowAssignmentId: assignment.id,
          decision,
          comment,
          reasonCode: reasonCode ?? null,
          onBehalfOf: onBehalfOf ?? null,
          decidedBy: user.id,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.workflowEngine.completeAssignment(assignment.id, user.id, tx);

      if (pauseSla) {
        await this.workflowEngine.pauseSla(assignment.id, user.id, tx);
      }

      // FR-PTW-028: any reject in a parallel group rejects the whole stage.
      if (decision === 'reject' && step.parallelGroup) {
        const peers = await tx
          .select({ id: workflowAssignments.id })
          .from(workflowAssignments)
          .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
          .where(
            and(
              eq(workflowAssignments.permitId, permitId),
              eq(workflowSteps.parallelGroup, step.parallelGroup),
              eq(workflowAssignments.status, 'active'),
            ),
          );

        for (const peer of peers) {
          await tx
            .update(workflowAssignments)
            .set({ status: 'skipped', completedAt: new Date(), updatedBy: user.id })
            .where(eq(workflowAssignments.id, peer.id));
        }
      }

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
          metadata: reasonCode ? { reasonCode, slaPaused: Boolean(pauseSla) } : { slaPaused: Boolean(pauseSla) },
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
        metadata: { workflowStepId: step.id, reasonCode },
      });

      await this.notificationService.enqueueApprovalNotification({
        permitId,
        tenantId: permit.tenantId,
        action: notificationAction,
        actorId: user.id,
        metadata: { workflowStepId: step.id, reasonCode },
      });

      await this.permitCacheService.invalidatePermit(permit.tenantId, permitId);
      await this.approvalCacheService.invalidateTenant(permit.tenantId);

      this.approvalLogService.logEvent({
        action: `approval.${historyAction}`,
        permitId,
        tenantId: permit.tenantId,
        userId: user.id,
        metadata: { workflowStepId: step.id, reasonCode },
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
