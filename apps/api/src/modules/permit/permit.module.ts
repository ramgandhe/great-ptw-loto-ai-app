import { Module } from '@nestjs/common';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';
import { PermitController } from './permit.controller';
import { PermitService } from './permit.service';
import { PermitValidationService } from './permit-validation.service';

@Module({
  controllers: [PermitController, DraftController, AttachmentController],
  providers: [
    PermitService,
    DraftService,
    AttachmentService,
    PermitValidationService,
  ],
  exports: [PermitService],
})
export class PermitModule {}
