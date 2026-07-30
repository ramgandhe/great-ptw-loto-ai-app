import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { EXECUTION_NOTIFICATION_JOB } from './execution.constants';

export interface ExecutionNotificationPayload {
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

  async enqueueExecutionNotification(payload: ExecutionNotificationPayload): Promise<void> {
    try {
      await this.queueService.getQueue().add(EXECUTION_NOTIFICATION_JOB, payload);
    } catch (error) {
      this.logger.warn(`Failed to enqueue execution notification for permit ${payload.permitId}`);
      this.logger.debug(error);
    }
  }
}
