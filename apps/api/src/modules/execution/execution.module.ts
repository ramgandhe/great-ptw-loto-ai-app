import { Module } from '@nestjs/common';
import { PermitModule } from '../permit/permit.module';
import { PermitCacheService } from '../permit/permit-cache.service';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { ExecutionCacheService } from './execution-cache.service';
import { ExecutionEvidenceService } from './execution-evidence.service';
import { ExecutionController } from './execution.controller';
import { ExecutionJobsService } from './execution-jobs.service';
import { ExecutionLogService } from './execution-log.service';
import { ExecutionService } from './execution.service';
import { NotificationService } from './notification.service';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { StatusTransitionService } from './status-transition.service';

@Module({
  imports: [PermitModule],
  controllers: [ExecutionController, ProgressController, EvidenceController],
  providers: [
    ExecutionService,
    ProgressService,
    EvidenceService,
    StatusTransitionService,
    NotificationService,
    ExecutionCacheService,
    ExecutionJobsService,
    ExecutionLogService,
    ExecutionEvidenceService,
    PermitCacheService,
  ],
  exports: [
    ExecutionService,
    ProgressService,
    EvidenceService,
    StatusTransitionService,
    ExecutionCacheService,
    ExecutionLogService,
  ],
})
export class ExecutionModule {}
