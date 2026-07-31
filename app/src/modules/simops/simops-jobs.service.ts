import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permits } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  SIMOPS_ACTIVE_PERMIT_STATUSES,
  SIMOPS_CONFLICT_DETECTION_JOB,
  SIMOPS_DEFAULT_ESCALATION_TIMEOUT_HOURS,
  SIMOPS_ESCALATION_JOB,
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
  kind?: 'detection' | 'resolution' | 'escalation';
};

export type SimopsEscalationPayload = {
  tenantId: string;
  conflictId?: string;
  severity?: string;
  unresolvedHours?: number;
  message: string;
};

/**
 * BullMQ scheduling for SIMOPS detection sweeps and resolution escalations.
 * Pairwise analysis / assess-approve persistence land in BE tickets.
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

    this.queueService.registerHandler(SIMOPS_ESCALATION_JOB, async (job) => {
      const payload = job.data as SimopsEscalationPayload | Record<string, never>;
      if (payload && 'tenantId' in payload && payload.tenantId) {
        this.simopsLogService.logEvent({
          action: 'simops.escalation',
          tenantId: payload.tenantId,
          conflictId: payload.conflictId,
          metadata: {
            severity: payload.severity,
            unresolvedHours: payload.unresolvedHours,
            message: payload.message,
          },
        });
        return;
      }
      await this.runEscalationSweep();
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
          metadata: { message: payload.message, kind: payload.kind ?? 'detection' },
        });
      },
    );

    const detectionCron =
      this.configService.get<string>('simops.conflictDetectionCron') ?? '*/5 * * * *';
    const escalationCron =
      this.configService.get<string>('simops.escalationCron') ?? '0 * * * *';

    try {
      await this.queueService.getQueue().add(
        SIMOPS_CONFLICT_DETECTION_JOB,
        {},
        { repeat: { pattern: detectionCron }, jobId: 'simops-conflict-detection-schedule' },
      );
      this.logger.log(`Scheduled SIMOPS conflict detection job (${detectionCron})`);
    } catch (error) {
      this.logger.warn('Could not schedule SIMOPS conflict detection job');
      this.logger.debug(error);
    }

    try {
      await this.queueService.getQueue().add(
        SIMOPS_ESCALATION_JOB,
        {},
        { repeat: { pattern: escalationCron }, jobId: 'simops-escalation-schedule' },
      );
      this.logger.log(`Scheduled SIMOPS escalation job (${escalationCron})`);
    } catch (error) {
      this.logger.warn('Could not schedule SIMOPS escalation job');
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

  /**
   * FR-SIM-019 — escalate unresolved high-severity conflicts past the configured timeout.
   * Persistence queries land in BE-SP-04.02; this sweep emits Loki markers and refreshes
   * the approval-queue cache placeholder so resolution APIs share one infra path.
   */
  async runEscalationSweep(): Promise<void> {
    const timeoutHours =
      this.configService.get<number>('simops.escalationTimeoutHoursHigh') ??
      SIMOPS_DEFAULT_ESCALATION_TIMEOUT_HOURS;

    this.simopsLogService.logEvent({
      action: 'simops.escalation.sweep',
      metadata: { timeoutHours },
    });

    this.logger.log(
      `SIMOPS escalation sweep ready (high-severity timeout ${timeoutHours}h); BE wires unresolved conflict query`,
    );
  }

  async enqueueNotification(payload: SimopsNotificationPayload): Promise<void> {
    await this.queueService.getQueue().add(SIMOPS_NOTIFICATION_JOB, payload);
  }

  async enqueueEscalation(payload: SimopsEscalationPayload): Promise<void> {
    await this.queueService.getQueue().add(SIMOPS_ESCALATION_JOB, payload);
  }
}
