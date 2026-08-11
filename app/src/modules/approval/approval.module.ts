import { forwardRef, Module } from '@nestjs/common';
import { PermitModule } from '../permit/permit.module';
import { ApprovalAttachmentService } from './approval-attachment.service';
import { ApprovalController } from './approval.controller';
import { ApprovalCacheService } from './approval-cache.service';
import { ApprovalEscalationService } from './approval-escalation.service';
import { ApprovalHistoryService } from './approval-history.service';
import { ApprovalJobsService } from './approval-jobs.service';
import { ApprovalLogService } from './approval-log.service';
import { ApprovalService } from './approval.service';
import { DelegationController } from './delegation.controller';
import { DelegationService } from './delegation.service';
import { NotificationService } from './notification.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowEngineService } from './workflow-engine.service';

@Module({
  imports: [forwardRef(() => PermitModule)],
  controllers: [ApprovalController, WorkflowController, DelegationController],
  providers: [
    ApprovalService,
    WorkflowEngineService,
    ApprovalHistoryService,
    NotificationService,
    ApprovalCacheService,
    ApprovalLogService,
    ApprovalJobsService,
    ApprovalAttachmentService,
    ApprovalEscalationService,
    DelegationService,
  ],
  exports: [
    ApprovalService,
    WorkflowEngineService,
    ApprovalHistoryService,
    ApprovalCacheService,
    ApprovalLogService,
    ApprovalEscalationService,
    DelegationService,
  ],
})
export class ApprovalModule {}
