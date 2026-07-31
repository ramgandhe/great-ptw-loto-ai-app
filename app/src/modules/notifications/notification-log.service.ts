import { Injectable, Logger } from '@nestjs/common';

export interface NotificationLogEvent {
  action: string;
  notificationId?: string;
  recipientId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationLogService {
  private readonly logger = new Logger(NotificationLogService.name);

  logEvent(event: NotificationLogEvent): void {
    this.logger.log({
      msg: 'notification.event',
      domain: 'notifications',
      module: 'notification-delivery',
      loki: true,
      ...event,
    });
  }
}
