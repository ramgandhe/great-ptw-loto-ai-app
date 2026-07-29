import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import {
  ApprovalWorkflowController,
  DepartmentController,
  LocationController,
  NotificationPreferenceController,
  OrganisationController,
  PermitTemplateController,
  PlantController,
} from './organisation.controller';
import { OrganisationService } from './organisation.service';

@Module({
  imports: [LoggingModule],
  controllers: [
    OrganisationController,
    PlantController,
    DepartmentController,
    LocationController,
    ApprovalWorkflowController,
    PermitTemplateController,
    NotificationPreferenceController,
  ],
  providers: [OrganisationService],
  exports: [OrganisationService],
})
export class OrganisationModule {}
