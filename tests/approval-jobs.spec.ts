import { Job } from 'bullmq';
import { ApprovalCacheService } from '../app/src/modules/approval/approval-cache.service';
import { ApprovalJobsService } from '../app/src/modules/approval/approval-jobs.service';
import { ApprovalLogService } from '../app/src/modules/approval/approval-log.service';
import { APPROVAL_NOTIFICATION_JOB } from '../app/src/modules/approval/approval.constants';
import { QueueService } from '../app/src/infrastructure/queue/queue.service';

describe('ApprovalJobsService (PUS-140)', () => {
  const handlers = new Map<string, (job: Job) => Promise<void>>();
  const queueAdd = jest.fn().mockResolvedValue(undefined);

  const queueService = {
    registerHandler: jest.fn((name: string, handler: (job: Job) => Promise<void>) => {
      handlers.set(name, handler);
    }),
    getQueue: jest.fn().mockReturnValue({ add: queueAdd }),
  } as unknown as QueueService;

  const approvalLogService = {
    logEvent: jest.fn(),
  } as unknown as ApprovalLogService;

  const approvalCacheService = {
    invalidateTenant: jest.fn().mockResolvedValue(undefined),
  } as unknown as ApprovalCacheService;

  const configService = {
    get: jest.fn().mockReturnValue('0 8 * * *'),
  };

  const service = new ApprovalJobsService(
    null as never,
    queueService,
    configService as never,
    approvalLogService,
    approvalCacheService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    handlers.clear();
  });

  it('registers approval notification handler and schedules reminders', async () => {
    await service.onModuleInit();

    expect(queueService.registerHandler).toHaveBeenCalledWith(
      APPROVAL_NOTIFICATION_JOB,
      expect.any(Function),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      'approval.reminder',
      {},
      expect.objectContaining({ jobId: 'approval-reminder-schedule' }),
    );
  });

  it('processes notification jobs and invalidates approval cache', async () => {
    await service.onModuleInit();

    const handler = handlers.get(APPROVAL_NOTIFICATION_JOB);
    expect(handler).toBeDefined();

    await handler!({
      data: {
        permitId: 'permit-1',
        tenantId: 'tenant-1',
        action: 'approved',
        actorId: 'user-1',
      },
    } as Job);

    expect(approvalLogService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approval.notification.approved' }),
    );
    expect(approvalCacheService.invalidateTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('propagates handler failures for BullMQ retry', async () => {
    await service.onModuleInit();

    const handler = handlers.get(APPROVAL_NOTIFICATION_JOB);
    jest.spyOn(approvalLogService, 'logEvent').mockImplementation(() => {
      throw new Error('Loki unavailable');
    });

    await expect(
      handler!({
        data: {
          permitId: 'permit-1',
          tenantId: 'tenant-1',
          action: 'approved',
          actorId: 'user-1',
        },
      } as Job),
    ).rejects.toThrow('Loki unavailable');
  });
});
