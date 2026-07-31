import { Module } from '@nestjs/common';
import { ConflictDetectionService } from './conflict-detection.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { RiskCalculationService } from './risk-calculation.service';
import { SimopsCacheService } from './simops-cache.service';
import { SimopsController } from './simops.controller';
import { SimopsEvidenceService } from './simops-evidence.service';
import { SimopsJobsService } from './simops-jobs.service';
import { SimopsLogService } from './simops-log.service';

@Module({
  controllers: [SimopsController],
  providers: [
    SimopsCacheService,
    SimopsLogService,
    SimopsJobsService,
    SimopsEvidenceService,
    RiskCalculationService,
    ConflictDetectionService,
    ConflictResolutionService,
  ],
  exports: [
    SimopsCacheService,
    SimopsLogService,
    SimopsJobsService,
    SimopsEvidenceService,
    ConflictDetectionService,
    ConflictResolutionService,
    RiskCalculationService,
  ],
})
export class SimopsModule {}
