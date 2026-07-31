import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permits } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { MDP_DAILY_REMINDER_JOB } from './daily-progress.constants';
import { DailyProgressLogService } from './daily-progress-log.service';

/**
 * BullMQ daily reminder for active multi-day permits pending progress submission.
 */
@Injectable()
export class DailyProgressJobsService implements OnModuleInit {
  private readonly logger = new Logger(DailyProgressJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: DailyProgressLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(MDP_DAILY_REMINDER_JOB, async () => {
      await this.sendReminders();
    });

    const cron = this.configService.get<string>('mdp.dailyReminderCron') ?? '0 7 * * *';

    try {
      await this.queueService.getQueue().add(
        MDP_DAILY_REMINDER_JOB,
        {},
        { repeat: { pattern: cron }, jobId: 'mdp-daily-reminder-schedule' },
      );
      this.logger.log(`Scheduled MDP daily reminder job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule MDP daily reminder job');
      this.logger.debug(error);
    }
  }

  async sendReminders(): Promise<void> {
    const active = await this.db
      .select({
        id: permits.id,
        tenantId: permits.tenantId,
        reference: permits.reference,
      })
      .from(permits)
      .where(and(eq(permits.status, 'active')));

    for (const permit of active) {
      this.logService.logEvent({
        action: 'mdp.daily-reminder',
        permitId: permit.id,
        tenantId: permit.tenantId,
        metadata: { reference: permit.reference },
      });
    }

    if (active.length > 0) {
      this.logger.log(`MDP daily reminders emitted for ${active.length} active permit(s)`);
    }
  }
}
