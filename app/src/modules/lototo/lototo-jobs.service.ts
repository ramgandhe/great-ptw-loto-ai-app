import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { Job } from 'bullmq';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { lototoPlans } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  LOTOTO_NOTIFICATION_JOB,
  LOTOTO_PLANNING_REMINDER_JOB,
} from './lototo.constants';
import { LototoCacheService } from './lototo-cache.service';
import { LototoLogService } from './lototo-log.service';
import { CanonicalNotificationService } from '../notifications/canonical-notification.service';
import type { LototoNotificationPayload } from './notification.service';

@Injectable()
export class LototoJobsService implements OnModuleInit {
  private readonly logger = new Logger(LototoJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly lototoLogService: LototoLogService,
    private readonly lototoCacheService: LototoCacheService,
    private readonly canonicalNotificationService: CanonicalNotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(LOTOTO_NOTIFICATION_JOB, async (job) => {
      await this.processNotification(job);
    });

    this.queueService.registerHandler(LOTOTO_PLANNING_REMINDER_JOB, async () => {
      await this.sendPlanningReminders();
    });

    const cron = this.configService.get<string>('lototo.planningReminderCron') ?? '0 8 * * *';

    try {
      await this.queueService.getQueue().add(
        LOTOTO_PLANNING_REMINDER_JOB,
        {},
        {
          repeat: { pattern: cron },
          jobId: 'lototo-planning-reminder-schedule',
        },
      );
      this.logger.log(`Scheduled LOTOTO planning reminder job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule LOTOTO planning reminder job');
      this.logger.debug(error);
    }
  }

  async processNotification(job: Job<LototoNotificationPayload>): Promise<void> {
    const payload = job.data;

    this.lototoLogService.logEvent({
      action: `lototo.notification.${payload.action}`,
      planId: payload.planId,
      permitId: payload.permitId,
      tenantId: payload.tenantId,
      userId: payload.actorId,
      metadata: payload.metadata,
    });

    await this.lototoCacheService.invalidatePlan(
      payload.tenantId,
      payload.planId,
      payload.permitId,
    );
    await this.lototoCacheService.invalidateTenant(payload.tenantId);
    await this.canonicalNotificationService.fromLototoPayload(payload);
  }

  async sendPlanningReminders(): Promise<number> {
    const rows = await this.db
      .select({
        planId: lototoPlans.id,
        permitId: lototoPlans.permitId,
        tenantId: lototoPlans.tenantId,
        createdBy: lototoPlans.createdBy,
      })
      .from(lototoPlans)
      .where(eq(lototoPlans.status, 'draft'));

    if (rows.length === 0) {
      return 0;
    }

    const queue = this.queueService.getQueue();

    for (const row of rows) {
      await queue.add(LOTOTO_NOTIFICATION_JOB, {
        planId: row.planId,
        permitId: row.permitId,
        tenantId: row.tenantId,
        action: 'planning_reminder',
        actorId: row.createdBy ?? row.tenantId,
      } satisfies LototoNotificationPayload);
    }

    this.logger.log(`Enqueued ${rows.length} LOTOTO planning reminder notifications`);
    return rows.length;
  }
}
