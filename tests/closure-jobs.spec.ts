import { Job } from 'bullmq';
import { ClosureCacheService } from '../app/src/modules/closure/closure-cache.service';
import { ClosureJobsService } from '../app/src/modules/closure/closure-jobs.service';
import { ClosureLogService } from '../app/src/modules/closure/closure-log.service';
import {
  CLOSURE_ARCHIVE_JOB,
  CLOSURE_NOTIFICATION_JOB,
  CLOSURE_REPORT_JOB,
} from '../app/src/modules/closure/closure.constants';
import { QueueService } from '../app/src/infrastructure/queue/queue.service';

describe('ClosureJobsService (PUS-150)', () => {
  const handlers = new Map<string, (job: Job) => Promise<void>>();
  const queueAdd = jest.fn().mockResolvedValue(undefined);

  const queueService = {
    registerHandler: jest.fn((name: string, handler: (job: Job) => Promise<void>) => {
      handlers.set(name, handler);
    }),
    getQueue: jest.fn().mockReturnValue({ add: queueAdd }),
  } as unknown as QueueService;

  const closureLogService = {
    logEvent: jest.fn(),
  } as unknown as ClosureLogService;

  const closureCacheService = {
    invalidateTenant: jest.fn().mockResolvedValue(undefined),
  } as unknown as ClosureCacheService;

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'closure.archiveCron') return '0 3 * * *';
      if (key === 'closure.reportCron') return '0 4 * * 1';
      return undefined;
    }),
  };

  const service = new ClosureJobsService(
    null as never,
    queueService,
    configService as never,
    closureLogService,
    closureCacheService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    handlers.clear();
  });

  it('registers closure handlers and schedules archive/report jobs', async () => {
    await service.onModuleInit();

    expect(queueService.registerHandler).toHaveBeenCalledWith(
      CLOSURE_NOTIFICATION_JOB,
      expect.any(Function),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      CLOSURE_ARCHIVE_JOB,
      {},
      expect.objectContaining({ jobId: 'closure-archive-schedule' }),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      CLOSURE_REPORT_JOB,
      {},
      expect.objectContaining({ jobId: 'closure-report-schedule' }),
    );
  });

  it('processes notification jobs and invalidates closure cache', async () => {
    await service.onModuleInit();

    const handler = handlers.get(CLOSURE_NOTIFICATION_JOB);
    expect(handler).toBeDefined();

    await handler!({
      data: {
        permitId: 'permit-1',
        tenantId: 'tenant-1',
        action: 'closed',
        actorId: 'user-1',
      },
    } as Job);

    expect(closureLogService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'closure.notification.closed' }),
    );
    expect(closureCacheService.invalidateTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('propagates handler failures for BullMQ retry', async () => {
    await service.onModuleInit();

    const handler = handlers.get(CLOSURE_NOTIFICATION_JOB);
    jest.spyOn(closureLogService, 'logEvent').mockImplementation(() => {
      throw new Error('Loki unavailable');
    });

    await expect(
      handler!({
        data: {
          permitId: 'permit-1',
          tenantId: 'tenant-1',
          action: 'verified',
          actorId: 'user-1',
        },
      } as Job),
    ).rejects.toThrow('Loki unavailable');
  });
});
