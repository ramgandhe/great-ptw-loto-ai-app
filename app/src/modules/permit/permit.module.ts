import { forwardRef, Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';
import { PermitController } from './permit.controller';
import { PermitService } from './permit.service';
import { PermitValidationService } from './permit-validation.service';
import { PermitCacheService } from './permit-cache.service';
import { PermitJobsService } from './permit-jobs.service';
import { PermitLototoExecutionController } from './permit-lototo-execution.controller';
import { PermitLototoExecutionService } from './permit-lototo-execution.service';
import { PermitLogService } from './permit-log.service';

@Module({
  imports: [forwardRef(() => ApprovalModule)],
  controllers: [PermitController, DraftController, AttachmentController, PermitLototoExecutionController],
  providers: [
    PermitService,
    PermitLototoExecutionService,
    DraftService,
    AttachmentService,
    PermitValidationService,
    PermitCacheService,
    PermitLogService,
    PermitJobsService,
  ],
  exports: [PermitService, PermitLototoExecutionService, PermitCacheService, PermitLogService],
})
export class PermitModule {}
