import { Job } from 'bullmq';
import { LototoCacheService } from '../src/modules/lototo/lototo-cache.service';
import { LototoJobsService } from '../src/modules/lototo/lototo-jobs.service';
import { LototoLogService } from '../src/modules/lototo/lototo-log.service';
import {
  LOTOTO_NOTIFICATION_JOB,
  LOTOTO_PLANNING_REMINDER_JOB,
} from '../src/modules/lototo/lototo.constants';
import { QueueService } from '../src/infrastructure/queue/queue.service';

describe('LototoJobsService (PUS-155)', () => {
  const handlers = new Map<string, (job: Job) => Promise<void>>();
  const queueAdd = jest.fn().mockResolvedValue(undefined);

  const queueService = {
    registerHandler: jest.fn((name: string, handler: (job: Job) => Promise<void>) => {
      handlers.set(name, handler);
    }),
    getQueue: jest.fn().mockReturnValue({ add: queueAdd }),
  } as unknown as QueueService;

  const lototoLogService = {
    logEvent: jest.fn(),
  } as unknown as LototoLogService;

  const lototoCacheService = {
    invalidatePlan: jest.fn().mockResolvedValue(undefined),
    invalidateTenant: jest.fn().mockResolvedValue(undefined),
  } as unknown as LototoCacheService;

  const configService = {
    get: jest.fn().mockReturnValue('0 8 * * *'),
  };

  const service = new LototoJobsService(
    null as never,
    queueService,
    configService as never,
    lototoLogService,
    lototoCacheService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    handlers.clear();
  });

  it('registers LOTOTO notification handler and schedules planning reminders', async () => {
    await service.onModuleInit();

    expect(queueService.registerHandler).toHaveBeenCalledWith(
      LOTOTO_NOTIFICATION_JOB,
      expect.any(Function),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      LOTOTO_PLANNING_REMINDER_JOB,
      {},
      expect.objectContaining({ jobId: 'lototo-planning-reminder-schedule' }),
    );
  });

  it('processes notification jobs and invalidates LOTOTO cache', async () => {
    await service.onModuleInit();

    const handler = handlers.get(LOTOTO_NOTIFICATION_JOB);
    expect(handler).toBeDefined();

    await handler!({
      data: {
        planId: 'plan-1',
        permitId: 'permit-1',
        tenantId: 'tenant-1',
        action: 'plan_created',
        actorId: 'user-1',
      },
    } as Job);

    expect(lototoLogService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'lototo.notification.plan_created' }),
    );
    expect(lototoCacheService.invalidatePlan).toHaveBeenCalledWith(
      'tenant-1',
      'plan-1',
      'permit-1',
    );
    expect(lototoCacheService.invalidateTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('propagates handler failures for BullMQ retry', async () => {
    await service.onModuleInit();

    const handler = handlers.get(LOTOTO_NOTIFICATION_JOB);
    jest.spyOn(lototoLogService, 'logEvent').mockImplementation(() => {
      throw new Error('Loki unavailable');
    });

    await expect(
      handler!({
        data: {
          planId: 'plan-1',
          permitId: 'permit-1',
          tenantId: 'tenant-1',
          action: 'plan_created',
          actorId: 'user-1',
        },
      } as Job),
    ).rejects.toThrow('Loki unavailable');
  });
});
