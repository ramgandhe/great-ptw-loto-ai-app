import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, lt } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permitExtensions, permits } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  MDP_EXTENSION_EXPIRY_JOB,
  MDP_REVALIDATION_REMINDER_JOB,
} from './revalidation.constants';
import { RevalidationLogService } from './revalidation-log.service';

@Injectable()
export class RevalidationJobsService implements OnModuleInit {
  private readonly logger = new Logger(RevalidationJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: RevalidationLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(MDP_REVALIDATION_REMINDER_JOB, async () => {
      await this.sendRevalidationReminders();
    });
    this.queueService.registerHandler(MDP_EXTENSION_EXPIRY_JOB, async () => {
      await this.flagExpiringExtensions();
    });

    const reminderCron =
      this.configService.get<string>('mdp.revalidationReminderCron') ?? '0 6 * * *';
    const expiryCron = this.configService.get<string>('mdp.extensionExpiryCron') ?? '0 5 * * *';

    try {
      await this.queueService.getQueue().add(
        MDP_REVALIDATION_REMINDER_JOB,
        {},
        { repeat: { pattern: reminderCron }, jobId: 'mdp-revalidation-reminder-schedule' },
      );
      await this.queueService.getQueue().add(
        MDP_EXTENSION_EXPIRY_JOB,
        {},
        { repeat: { pattern: expiryCron }, jobId: 'mdp-extension-expiry-schedule' },
      );
      this.logger.log(
        `Scheduled MDP revalidation (${reminderCron}) and extension expiry (${expiryCron}) jobs`,
      );
    } catch (error) {
      this.logger.warn('Could not schedule MDP revalidation jobs');
      this.logger.debug(error);
    }
  }

  async sendRevalidationReminders(): Promise<void> {
    const active = await this.db
      .select({ id: permits.id, tenantId: permits.tenantId, reference: permits.reference })
      .from(permits)
      .where(eq(permits.status, 'active'));

    for (const permit of active) {
      this.logService.logEvent({
        action: 'mdp.revalidation-reminder',
        permitId: permit.id,
        tenantId: permit.tenantId,
        metadata: { reference: permit.reference },
      });
    }

    if (active.length > 0) {
      this.logger.log(`Revalidation reminders for ${active.length} active permit(s)`);
    }
  }

  async flagExpiringExtensions(): Promise<void> {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pending = await this.db
      .select()
      .from(permitExtensions)
      .where(
        and(eq(permitExtensions.status, 'pending'), lt(permitExtensions.requestedEndAt, soon)),
      );

    for (const extension of pending) {
      this.logService.logEvent({
        action: 'mdp.extension-expiry-flag',
        permitId: extension.permitId,
        tenantId: extension.tenantId,
        metadata: { extensionId: extension.id, requestedEndAt: extension.requestedEndAt },
      });
    }
  }
}
