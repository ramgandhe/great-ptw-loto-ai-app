import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { incidents } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { INCIDENT_CLOSURE_NOTIFY_JOB } from './incident-closure.constants';
import { IncidentClosureLogService } from './incident-closure-log.service';

/** BullMQ sweep notifying on verified incidents pending closure. */
@Injectable()
export class IncidentClosureJobsService implements OnModuleInit {
  private readonly logger = new Logger(IncidentClosureJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: IncidentClosureLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(INCIDENT_CLOSURE_NOTIFY_JOB, async () => {
      await this.notifyPendingClosures();
    });

    const cron =
      this.configService.get<string>('incidentClosure.closureNotifyCron') ?? '0 10 * * *';

    try {
      await this.queueService.getQueue().add(
        INCIDENT_CLOSURE_NOTIFY_JOB,
        {},
        { repeat: { pattern: cron }, jobId: 'incident-closure-notify-schedule' },
      );
      this.logger.log(`Scheduled incident closure-notify job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule incident closure-notify job');
      this.logger.debug(error);
    }
  }

  async notifyPendingClosures(): Promise<void> {
    const pending = await this.db
      .select({
        id: incidents.id,
        tenantId: incidents.tenantId,
        reference: incidents.reference,
      })
      .from(incidents)
      .where(eq(incidents.status, 'verified'));

    for (const incident of pending) {
      this.logService.logEvent({
        action: 'incident.closure-pending',
        incidentId: incident.id,
        tenantId: incident.tenantId,
        metadata: { reference: incident.reference },
      });
    }

    if (pending.length > 0) {
      this.logger.log(`Closure reminders for ${pending.length} verified incident(s)`);
    }
  }
}
