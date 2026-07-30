import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { isolationExecution } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  EXECUTION_IN_PROGRESS,
  EXECUTION_ISOLATED,
  ISOLATION_REMINDER_JOB,
} from './isolation-execution.constants';
import { IsolationLogService } from './isolation-log.service';

/**
 * BullMQ scheduling for isolation reminders. A repeating job flags active
 * isolation sessions (in_progress / isolated but not yet verified) so operators
 * are reminded to complete verification. Runs through the shared platform queue.
 */
@Injectable()
export class IsolationJobsService implements OnModuleInit {
  private readonly logger = new Logger(IsolationJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly isolationLogService: IsolationLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(ISOLATION_REMINDER_JOB, async () => {
      await this.sendReminders();
    });

    const cron = this.configService.get<string>('isolation.reminderCron') ?? '0 */4 * * *';

    try {
      await this.queueService.getQueue().add(
        ISOLATION_REMINDER_JOB,
        {},
        { repeat: { pattern: cron }, jobId: 'isolation-reminder-schedule' },
      );
      this.logger.log(`Scheduled isolation reminder job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule isolation reminder job');
      this.logger.debug(error);
    }
  }

  async sendReminders(): Promise<void> {
    const active = await this.db
      .select()
      .from(isolationExecution)
      .where(inArray(isolationExecution.status, [EXECUTION_IN_PROGRESS, EXECUTION_ISOLATED]));

    for (const execution of active) {
      this.isolationLogService.logEvent({
        action: 'isolation.reminder',
        executionId: execution.id,
        planId: execution.planId,
        tenantId: execution.tenantId,
        metadata: { status: execution.status },
      });
    }

    if (active.length > 0) {
      this.logger.log(`Isolation reminders emitted for ${active.length} active session(s)`);
    }
  }
}
