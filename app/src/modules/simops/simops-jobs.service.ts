import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permits } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  SIMOPS_ACTIVE_PERMIT_STATUSES,
  SIMOPS_CONFLICT_DETECTION_JOB,
  SIMOPS_NOTIFICATION_JOB,
} from './simops.constants';
import { SimopsCacheService } from './simops-cache.service';
import { SimopsLogService } from './simops-log.service';

export type SimopsNotificationPayload = {
  tenantId: string;
  conflictId?: string;
  permitId?: string;
  recipientUserId?: string;
  message: string;
};

/**
 * BullMQ scheduling for continuous SIMOPS conflict detection.
 * Sweeps active/approved permits and emits Loki events; BE (PUS-166) owns
 * pairwise analysis and conflict persistence.
 */
@Injectable()
export class SimopsJobsService implements OnModuleInit {
  private readonly logger = new Logger(SimopsJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly simopsLogService: SimopsLogService,
    private readonly simopsCacheService: SimopsCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(SIMOPS_CONFLICT_DETECTION_JOB, async () => {
      await this.runConflictDetectionSweep();
    });

    this.queueService.registerHandler(
      SIMOPS_NOTIFICATION_JOB,
      async (job) => {
        const payload = job.data as SimopsNotificationPayload;
        this.simopsLogService.logEvent({
          action: 'simops.notification',
          tenantId: payload.tenantId,
          conflictId: payload.conflictId,
          permitId: payload.permitId,
          userId: payload.recipientUserId,
          metadata: { message: payload.message },
        });
      },
    );

    const cron =
      this.configService.get<string>('simops.conflictDetectionCron') ?? '*/5 * * * *';

    try {
      await this.queueService.getQueue().add(
        SIMOPS_CONFLICT_DETECTION_JOB,
        {},
        { repeat: { pattern: cron }, jobId: 'simops-conflict-detection-schedule' },
      );
      this.logger.log(`Scheduled SIMOPS conflict detection job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule SIMOPS conflict detection job');
      this.logger.debug(error);
    }
  }

  async runConflictDetectionSweep(): Promise<void> {
    const rows = await this.db
      .select({
        id: permits.id,
        tenantId: permits.tenantId,
        status: permits.status,
        locationId: permits.locationId,
        workstationId: permits.workstationId,
        machineryId: permits.machineryId,
        plannedStartAt: permits.plannedStartAt,
        plannedEndAt: permits.plannedEndAt,
        permitTypeId: permits.permitTypeId,
      })
      .from(permits)
      .where(inArray(permits.status, [...SIMOPS_ACTIVE_PERMIT_STATUSES]));

    const byTenant = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byTenant.get(row.tenantId) ?? [];
      list.push(row);
      byTenant.set(row.tenantId, list);
    }

    for (const [tenantId, tenantPermits] of byTenant) {
      await this.simopsCacheService.setActivePermits(tenantId, tenantPermits);
      this.simopsLogService.logEvent({
        action: 'simops.conflict-detection.sweep',
        tenantId,
        metadata: { permitCount: tenantPermits.length },
      });
    }

    if (rows.length > 0) {
      this.logger.log(
        `SIMOPS conflict detection sweep cached ${rows.length} permit(s) across ${byTenant.size} tenant(s)`,
      );
    }
  }

  async enqueueNotification(payload: SimopsNotificationPayload): Promise<void> {
    await this.queueService.getQueue().add(SIMOPS_NOTIFICATION_JOB, payload);
  }
}
