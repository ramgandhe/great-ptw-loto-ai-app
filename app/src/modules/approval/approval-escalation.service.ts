import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, lte } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permits, workflowAssignments, workflowSteps } from '../../database/schema';
import { ApprovalHistoryService } from './approval-history.service';
import { ApprovalCacheService } from './approval-cache.service';
import { ApprovalLogService } from './approval-log.service';
import { PENDING_APPROVAL_STATUS } from './approval.constants';
import { evaluateEscalation, MAX_APPROVAL_ESCALATION_LEVELS } from './escalation-rules';
import { NotificationService } from './notification.service';

@Injectable()
export class ApprovalEscalationService {
  private readonly logger = new Logger(ApprovalEscalationService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly approvalHistoryService: ApprovalHistoryService,
    private readonly notificationService: NotificationService,
    private readonly approvalCacheService: ApprovalCacheService,
    private readonly approvalLogService: ApprovalLogService,
  ) {}

  /** Process all SLA-breached active assignments. Returns counts. */
  async processDueEscalations(now = new Date()): Promise<{
    escalated: number;
    blocked: number;
    skipped: number;
  }> {
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
          eq(permits.status, PENDING_APPROVAL_STATUS),
          eq(workflowAssignments.status, 'active'),
          isNull(workflowAssignments.slaPausedAt),
          isNull(permits.approvalBlockedAt),
          lte(workflowAssignments.slaDueAt, now),
        ),
      );

    let escalated = 0;
    let blocked = 0;
    let skipped = 0;

    for (const row of rows) {
      const evaluation = evaluateEscalation({
        now,
        slaDueAt: row.assignment.slaDueAt,
        slaPausedAt: row.assignment.slaPausedAt,
        escalationLevel: row.assignment.escalationLevel,
        fallbackRoles: row.step.escalationFallbackRoles,
      });

      if (evaluation.action === 'none') {
        skipped += 1;
        continue;
      }

      if (evaluation.action === 'block') {
        await this.flagBlocked(row.permit, row.assignment.id, now);
        blocked += 1;
        continue;
      }

      await this.escalateAssignment(row, evaluation.nextLevel, evaluation.fallbackRole, now);
      escalated += 1;
    }

    this.logger.log(
      `Escalation sweep: escalated=${escalated} blocked=${blocked} skipped=${skipped} (maxLevels=${MAX_APPROVAL_ESCALATION_LEVELS})`,
    );

    return { escalated, blocked, skipped };
  }

  private async escalateAssignment(
    row: {
      assignment: typeof workflowAssignments.$inferSelect;
      step: typeof workflowSteps.$inferSelect;
      permit: typeof permits.$inferSelect;
    },
    nextLevel: number,
    fallbackRole: string | null,
    now: Date,
  ) {
    const slaMinutes = row.step.slaMinutes ?? 120;
    const nextDue = new Date(now.getTime() + slaMinutes * 60_000);

    await this.db
      .update(workflowAssignments)
      .set({
        escalationLevel: nextLevel,
        escalatedToRole: fallbackRole,
        slaDueAt: nextDue,
        updatedBy: row.assignment.assigneeId,
      })
      .where(eq(workflowAssignments.id, row.assignment.id));

    await this.approvalHistoryService.record({
      permitId: row.permit.id,
      action: 'escalated',
      fromStatus: row.permit.status,
      toStatus: row.permit.status,
      actorId: row.assignment.assigneeId,
      workflowStepId: row.step.id,
      metadata: {
        escalationLevel: nextLevel,
        fallbackRole,
        timeSensitive: true,
        distinctFromOriginalRequest: true,
      },
      createdBy: row.assignment.assigneeId,
    });

    // FR-PTW-021 — distinct time-sensitive escalation notification.
    await this.notificationService.enqueueApprovalNotification({
      permitId: row.permit.id,
      tenantId: row.permit.tenantId,
      action: 'escalation',
      actorId: row.assignment.assigneeId,
      metadata: {
        timeSensitive: true,
        escalationLevel: nextLevel,
        fallbackRole,
        distinctFromOriginalRequest: true,
      },
    });

    this.approvalLogService.logEvent({
      action: 'approval.escalated',
      permitId: row.permit.id,
      tenantId: row.permit.tenantId,
      userId: row.assignment.assigneeId,
      metadata: { escalationLevel: nextLevel, fallbackRole },
    });

    await this.approvalCacheService.invalidateTenant(row.permit.tenantId);
  }

  private async flagBlocked(
    permit: typeof permits.$inferSelect,
    assignmentId: string,
    now: Date,
  ) {
    await this.db
      .update(permits)
      .set({
        approvalBlockedAt: now,
        approvalBlockedReason: `Exceeded ${MAX_APPROVAL_ESCALATION_LEVELS} escalation levels without response`,
        updatedAt: now,
      })
      .where(eq(permits.id, permit.id));

    await this.db
      .update(workflowAssignments)
      .set({
        updatedAt: now,
      })
      .where(eq(workflowAssignments.id, assignmentId));

    await this.approvalHistoryService.record({
      permitId: permit.id,
      action: 'blocked',
      fromStatus: permit.status,
      toStatus: permit.status,
      actorId: permit.submittedBy ?? permit.createdBy ?? permit.id,
      metadata: {
        maxEscalationLevels: MAX_APPROVAL_ESCALATION_LEVELS,
        flaggedToAdministrator: true,
      },
      createdBy: permit.submittedBy ?? permit.createdBy ?? undefined,
    });

    await this.notificationService.enqueueApprovalNotification({
      permitId: permit.id,
      tenantId: permit.tenantId,
      action: 'blocked',
      actorId: permit.submittedBy ?? permit.createdBy ?? permit.id,
      metadata: {
        timeSensitive: true,
        flaggedToAdministrator: true,
        maxEscalationLevels: MAX_APPROVAL_ESCALATION_LEVELS,
      },
    });

    this.approvalLogService.logEvent({
      action: 'approval.blocked',
      permitId: permit.id,
      tenantId: permit.tenantId,
      metadata: { maxEscalationLevels: MAX_APPROVAL_ESCALATION_LEVELS },
    });

    await this.approvalCacheService.invalidateTenant(permit.tenantId);
  }
}
