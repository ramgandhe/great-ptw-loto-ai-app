import { Module } from '@nestjs/common';
import { SimopsCacheService } from './simops-cache.service';
import { SimopsJobsService } from './simops-jobs.service';
import { SimopsLogService } from './simops-log.service';

/**
 * SIMOPS Conflict Detection infrastructure (SP-04.01 / PUS-170).
 * Controllers and detection analysis land in BE-SP-04.01 (PUS-166).
 */
@Module({
  providers: [SimopsCacheService, SimopsLogService, SimopsJobsService],
  exports: [SimopsCacheService, SimopsLogService, SimopsJobsService],
})
export class SimopsModule {}
