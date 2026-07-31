import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { isolationExecution } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { EXECUTION_VERIFIED } from '../isolation-execution/isolation-execution.constants';
import { RestorationLogService } from './restoration-log.service';
import { RESTORATION_NOTIFICATION_JOB } from './restoration.constants';

/**
 * BullMQ scheduling for restoration notifications. A repeating job flags
 * executions that are verified (work complete) but not yet restored, so the
 * responsible team is reminded to complete restoration. Runs through the shared
 * platform queue.
 */
@Injectable()
export class RestorationJobsService implements OnModuleInit {
  private readonly logger = new Logger(RestorationJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly restorationLogService: RestorationLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(RESTORATION_NOTIFICATION_JOB, async () => {
      await this.sendNotifications();
    });

    const cron = this.configService.get<string>('restoration.notificationCron') ?? '0 */6 * * *';

    try {
      await this.queueService.getQueue().add(
        RESTORATION_NOTIFICATION_JOB,
        {},
        { repeat: { pattern: cron }, jobId: 'restoration-notification-schedule' },
      );
      this.logger.log(`Scheduled restoration notification job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule restoration notification job');
      this.logger.debug(error);
    }
  }

  async sendNotifications(): Promise<void> {
    const pending = await this.db
      .select()
      .from(isolationExecution)
      .where(eq(isolationExecution.status, EXECUTION_VERIFIED));

    for (const execution of pending) {
      this.restorationLogService.logEvent({
        action: 'restoration.pending_notification',
        executionId: execution.id,
        planId: execution.planId,
        tenantId: execution.tenantId,
        metadata: { status: execution.status },
      });
    }

    if (pending.length > 0) {
      this.logger.log(`Restoration notifications emitted for ${pending.length} verified execution(s)`);
    }
  }
}
