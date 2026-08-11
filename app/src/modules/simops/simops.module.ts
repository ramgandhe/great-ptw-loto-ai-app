import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { ConflictResolutionService } from './conflict-resolution.service';
import { SimopsController } from './simops.controller';
import { SimopsJobsService } from './simops-jobs.service';
import { SimopsService } from './simops.service';

@Module({
  imports: [LoggingModule],
  controllers: [SimopsController],
  providers: [SimopsService, ConflictResolutionService, SimopsJobsService],
  exports: [SimopsService, ConflictResolutionService],
})
export class SimopsModule {}
