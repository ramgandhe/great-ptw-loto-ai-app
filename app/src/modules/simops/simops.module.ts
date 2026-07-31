import { Module } from '@nestjs/common';
import { SimopsCacheService } from './simops-cache.service';
import { SimopsEvidenceService } from './simops-evidence.service';
import { SimopsJobsService } from './simops-jobs.service';
import { SimopsLogService } from './simops-log.service';

/**
 * SIMOPS Conflict Detection + Resolution infrastructure
 * (SP-04.01 / PUS-170, SP-04.02 / PUS-175).
 * Controllers and workflow services land in BE tickets.
 */
@Module({
  providers: [
    SimopsCacheService,
    SimopsLogService,
    SimopsJobsService,
    SimopsEvidenceService,
  ],
  exports: [
    SimopsCacheService,
    SimopsLogService,
    SimopsJobsService,
    SimopsEvidenceService,
  ],
})
export class SimopsModule {}
