import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const password = configService.get<string>('redis.password');
        return new Redis({
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          ...(password ? { password } : {}),
          maxRetriesPerRequest: null,
          lazyConnect: true,
          // Fail cache/health commands fast when Redis is unreachable instead of
          // queueing them indefinitely, so the API (and CI without Redis)
          // degrades gracefully via CacheService's try/catch rather than hanging.
          enableOfflineQueue: false,
          commandTimeout: 2000,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // Redis may never have connected (e.g. unavailable); force-close quietly.
      this.redis.disconnect();
    }
  }
}
