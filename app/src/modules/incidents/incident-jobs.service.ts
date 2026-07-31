import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { incidents } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { INCIDENT_OPEN_REMINDER_JOB } from './incidents.constants';
import { IncidentLogService } from './incident-log.service';

/**
 * BullMQ reminder for open incidents awaiting Safety Officer attention.
 */
@Injectable()
export class IncidentJobsService implements OnModuleInit {
  private readonly logger = new Logger(IncidentJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: IncidentLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(INCIDENT_OPEN_REMINDER_JOB, async () => {
      await this.sendOpenReminders();
    });

    const cron = this.configService.get<string>('incident.openReminderCron') ?? '0 8 * * *';

    try {
      await this.queueService.getQueue().add(
        INCIDENT_OPEN_REMINDER_JOB,
        {},
        { repeat: { pattern: cron }, jobId: 'incident-open-reminder-schedule' },
      );
      this.logger.log(`Scheduled incident open-reminder job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule incident open-reminder job');
      this.logger.debug(error);
    }
  }

  async sendOpenReminders(): Promise<void> {
    const open = await this.db
      .select({
        id: incidents.id,
        tenantId: incidents.tenantId,
        reference: incidents.reference,
      })
      .from(incidents)
      .where(eq(incidents.status, 'open'));

    for (const incident of open) {
      this.logService.logEvent({
        action: 'incident.open-reminder',
        incidentId: incident.id,
        tenantId: incident.tenantId,
        metadata: { reference: incident.reference },
      });
    }

    if (open.length > 0) {
      this.logger.log(`Open-incident reminders emitted for ${open.length} incident(s)`);
    }
  }
}
