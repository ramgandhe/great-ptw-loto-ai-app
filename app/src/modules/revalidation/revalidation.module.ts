import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { RevalidationCacheService } from './revalidation-cache.service';
import { RevalidationController } from './revalidation.controller';
import { RevalidationJobsService } from './revalidation-jobs.service';
import { RevalidationLogService } from './revalidation-log.service';
import { RevalidationService } from './revalidation.service';

@Module({
  imports: [LoggingModule],
  controllers: [RevalidationController],
  providers: [
    RevalidationService,
    RevalidationCacheService,
    RevalidationLogService,
    RevalidationJobsService,
  ],
  exports: [RevalidationService, RevalidationCacheService, RevalidationLogService],
})
export class RevalidationModule {}
