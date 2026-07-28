import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export const PLATFORM_QUEUE = 'platform-queue';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = {
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
    };

    this.queue = new Queue(PLATFORM_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.worker = new Worker(
      PLATFORM_QUEUE,
      async (job) => {
        this.logger.debug(`Processing job ${job.id}: ${job.name}`);
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed: ${error.message}`);
    });

    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect();
      }
      this.logger.log('BullMQ queue initialised');
    } catch {
      this.logger.warn('BullMQ queue initialised but Redis unavailable');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  getQueue(): Queue {
    return this.queue;
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect();
      }
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
