import { Module } from '@nestjs/common';
import { IsolationCacheService } from './isolation-cache.service';
import { IsolationExecutionController } from './isolation-execution.controller';
import { IsolationExecutionService } from './isolation-execution.service';
import { IsolationJobsService } from './isolation-jobs.service';
import { IsolationLogService } from './isolation-log.service';
import { LockController } from './lock.controller';
import { LockService } from './lock.service';
import { StatusValidationService } from './status-validation.service';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  controllers: [
    IsolationExecutionController,
    LockController,
    TagController,
    VerificationController,
  ],
  providers: [
    IsolationExecutionService,
    LockService,
    TagService,
    VerificationService,
    StatusValidationService,
    IsolationCacheService,
    IsolationLogService,
    IsolationJobsService,
  ],
  exports: [IsolationExecutionService],
})
export class IsolationExecutionModule {}
