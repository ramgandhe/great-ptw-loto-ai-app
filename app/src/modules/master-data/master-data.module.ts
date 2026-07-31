import { Module } from '@nestjs/common';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';
import {
  PpeConfigurationAliasController,
  SafetyChecklistAliasController,
} from './master-data-alias.controller';
import { HazardController } from './hazard.controller';
import { HazardService } from './hazard.service';
import { ImportController } from './import.controller';
import { ImportJobsService } from './import-jobs.service';
import { ImportService } from './import.service';
import { MachineryController } from './machinery.controller';
import { MachineryService } from './machinery.service';
import { MasterDataCacheService } from './master-data-cache.service';
import { MasterDataLogService } from './master-data-log.service';
import { PermitTypeController } from './permit-type.controller';
import { PermitTypeService } from './permit-type.service';
import { PpeController } from './ppe.controller';
import { PpeService } from './ppe.service';
import { ReferenceIntegrityService } from './reference-integrity.service';
import { WorkstationController } from './workstation.controller';
import { WorkstationService } from './workstation.service';

@Module({
  controllers: [
    PermitTypeController,
    PpeController,
    WorkstationController,
    MachineryController,
    HazardController,
    ChecklistController,
    ImportController,
    PpeConfigurationAliasController,
    SafetyChecklistAliasController,
  ],
  providers: [
    PermitTypeService,
    PpeService,
    WorkstationService,
    MachineryService,
    HazardService,
    ChecklistService,
    ImportService,
    ImportJobsService,
    MasterDataCacheService,
    MasterDataLogService,
    ReferenceIntegrityService,
  ],
  exports: [
    PermitTypeService,
    PpeService,
    WorkstationService,
    MachineryService,
    HazardService,
    ChecklistService,
    MasterDataCacheService,
  ],
})
export class MasterDataModule {}
