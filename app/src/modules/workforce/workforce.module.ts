import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import {
  AgencyController,
  CompetencyController,
  ContractorController,
  EmployeeController,
  UserRoleController,
  WorkforceDirectoryController,
} from './workforce.controller';
import { WorkforceService } from './workforce.service';

@Module({
  imports: [LoggingModule],
  controllers: [
    EmployeeController,
    ContractorController,
    AgencyController,
    CompetencyController,
    WorkforceDirectoryController,
    UserRoleController,
  ],
  providers: [WorkforceService],
  exports: [WorkforceService],
})
export class WorkforceModule {}
