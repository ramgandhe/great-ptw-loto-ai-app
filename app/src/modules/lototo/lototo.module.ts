import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PermitModule } from '../permit/permit.module';
import { EquipmentService } from './equipment.service';
import { IsolationController } from './isolation.controller';
import { IsolationService } from './isolation.service';
import { LototoController } from './lototo.controller';
import { LototoCacheService } from './lototo-cache.service';
import { LototoJobsService } from './lototo-jobs.service';
import { LototoLogService } from './lototo-log.service';
import { LototoService } from './lototo.service';
import { LototoValidationService } from './lototo-validation.service';
import { NotificationService } from './notification.service';
import { SequenceService } from './sequence.service';

@Module({
  imports: [PermitModule, NotificationsModule],
  controllers: [LototoController, IsolationController],
  providers: [
    LototoService,
    IsolationService,
    EquipmentService,
    SequenceService,
    LototoValidationService,
    LototoLogService,
    LototoCacheService,
    LototoJobsService,
    NotificationService,
  ],
  exports: [LototoService, IsolationService, SequenceService, LototoCacheService, LototoLogService],
})
export class LototoModule {}
