import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull } from 'drizzle-orm';
import { Job } from 'bullmq';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permitArchive, permits } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  CLOSED_STATUS,
  CLOSURE_ARCHIVE_JOB,
  CLOSURE_NOTIFICATION_JOB,
  CLOSURE_REPORT_JOB,
} from './closure.constants';
import { ClosureCacheService } from './closure-cache.service';
import { ClosureLogService } from './closure-log.service';
import type { ClosureNotificationPayload } from './notification.service';

@Injectable()
export class ClosureJobsService implements OnModuleInit {
  private readonly logger = new Logger(ClosureJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly closureLogService: ClosureLogService,
    private readonly closureCacheService: ClosureCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(CLOSURE_NOTIFICATION_JOB, async (job) => {
      await this.processNotification(job);
    });

    this.queueService.registerHandler(CLOSURE_ARCHIVE_JOB, async () => {
      await this.reconcileArchives();
    });

    this.queueService.registerHandler(CLOSURE_REPORT_JOB, async () => {
      await this.generateArchiveReport();
    });

    const archiveCron =
      this.configService.get<string>('closure.archiveCron') ?? '0 3 * * *';
    const reportCron = this.configService.get<string>('closure.reportCron') ?? '0 4 * * 1';

    try {
      await this.queueService.getQueue().add(
        CLOSURE_ARCHIVE_JOB,
        {},
        {
          repeat: { pattern: archiveCron },
          jobId: 'closure-archive-schedule',
        },
      );
      this.logger.log(`Scheduled closure archive reconciliation (${archiveCron})`);
    } catch (error) {
      this.logger.warn('Could not schedule closure archive job');
      this.logger.debug(error);
    }

    try {
      await this.queueService.getQueue().add(
        CLOSURE_REPORT_JOB,
        {},
        {
          repeat: { pattern: reportCron },
          jobId: 'closure-report-schedule',
        },
      );
      this.logger.log(`Scheduled closure archive report (${reportCron})`);
    } catch (error) {
      this.logger.warn('Could not schedule closure report job');
      this.logger.debug(error);
    }
  }

  async processNotification(job: Job<ClosureNotificationPayload>): Promise<void> {
    const payload = job.data;

    this.closureLogService.logEvent({
      action: `closure.notification.${payload.action}`,
      permitId: payload.permitId,
      tenantId: payload.tenantId,
      userId: payload.actorId,
      metadata: payload.metadata,
    });

    await this.closureCacheService.invalidateTenant(payload.tenantId);
  }

  async reconcileArchives(): Promise<number> {
    const rows = await this.db
      .select({
        permitId: permits.id,
        tenantId: permits.tenantId,
        title: permits.title,
        reference: permits.reference,
        updatedBy: permits.updatedBy,
      })
      .from(permits)
      .leftJoin(permitArchive, eq(permitArchive.permitId, permits.id))
      .where(and(eq(permits.status, CLOSED_STATUS), isNull(permitArchive.id)));

    if (rows.length === 0) {
      return 0;
    }

    for (const row of rows) {
      await this.db.insert(permitArchive).values({
        tenantId: row.tenantId,
        permitId: row.permitId,
        title: row.title,
        reference: row.reference,
        closedAt: new Date(),
        closedBy: row.updatedBy ?? row.tenantId,
      });

      await this.closureCacheService.invalidateTenant(row.tenantId);
    }

    this.logger.log(`Reconciled ${rows.length} missing permit archive records`);
    return rows.length;
  }

  async generateArchiveReport(): Promise<number> {
    const rows = await this.db
      .select({ tenantId: permitArchive.tenantId })
      .from(permitArchive);

    const counts = new Map<string, number>();

    for (const row of rows) {
      counts.set(row.tenantId, (counts.get(row.tenantId) ?? 0) + 1);
    }

    for (const [tenantId, archivedCount] of counts) {
      this.closureLogService.logEvent({
        action: 'closure.report.generated',
        tenantId,
        metadata: { archivedCount },
      });
    }

    this.logger.log(`Generated archive report for ${counts.size} tenants`);
    return counts.size;
  }
}
