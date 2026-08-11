import { Module } from '@nestjs/common';
import { PermitModule } from '../permit/permit.module';
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
import { CosignatureController } from './cosignature.controller';
import { CosignatureService } from './cosignature.service';
import { ApprovalModule } from '../approval/approval.module';

@Module({
  imports: [PermitModule, ApprovalModule],
  controllers: [ExecutionController, ProgressController, EvidenceController, CosignatureController],
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
    CosignatureService,
  ],
  exports: [
    ExecutionService,
    ProgressService,
    EvidenceService,
    StatusTransitionService,
    ExecutionCacheService,
    ExecutionLogService,
    CosignatureService,
  ],
})
export class ExecutionModule {}
