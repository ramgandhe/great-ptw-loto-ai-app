import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  SIMOPS_ESCALATION_JOB,
  SIMOPS_NIGHTLY_REEVAL_JOB,
  SIMOPS_SYSTEM_ACTOR_ID,
} from './simops.constants';
import { ConflictResolutionService } from './conflict-resolution.service';
import { SimopsService } from './simops.service';

@Injectable()
export class SimopsJobsService implements OnModuleInit {
  private readonly logger = new Logger(SimopsJobsService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly simopsService: SimopsService,
    private readonly resolutionService: ConflictResolutionService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(SIMOPS_NIGHTLY_REEVAL_JOB, async () => {
      await this.simopsService.reevaluateUpcomingApproved(SIMOPS_SYSTEM_ACTOR_ID);
    });

    this.queueService.registerHandler(SIMOPS_ESCALATION_JOB, async () => {
      await this.resolutionService.escalateOverdue(SIMOPS_SYSTEM_ACTOR_ID);
    });

    const nightlyCron =
      this.configService.get<string>('simops.nightlyReevaluationCron') ?? '0 2 * * *';
    const escalationCron =
      this.configService.get<string>('simops.escalationCron') ?? '*/15 * * * *';

    try {
      await this.queueService.getQueue().add(
        SIMOPS_NIGHTLY_REEVAL_JOB,
        {},
        { repeat: { pattern: nightlyCron }, jobId: 'simops-nightly-reevaluation' },
      );
      await this.queueService.getQueue().add(
        SIMOPS_ESCALATION_JOB,
        {},
        { repeat: { pattern: escalationCron }, jobId: 'simops-cross-dept-escalation' },
      );
      this.logger.log(
        `Scheduled SIMOPS nightly (${nightlyCron}) and escalation (${escalationCron}) jobs`,
      );
    } catch (error) {
      this.logger.warn(
        `Unable to schedule SIMOPS jobs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
