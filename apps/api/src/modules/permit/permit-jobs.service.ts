import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, lt } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permits } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { PermitLogService } from './permit-log.service';

export const PERMIT_DRAFT_CLEANUP_JOB = 'permit.draft-cleanup';

@Injectable()
export class PermitJobsService implements OnModuleInit {
  private readonly logger = new Logger(PermitJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly permitLogService: PermitLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(PERMIT_DRAFT_CLEANUP_JOB, async () => {
      await this.cleanupStaleDrafts();
    });

    const cron = this.configService.get<string>('permit.draftCleanupCron') ?? '0 2 * * *';

    try {
      await this.queueService.getQueue().add(
        PERMIT_DRAFT_CLEANUP_JOB,
        {},
        {
          repeat: { pattern: cron },
          jobId: 'permit-draft-cleanup-schedule',
        },
      );
      this.logger.log(`Scheduled permit draft cleanup (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule permit draft cleanup job');
      this.logger.debug(error);
    }
  }

  async cleanupStaleDrafts(): Promise<number> {
    const retentionDays = this.configService.get<number>('permit.draftRetentionDays') ?? 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const stalePermits = await this.db
      .select({ id: permits.id, tenantId: permits.tenantId })
      .from(permits)
      .where(and(eq(permits.status, 'draft'), lt(permits.updatedAt, cutoff)));

    if (stalePermits.length === 0) {
      return 0;
    }

    for (const permit of stalePermits) {
      await this.db.delete(permits).where(eq(permits.id, permit.id));
      this.permitLogService.logEvent({
        action: 'permit.draft.cleaned',
        permitId: permit.id,
        tenantId: permit.tenantId,
        metadata: { retentionDays },
      });
    }

    this.logger.log(`Removed ${stalePermits.length} stale permit drafts`);
    return stalePermits.length;
  }
}
