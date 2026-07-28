import { Module } from '@nestjs/common';
import { PermitModule } from '../permit/permit.module';
import { ApprovalController } from './approval.controller';
import { ApprovalHistoryService } from './approval-history.service';
import { ApprovalService } from './approval.service';
import { NotificationService } from './notification.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowEngineService } from './workflow-engine.service';

@Module({
  imports: [PermitModule],
  controllers: [ApprovalController, WorkflowController],
  providers: [
    ApprovalService,
    WorkflowEngineService,
    ApprovalHistoryService,
    NotificationService,
  ],
  exports: [ApprovalService, WorkflowEngineService, ApprovalHistoryService],
})
export class ApprovalModule {}
