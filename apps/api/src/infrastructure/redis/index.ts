import { Global, Module } from '@nestjs/common';
import { RedisModule } from './redis.module';
import { RedisConnectionService, RedisHealthService } from './redis.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [RedisConnectionService, RedisHealthService],
  exports: [RedisModule, RedisHealthService],
})
export class RedisInfrastructureModule {}
