import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { Job, JobsOptions, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { assertIdsOnly } from './tenant-job';

export const PLATFORM_QUEUE = 'platform-queue';

// NFR-SEC-008: failed jobs are kept for at most 7 days. Age-based removal in BullMQ is lazy (it runs only when
// another job finishes), so a quiet queue could keep one longer; removing at final failure meets the bound.
// The worker's 'failed' handler logs the job name, ID and error, which is what remains for investigation.
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: true,
};

export type QueueJobHandler = (job: Job) => Promise<void>;

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queue!: Queue;
  private worker!: Worker;
  private readonly handlers = new Map<string, QueueJobHandler>();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  registerHandler(name: string, handler: QueueJobHandler): void {
    this.handlers.set(name, handler);
  }

  async onModuleInit(): Promise<void> {
    const password = this.configService.get<string>('redis.password');
    const connection = {
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      ...(password ? { password } : {}),
    };

    this.queue = new Queue(PLATFORM_QUEUE, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    const concurrency = this.configService.get<number>('bullmq.workerConcurrency') ?? 5;

    this.worker = new Worker(
      PLATFORM_QUEUE,
      async (job) => {
        const handler = this.handlers.get(job.name);
        if (handler) {
          await handler(job);
          return;
        }
        this.logger.debug(`No handler registered for job ${job.id}: ${job.name}`);
      },
      { connection, concurrency },
    );

    // Fires on every attempt, retries included. With removeOnFail the job is gone afterwards, so this line is the
    // only trace: payloads hold IDs only (NFR-SEC-008), so the tenant ID is safe to log.
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Job ${job?.name} ${job?.id} (tenant ${job?.data?.tenantId}) failed, attempt ${job?.attemptsMade}/${job?.opts.attempts}: ${error.message}`,
      );
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

  /** The only way to enqueue tenant work: payloads are checked to hold record IDs only (NFR-SEC-008). */
  async enqueueTenantJob(name: string, payload: Record<string, unknown>): Promise<void> {
    assertIdsOnly(payload);
    await this.queue.add(name, payload);
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
