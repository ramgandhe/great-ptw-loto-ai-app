import { Module } from '@nestjs/common';
import { RevalidationCacheService } from './revalidation-cache.service';
import { RevalidationJobsService } from './revalidation-jobs.service';
import { RevalidationLogService } from './revalidation-log.service';

@Module({
  providers: [RevalidationCacheService, RevalidationLogService, RevalidationJobsService],
  exports: [RevalidationCacheService, RevalidationLogService, RevalidationJobsService],
})
export class RevalidationModule {}
