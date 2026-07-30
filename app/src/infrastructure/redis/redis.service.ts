import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class RedisHealthService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async ping(): Promise<boolean> {
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect();
      }
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

@Injectable()
export class RedisConnectionService implements OnModuleInit {
  private readonly logger = new Logger(RedisConnectionService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
      this.logger.log(
        `Redis connected at ${this.configService.get('redis.host')}:${this.configService.get('redis.port')}`,
      );
    } catch (error) {
      this.logger.warn('Redis unavailable at startup — will retry on demand');
      this.logger.debug(error);
    }
  }
}
