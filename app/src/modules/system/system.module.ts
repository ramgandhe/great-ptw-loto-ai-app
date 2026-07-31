import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisInfrastructureModule } from '../../infrastructure/redis';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { HealthController, SystemController } from './system.controller';
import { HealthService, SystemService } from './system.service';

@Module({
  imports: [DatabaseModule, RedisInfrastructureModule, StorageModule, QueueModule],
  controllers: [HealthController, SystemController],
  providers: [HealthService, SystemService],
  exports: [HealthService, SystemService],
})
export class SystemModule {}
