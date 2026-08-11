import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { Job } from 'bullmq';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permits, workflowAssignments } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import {
  APPROVAL_NOTIFICATION_JOB,
  APPROVAL_REMINDER_JOB,
  PENDING_APPROVAL_STATUS,
} from './approval.constants';
import { ApprovalCacheService } from './approval-cache.service';
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
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(APPROVAL_NOTIFICATION_JOB, async (job) => {
      await this.processNotification(job);
    });

    this.queueService.registerHandler(APPROVAL_REMINDER_JOB, async () => {
      await this.sendReminders();
    });

    const cron = this.configService.get<string>('approval.reminderCron') ?? '0 8 * * *';

    try {
      await this.queueService.getQueue().add(
        APPROVAL_REMINDER_JOB,
        {},
        {
          repeat: { pattern: cron },
          jobId: 'approval-reminder-schedule',
        },
      );
      this.logger.log(`Scheduled approval reminder job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule approval reminder job');
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
    await this.dispatchFrNotApproval(payload);
  }

  private async dispatchFrNotApproval(payload: ApprovalNotificationPayload): Promise<void> {
    const requirementByAction = {
      approved: 'FR-NOT-002',
      rejected: 'FR-NOT-003',
      deferred: 'FR-NOT-004',
    } as const;

    const requirementId =
      requirementByAction[payload.action as keyof typeof requirementByAction];
    if (!requirementId) {
      return;
    }

    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, payload.permitId), eq(permits.tenantId, payload.tenantId)))
      .limit(1);

    if (!permit) {
      return;
    }

    const recipientId = permit.submittedBy ?? permit.createdBy;
    if (!recipientId) {
      return;
    }

    const titles = {
      'FR-NOT-002': 'Permit approved',
      'FR-NOT-003': 'Permit rejected',
      'FR-NOT-004': 'Permit deferred',
    } as const;

    await this.notificationDispatch.dispatch({
      tenantId: payload.tenantId,
      actorId: payload.actorId,
      requirementId,
      title: titles[requirementId],
      body: `Permit ${permit.reference ?? permit.id} was ${payload.action}.`,
      recipientUserIds: [recipientId],
      entityType: 'permit',
      entityId: permit.id,
      dedupeKey: `fr-not:${requirementId}:${permit.id}:${payload.action}`,
      sourceModule: 'approval',
      category: 'workflow',
      priority: payload.action === 'rejected' ? 'high' : 'medium',
    });
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
}
