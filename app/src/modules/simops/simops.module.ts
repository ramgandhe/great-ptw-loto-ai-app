import { Module } from '@nestjs/common';
import { ConflictDetectionService } from './conflict-detection.service';
import { RiskCalculationService } from './risk-calculation.service';
import { SimopsCacheService } from './simops-cache.service';
import { SimopsController } from './simops.controller';
import { SimopsJobsService } from './simops-jobs.service';
import { SimopsLogService } from './simops-log.service';

@Module({
  controllers: [SimopsController],
  providers: [
    SimopsCacheService,
    SimopsLogService,
    SimopsJobsService,
    RiskCalculationService,
    ConflictDetectionService,
  ],
  exports: [
    SimopsCacheService,
    SimopsLogService,
    SimopsJobsService,
    ConflictDetectionService,
    RiskCalculationService,
  ],
})
export class SimopsModule {}
