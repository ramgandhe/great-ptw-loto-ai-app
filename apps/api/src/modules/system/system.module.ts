import { Module } from '@nestjs/common';
import { HealthController, SystemController } from './system.controller';
import { HealthService, SystemService } from './system.service';

@Module({
  controllers: [HealthController, SystemController],
  providers: [HealthService, SystemService],
  exports: [HealthService, SystemService],
})
export class SystemModule {}
