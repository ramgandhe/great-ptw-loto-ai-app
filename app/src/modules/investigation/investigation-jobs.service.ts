import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, inArray, lt } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { correctiveActions } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { INVESTIGATION_OVERDUE_JOB } from './investigation.constants';
import { InvestigationLogService } from './investigation-log.service';

/** BullMQ sweep for overdue corrective actions. */
@Injectable()
export class InvestigationJobsService implements OnModuleInit {
  private readonly logger = new Logger(InvestigationJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: InvestigationLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(INVESTIGATION_OVERDUE_JOB, async () => {
      await this.flagOverdueActions();
    });

    const cron =
      this.configService.get<string>('investigation.overdueActionCron') ?? '0 9 * * *';

    try {
      await this.queueService.getQueue().add(
        INVESTIGATION_OVERDUE_JOB,
        {},
        { repeat: { pattern: cron }, jobId: 'investigation-overdue-actions-schedule' },
      );
      this.logger.log(`Scheduled investigation overdue-actions job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule investigation overdue-actions job');
      this.logger.debug(error);
    }
  }

  async flagOverdueActions(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = await this.db
      .select({
        id: correctiveActions.id,
        tenantId: correctiveActions.tenantId,
        investigationId: correctiveActions.investigationId,
        dueDate: correctiveActions.dueDate,
      })
      .from(correctiveActions)
      .where(
        and(
          inArray(correctiveActions.status, ['open', 'in_progress']),
          lt(correctiveActions.dueDate, today),
        ),
      );

    for (const action of overdue) {
      this.logService.logEvent({
        action: 'investigation.overdue-action',
        investigationId: action.investigationId,
        tenantId: action.tenantId,
        metadata: { correctiveActionId: action.id, dueDate: action.dueDate },
      });
    }

    if (overdue.length > 0) {
      this.logger.log(`Flagged ${overdue.length} overdue corrective action(s)`);
    }
  }
}
