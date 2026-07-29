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
import { PermitLogService } from './permit-log.service';

@Module({
  imports: [forwardRef(() => ApprovalModule)],
  controllers: [PermitController, DraftController, AttachmentController],
  providers: [
    PermitService,
    DraftService,
    AttachmentService,
    PermitValidationService,
    PermitCacheService,
    PermitLogService,
    PermitJobsService,
  ],
  exports: [PermitService, PermitCacheService, PermitLogService],
})
export class PermitModule {}
