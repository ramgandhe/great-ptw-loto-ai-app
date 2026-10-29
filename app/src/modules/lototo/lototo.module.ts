import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EquipmentService } from './equipment.service';
import { IsolationController } from './isolation.controller';
import { IsolationService } from './isolation.service';
import { LototoController, LototoEnergySourcesController } from './lototo.controller';
import { LototoProcedureController, LototoProcedureVersionController } from './lototo-procedure.controller';
import { IsolationCertificateController } from './isolation-certificate.controller';
import { ZveVerificationController } from './zve-verification.controller';
import { IsolationLockboxController } from './isolation-lockbox.controller';
import { IsolationBlindController } from './isolation-blind.controller';
import { IsolationCustodyController } from './isolation-custody.controller';
import { LototoCacheService } from './lototo-cache.service';
import { LototoJobsService } from './lototo-jobs.service';
import { LototoLogService } from './lototo-log.service';
import { LototoService } from './lototo.service';
import { LototoProcedureService } from './lototo-procedure.service';
import { IsolationCertificateService } from './isolation-certificate.service';
import { ZveVerificationService } from './zve-verification.service';
import { IsolationLockboxService } from './isolation-lockbox.service';
import { IsolationBlindService } from './isolation-blind.service';
import { IsolationCustodyService } from './isolation-custody.service';
import { LototoValidationService } from './lototo-validation.service';
import { NotificationService } from './notification.service';
import { SequenceService } from './sequence.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    LototoEnergySourcesController,
    LototoController,
    IsolationController,
    LototoProcedureController,
    LototoProcedureVersionController,
    IsolationCertificateController,
    ZveVerificationController,
    IsolationLockboxController,
    IsolationBlindController,
    IsolationCustodyController,
  ],
  providers: [
    LototoService,
    LototoProcedureService,
    IsolationCertificateService,
    ZveVerificationService,
    IsolationLockboxService,
    IsolationBlindService,
    IsolationCustodyService,
    IsolationService,
    EquipmentService,
    SequenceService,
    LototoValidationService,
    LototoLogService,
    LototoCacheService,
    LototoJobsService,
    NotificationService,
  ],
  exports: [
    LototoService,
    LototoProcedureService,
    IsolationCertificateService,
    ZveVerificationService,
    IsolationLockboxService,
    IsolationBlindService,
    IsolationService,
    SequenceService,
    LototoCacheService,
    LototoLogService,
  ],
})
export class LototoModule {}
