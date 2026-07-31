import { Module } from '@nestjs/common';
import { PermitModule } from '../permit/permit.module';
import { EquipmentService } from './equipment.service';
import { IsolationController } from './isolation.controller';
import { IsolationService } from './isolation.service';
import { LototoController } from './lototo.controller';
import { LototoLogService } from './lototo-log.service';
import { LototoService } from './lototo.service';
import { LototoValidationService } from './lototo-validation.service';
import { SequenceService } from './sequence.service';

@Module({
  imports: [PermitModule],
  controllers: [LototoController, IsolationController],
  providers: [
    LototoService,
    IsolationService,
    EquipmentService,
    SequenceService,
    LototoValidationService,
    LototoLogService,
  ],
  exports: [LototoService, IsolationService, SequenceService],
})
export class LototoModule {}
