import { Job } from 'bullmq';
import { ExecutionCacheService } from '../src/modules/execution/execution-cache.service';
import { ExecutionJobsService } from '../src/modules/execution/execution-jobs.service';
import { ExecutionLogService } from '../src/modules/execution/execution-log.service';
import {
  EXECUTION_NOTIFICATION_JOB,
  EXECUTION_REMINDER_JOB,
} from '../src/modules/execution/execution.constants';
import { QueueService } from '../src/infrastructure/queue/queue.service';

describe('ExecutionJobsService (PUS-145)', () => {
  const handlers = new Map<string, (job: Job) => Promise<void>>();
  const queueAdd = jest.fn().mockResolvedValue(undefined);

  const queueService = {
    registerHandler: jest.fn((name: string, handler: (job: Job) => Promise<void>) => {
      handlers.set(name, handler);
    }),
    getQueue: jest.fn().mockReturnValue({ add: queueAdd }),
  } as unknown as QueueService;

  const executionLogService = {
    logEvent: jest.fn(),
  } as unknown as ExecutionLogService;

  const executionCacheService = {
    invalidateTenant: jest.fn().mockResolvedValue(undefined),
  } as unknown as ExecutionCacheService;

  const configService = {
    get: jest.fn().mockReturnValue('0 8 * * *'),
  };

  const service = new ExecutionJobsService(
    null as never,
    queueService,
    configService as never,
    executionLogService,
    executionCacheService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    handlers.clear();
  });

  it('registers execution notification handler and schedules reminders', async () => {
    await service.onModuleInit();

    expect(queueService.registerHandler).toHaveBeenCalledWith(
      EXECUTION_NOTIFICATION_JOB,
      expect.any(Function),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      EXECUTION_REMINDER_JOB,
      {},
      expect.objectContaining({ jobId: 'execution-reminder-schedule' }),
    );
  });

  it('processes notification jobs and invalidates execution cache', async () => {
    await service.onModuleInit();

    const handler = handlers.get(EXECUTION_NOTIFICATION_JOB);
    expect(handler).toBeDefined();

    await handler!({
      data: {
        permitId: 'permit-1',
        tenantId: 'tenant-1',
        action: 'activated',
        actorId: 'user-1',
      },
    } as Job);

    expect(executionLogService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'execution.notification.activated' }),
    );
    expect(executionCacheService.invalidateTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('propagates handler failures for BullMQ retry', async () => {
    await service.onModuleInit();

    const handler = handlers.get(EXECUTION_NOTIFICATION_JOB);
    jest.spyOn(executionLogService, 'logEvent').mockImplementation(() => {
      throw new Error('Loki unavailable');
    });

    await expect(
      handler!({
        data: {
          permitId: 'permit-1',
          tenantId: 'tenant-1',
          action: 'activated',
          actorId: 'user-1',
        },
      } as Job),
    ).rejects.toThrow('Loki unavailable');
  });
});
