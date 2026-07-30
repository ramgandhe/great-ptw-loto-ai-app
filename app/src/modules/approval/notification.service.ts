import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { APPROVAL_NOTIFICATION_JOB } from './approval.constants';

export interface ApprovalNotificationPayload {
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

  async enqueueApprovalNotification(payload: ApprovalNotificationPayload): Promise<void> {
    try {
      await this.queueService.getQueue().add(APPROVAL_NOTIFICATION_JOB, payload);
    } catch (error) {
      this.logger.warn(`Failed to enqueue approval notification for permit ${payload.permitId}`);
      this.logger.debug(error);
    }
  }
}
