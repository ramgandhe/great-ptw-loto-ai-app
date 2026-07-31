import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { LOTOTO_NOTIFICATION_JOB } from './lototo.constants';

export interface LototoNotificationPayload {
  planId: string;
  permitId: string;
  tenantId: string;
  action: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly queueService: QueueService) {}

  async enqueuePlanningNotification(payload: LototoNotificationPayload): Promise<void> {
    try {
      await this.queueService.getQueue().add(LOTOTO_NOTIFICATION_JOB, payload);
    } catch (error) {
      this.logger.warn(`Failed to enqueue LOTOTO notification for plan ${payload.planId}`);
      this.logger.debug(error);
    }
  }
}
