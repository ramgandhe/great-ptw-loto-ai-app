import { Module } from '@nestjs/common';
import { IsolationExecutionModule } from '../isolation-execution/isolation-execution.module';
import { ArchiveService } from './archive.service';
import { HistoryService } from './history.service';
import { LototoHistoryController } from './lototo-history.controller';
import { RestorationController } from './restoration.controller';
import { RestorationService } from './restoration.service';
import { VerificationService } from './verification.service';

@Module({
  imports: [IsolationExecutionModule],
  controllers: [RestorationController, LototoHistoryController],
  providers: [RestorationService, VerificationService, HistoryService, ArchiveService],
  exports: [RestorationService, HistoryService],
})
export class RestorationModule {}
