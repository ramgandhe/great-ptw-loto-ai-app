import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { SimopsController } from './simops.controller';
import { ConflictResolutionService } from './conflict-resolution.service';
import { SimopsService } from './simops.service';

@Module({
  imports: [LoggingModule],
  controllers: [SimopsController],
  providers: [SimopsService, ConflictResolutionService],
  exports: [SimopsService, ConflictResolutionService],
})
export class SimopsModule {}
