import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { BillingCacheService } from './billing-cache.service';
import { BillingController } from './billing.controller';
import { BillingJobsService } from './billing-jobs.service';
import { BillingLogService } from './billing-log.service';
import { BillingService, UsageTrackingService } from './billing.service';
import { PlanChangeService } from './plan-change.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [LoggingModule],
  controllers: [SubscriptionController, BillingController],
  providers: [
    BillingCacheService,
    BillingLogService,
    BillingJobsService,
    SubscriptionService,
    PlanChangeService,
    BillingService,
    UsageTrackingService,
  ],
  exports: [
    BillingCacheService,
    BillingLogService,
    SubscriptionService,
    BillingService,
    UsageTrackingService,
  ],
})
export class BillingModule {}
