import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { CLOSURE_NOTIFICATION_JOB } from './closure.constants';

export interface ClosureNotificationPayload {
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

  async enqueueClosureNotification(payload: ClosureNotificationPayload): Promise<void> {
    try {
      await this.queueService.getQueue().add(CLOSURE_NOTIFICATION_JOB, payload);
    } catch (error) {
      this.logger.warn(`Failed to enqueue closure notification for permit ${payload.permitId}`);
      this.logger.debug(error);
    }
  }
}
