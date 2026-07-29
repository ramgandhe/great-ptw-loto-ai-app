import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, inArray } from 'drizzle-orm';
import { Job } from 'bullmq';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permitExecutors, permits } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  ACTIVE_STATUS,
  EXECUTION_NOTIFICATION_JOB,
  EXECUTION_REMINDER_JOB,
  SUSPENDED_STATUS,
} from './execution.constants';
import { ExecutionCacheService } from './execution-cache.service';
import { ExecutionLogService } from './execution-log.service';
import type { ExecutionNotificationPayload } from './notification.service';

@Injectable()
export class ExecutionJobsService implements OnModuleInit {
  private readonly logger = new Logger(ExecutionJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly executionLogService: ExecutionLogService,
    private readonly executionCacheService: ExecutionCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(EXECUTION_NOTIFICATION_JOB, async (job) => {
      await this.processNotification(job);
    });

    this.queueService.registerHandler(EXECUTION_REMINDER_JOB, async () => {
      await this.sendReminders();
    });

    const cron = this.configService.get<string>('execution.reminderCron') ?? '0 8 * * *';

    try {
      await this.queueService.getQueue().add(
        EXECUTION_REMINDER_JOB,
        {},
        {
          repeat: { pattern: cron },
          jobId: 'execution-reminder-schedule',
        },
      );
      this.logger.log(`Scheduled execution reminder job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule execution reminder job');
      this.logger.debug(error);
    }
  }

  async processNotification(job: Job<ExecutionNotificationPayload>): Promise<void> {
    const payload = job.data;

    this.executionLogService.logEvent({
      action: `execution.notification.${payload.action}`,
      permitId: payload.permitId,
      tenantId: payload.tenantId,
      userId: payload.actorId,
      metadata: payload.metadata,
    });

    await this.executionCacheService.invalidateTenant(payload.tenantId);
  }

  async sendReminders(): Promise<number> {
    const rows = await this.db
      .select({
        permitId: permits.id,
        tenantId: permits.tenantId,
        executorId: permitExecutors.workforceUserId,
      })
      .from(permits)
      .innerJoin(permitExecutors, eq(permitExecutors.permitId, permits.id))
      .where(inArray(permits.status, [ACTIVE_STATUS, SUSPENDED_STATUS]));

    if (rows.length === 0) {
      return 0;
    }

    const queue = this.queueService.getQueue();

    for (const row of rows) {
      await queue.add(EXECUTION_NOTIFICATION_JOB, {
        permitId: row.permitId,
        tenantId: row.tenantId,
        action: 'reminder',
        actorId: row.executorId,
      } satisfies ExecutionNotificationPayload);
    }

    this.logger.log(`Enqueued ${rows.length} execution reminder notifications`);
    return rows.length;
  }
}
