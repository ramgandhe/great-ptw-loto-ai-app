import { Module } from '@nestjs/common';
import { PermitModule } from '../permit/permit.module';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { StatusTransitionService } from './status-transition.service';

@Module({
  imports: [PermitModule],
  controllers: [ExecutionController],
  providers: [ExecutionService, StatusTransitionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
