import { forwardRef, Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PermitModule } from '../permit/permit.module';
import { ApprovalAttachmentService } from './approval-attachment.service';
import { ApprovalController } from './approval.controller';
import { ApprovalCacheService } from './approval-cache.service';
import { ApprovalHistoryService } from './approval-history.service';
import { ApprovalJobsService } from './approval-jobs.service';
import { ApprovalLogService } from './approval-log.service';
import { ApprovalService } from './approval.service';
import { DelegationService } from './delegation.service';
import { NotificationService } from './notification.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowEngineService } from './workflow-engine.service';

@Module({
  imports: [forwardRef(() => PermitModule), NotificationsModule],
  controllers: [ApprovalController, WorkflowController],
  providers: [
    ApprovalService,
    WorkflowEngineService,
    DelegationService,
    ApprovalHistoryService,
    NotificationService,
    ApprovalCacheService,
    ApprovalLogService,
    ApprovalJobsService,
    ApprovalAttachmentService,
  ],
  exports: [
    ApprovalService,
    WorkflowEngineService,
    ApprovalHistoryService,
    ApprovalCacheService,
    ApprovalLogService,
  ],
})
export class ApprovalModule {}
