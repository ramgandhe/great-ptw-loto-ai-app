import { Global, Module } from '@nestjs/common';
import { RedisModule } from './redis.module';
import { CacheService } from './cache.service';
import { RedisConnectionService, RedisHealthService } from './redis.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [RedisConnectionService, RedisHealthService, CacheService],
  exports: [RedisModule, RedisHealthService, CacheService],
})
export class RedisInfrastructureModule {}
