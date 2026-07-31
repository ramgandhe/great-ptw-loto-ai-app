import { readFileSync } from 'fs';
import { join } from 'path';
import { NotificationCacheService } from '../app/src/modules/notifications/notification-cache.service';
import { NotificationJobsService } from '../app/src/modules/notifications/notification-jobs.service';
import { NotificationLogService } from '../app/src/modules/notifications/notification-log.service';

const repoRoot = join(__dirname, '..');

describe('Notifications infra services (PUS-205)', () => {
  it('NotificationCacheService builds tenant/user-scoped keys and invalidates', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const cache = new NotificationCacheService(
      { del } as never,
      { get: () => 300 } as never,
    );
    expect(cache.listKey('t1', 'u1')).toBe('notification:list:t1:u1');
    expect(cache.unreadCountKey('t1', 'u1')).toBe('notification:unread:t1:u1');

    await cache.invalidateUser('t1', 'u1');
    expect(del).toHaveBeenCalledWith('notification:list:t1:u1');
    expect(del).toHaveBeenCalledWith('notification:unread:t1:u1');
  });

  it('NotificationLogService emits a Loki-tagged structured event', () => {
    const log = new NotificationLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);
    log.logEvent({ action: 'notification.delivery-retry', notificationId: 'n1' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ loki: true, action: 'notification.delivery-retry' }),
    );
  });

  it('NotificationJobsService flags failed recipients due for retry', async () => {
    const failed = [
      {
        id: 'r1',
        tenantId: 't1',
        notificationId: 'n1',
        userId: 'u1',
        channel: 'email',
        retryCount: 1,
      },
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(failed) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new NotificationJobsService(
      db as never,
      {} as never,
      { get: () => '*/5 * * * *' } as never,
      logService as never,
    );

    await jobs.processDeliveryRetries();
    expect(logService.logEvent).toHaveBeenCalledTimes(1);
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'notification.delivery-retry',
        recipientId: 'r1',
        notificationId: 'n1',
      }),
    );
  });

  it('NotificationJobsService emits task-reminder events', async () => {
    const reminders = [
      {
        id: 'n2',
        tenantId: 't1',
        title: 'Pending approval',
        entityType: 'permit',
        entityId: 'p1',
      },
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(reminders) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new NotificationJobsService(
      db as never,
      {} as never,
      { get: () => '0 7 * * *' } as never,
      logService as never,
    );

    await jobs.emitTaskReminders();
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'notification.task-reminder',
        notificationId: 'n2',
      }),
    );
  });

  it('.env.example and deployment docs cover notification infra knobs', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    expect(envExample).toMatch(/NOTIFICATION_DELIVERY_RETRY_CRON/);
    expect(envExample).toMatch(/NOTIFICATION_TASK_REMINDER_CRON/);
    expect(envExample).toMatch(/NOTIFICATION_CACHE_TTL_SECONDS/);
    expect(deployment).toMatch(/notification\.delivery-retry/);
    expect(deployment).toMatch(/NOTIFICATION_TASK_REMINDER_CRON/);
  });
});
