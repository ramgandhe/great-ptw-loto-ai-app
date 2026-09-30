import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EquipmentService } from './equipment.service';
import { IsolationController } from './isolation.controller';
import { IsolationService } from './isolation.service';
import { LototoController } from './lototo.controller';
import { LototoProcedureController, LototoProcedureVersionController } from './lototo-procedure.controller';
import { LototoCacheService } from './lototo-cache.service';
import { LototoJobsService } from './lototo-jobs.service';
import { LototoLogService } from './lototo-log.service';
import { LototoService } from './lototo.service';
import { LototoProcedureService } from './lototo-procedure.service';
import { LototoValidationService } from './lototo-validation.service';
import { NotificationService } from './notification.service';
import { SequenceService } from './sequence.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LototoController, IsolationController, LototoProcedureController, LototoProcedureVersionController],
  providers: [
    LototoService,
    LototoProcedureService,
    IsolationService,
    EquipmentService,
    SequenceService,
    LototoValidationService,
    LototoLogService,
    LototoCacheService,
    LototoJobsService,
    NotificationService,
  ],
  exports: [LototoService, LototoProcedureService, IsolationService, SequenceService, LototoCacheService, LototoLogService],
})
export class LototoModule {}
