import { Module, forwardRef } from '@nestjs/common';
import { DailyProgressModule } from '../daily-progress/daily-progress.module';
import { LoggingModule } from '../logging/logging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SimopsModule } from '../simops/simops.module';
import { MdpOpsService } from './mdp-ops.service';
import { RevalidationCacheService } from './revalidation-cache.service';
import { RevalidationController } from './revalidation.controller';
import { RevalidationJobsService } from './revalidation-jobs.service';
import { RevalidationLogService } from './revalidation-log.service';
import { RevalidationNotificationService } from './revalidation-notification.service';
import { RevalidationService } from './revalidation.service';

@Module({
  imports: [
    LoggingModule,
    NotificationsModule,
    SimopsModule,
    forwardRef(() => DailyProgressModule),
  ],
  controllers: [RevalidationController],
  providers: [
    RevalidationService,
    MdpOpsService,
    RevalidationCacheService,
    RevalidationLogService,
    RevalidationNotificationService,
    RevalidationJobsService,
  ],
  exports: [
    RevalidationService,
    MdpOpsService,
    RevalidationCacheService,
    RevalidationLogService,
  ],
})
export class RevalidationModule {}
