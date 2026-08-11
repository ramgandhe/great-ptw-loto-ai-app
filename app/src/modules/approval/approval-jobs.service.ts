import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { Job } from 'bullmq';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  approvalSlaEscalations,
  permits,
  workflowAssignments,
  workflowSteps,
} from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  APPROVAL_NOTIFICATION_JOB,
  APPROVAL_REMINDER_JOB,
  APPROVAL_SLA_ESCALATION_JOB,
  MAX_SLA_ESCALATION_LEVELS,
  PENDING_APPROVAL_STATUS,
} from './approval.constants';
import { ApprovalCacheService } from './approval-cache.service';
import { ApprovalHistoryService } from './approval-history.service';
import { ApprovalLogService } from './approval-log.service';
import type { ApprovalNotificationPayload } from './notification.service';

@Injectable()
export class ApprovalJobsService implements OnModuleInit {
  private readonly logger = new Logger(ApprovalJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly approvalLogService: ApprovalLogService,
    private readonly approvalCacheService: ApprovalCacheService,
    private readonly approvalHistoryService: ApprovalHistoryService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(APPROVAL_NOTIFICATION_JOB, async (job) => {
      await this.processNotification(job);
    });

    this.queueService.registerHandler(APPROVAL_REMINDER_JOB, async () => {
      await this.sendReminders();
    });

    this.queueService.registerHandler(APPROVAL_SLA_ESCALATION_JOB, async () => {
      await this.escalateOverdueSlas();
    });

    const reminderCron = this.configService.get<string>('approval.reminderCron') ?? '0 8 * * *';
    const slaCron =
      this.configService.get<string>('approval.slaEscalationCron') ?? '0 * * * *';

    try {
      await this.queueService.getQueue().add(
        APPROVAL_REMINDER_JOB,
        {},
        {
          repeat: { pattern: reminderCron },
          jobId: 'approval-reminder-schedule',
        },
      );
      await this.queueService.getQueue().add(
        APPROVAL_SLA_ESCALATION_JOB,
        {},
        {
          repeat: { pattern: slaCron },
          jobId: 'approval-sla-escalation-schedule',
        },
      );
      this.logger.log(
        `Scheduled approval reminder (${reminderCron}) and SLA escalation (${slaCron}) jobs`,
      );
    } catch (error) {
      this.logger.warn('Could not schedule approval background jobs');
      this.logger.debug(error);
    }
  }

  async processNotification(job: Job<ApprovalNotificationPayload>): Promise<void> {
    const payload = job.data;

    this.approvalLogService.logEvent({
      action: `approval.notification.${payload.action}`,
      permitId: payload.permitId,
      tenantId: payload.tenantId,
      userId: payload.actorId,
      metadata: payload.metadata,
    });

    await this.approvalCacheService.invalidateTenant(payload.tenantId);
  }

  async sendReminders(): Promise<number> {
    const rows = await this.db
      .select({
        permitId: permits.id,
        tenantId: permits.tenantId,
        assigneeId: workflowAssignments.assigneeId,
      })
      .from(workflowAssignments)
      .innerJoin(permits, eq(workflowAssignments.permitId, permits.id))
      .where(
        and(
          eq(permits.status, PENDING_APPROVAL_STATUS),
          eq(workflowAssignments.status, 'active'),
        ),
      );

    if (rows.length === 0) {
      return 0;
    }

    const queue = this.queueService.getQueue();

    for (const row of rows) {
      await queue.add(APPROVAL_NOTIFICATION_JOB, {
        permitId: row.permitId,
        tenantId: row.tenantId,
        action: 'reminder',
        actorId: row.assigneeId,
      } satisfies ApprovalNotificationPayload);
    }

    this.logger.log(`Enqueued ${rows.length} approval reminder notifications`);
    return rows.length;
  }

  async escalateOverdueSlas(): Promise<number> {
    const now = new Date();

    const rows = await this.db
      .select({
        assignment: workflowAssignments,
        permit: permits,
        step: workflowSteps,
      })
      .from(workflowAssignments)
      .innerJoin(permits, eq(workflowAssignments.permitId, permits.id))
      .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
      .where(
        and(
          eq(permits.status, PENDING_APPROVAL_STATUS),
          eq(workflowAssignments.status, 'active'),
          isNull(workflowAssignments.slaPausedAt),
          lt(workflowAssignments.slaDeadlineAt, now),
          lt(workflowAssignments.escalationLevel, MAX_SLA_ESCALATION_LEVELS),
        ),
      );

    if (rows.length === 0) {
      return 0;
    }

    const queue = this.queueService.getQueue();

    for (const row of rows) {
      const nextLevel = row.assignment.escalationLevel + 1;
      const fallbackRole =
        typeof row.step.stepConfig?.escalationRole === 'string'
          ? row.step.stepConfig.escalationRole
          : row.step.approverRole;
      const extensionHours = row.step.slaHours ?? 24;
      const nextDeadline = new Date(now.getTime() + extensionHours * 60 * 60 * 1000);

      await this.db.transaction(async (tx) => {
        await tx
          .update(workflowAssignments)
          .set({
            escalationLevel: nextLevel,
            slaDeadlineAt: nextDeadline,
            updatedBy: row.assignment.assigneeId,
          })
          .where(eq(workflowAssignments.id, row.assignment.id));

        await tx.insert(approvalSlaEscalations).values({
          tenantId: row.permit.tenantId,
          permitId: row.permit.id,
          workflowAssignmentId: row.assignment.id,
          escalationLevel: nextLevel,
          fallbackRole,
          createdBy: row.assignment.assigneeId,
        });

        await this.approvalHistoryService.record(
          {
            permitId: row.permit.id,
            action: 'sla_escalated',
            fromStatus: row.permit.status,
            toStatus: row.permit.status,
            actorId: row.assignment.assigneeId,
            workflowStepId: row.step.id,
            metadata: {
              escalationLevel: nextLevel,
              fallbackRole,
              workflowAssignmentId: row.assignment.id,
            },
            createdBy: row.assignment.assigneeId,
          },
          tx,
        );
      });

      await queue.add(APPROVAL_NOTIFICATION_JOB, {
        permitId: row.permit.id,
        tenantId: row.permit.tenantId,
        action: 'sla_escalated',
        actorId: row.assignment.assigneeId,
        metadata: {
          escalationLevel: nextLevel,
          fallbackRole,
          workflowAssignmentId: row.assignment.id,
        },
      } satisfies ApprovalNotificationPayload);

      await this.approvalCacheService.invalidateTenant(row.permit.tenantId);
    }

    this.logger.log(`Escalated ${rows.length} overdue approval SLAs`);
    return rows.length;
  }
}
