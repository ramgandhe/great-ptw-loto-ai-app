import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/execution.module';
import { PermitModule } from '../permit/permit.module';
import { ArchiveController } from './archive.controller';
import { ArchiveService } from './archive.service';
import { ClosureController } from './closure.controller';
import { ClosureLogService } from './closure-log.service';
import { ClosureService } from './closure.service';
import { HistoryService } from './history.service';
import { VerificationService } from './verification.service';

@Module({
  imports: [PermitModule, ExecutionModule],
  controllers: [ArchiveController, ClosureController],
  providers: [
    VerificationService,
    ClosureService,
    ArchiveService,
    HistoryService,
    ClosureLogService,
  ],
  exports: [VerificationService, ClosureService, ArchiveService, HistoryService],
})
export class ClosureModule {}
