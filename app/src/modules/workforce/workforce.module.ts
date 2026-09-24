import { Module } from '@nestjs/common';
import { KeycloakAdminModule } from '../../infrastructure/keycloak/keycloak-admin.module';
import { LoggingModule } from '../logging/logging.module';
import { TenantUsersService } from './tenant-users.service';
import {
  AgencyController,
  CompetencyController,
  ContractorController,
  EmployeeController,
  TenantUsersController,
  WorkforceDirectoryController,
} from './workforce.controller';
import { WorkforceService } from './workforce.service';

@Module({
  imports: [LoggingModule, KeycloakAdminModule],
  controllers: [
    EmployeeController,
    ContractorController,
    AgencyController,
    CompetencyController,
    WorkforceDirectoryController,
    TenantUsersController,
  ],
  providers: [WorkforceService, TenantUsersService],
  exports: [WorkforceService],
})
export class WorkforceModule {}
