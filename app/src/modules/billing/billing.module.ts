import { Module } from '@nestjs/common';
import { BillingCacheService } from './billing-cache.service';
import { BillingJobsService } from './billing-jobs.service';
import { BillingLogService } from './billing-log.service';

/**
 * SP-08.01 INF: Redis plan/subscription/usage cache, Loki billing logs, BullMQ cycle/usage/renewal jobs.
 * Controllers and business services land in BE-SP-08.01 (PUS-211).
 */
@Module({
  providers: [BillingCacheService, BillingLogService, BillingJobsService],
  exports: [BillingCacheService, BillingLogService],
})
export class BillingModule {}
