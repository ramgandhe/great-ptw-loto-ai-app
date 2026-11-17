import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { MDP_VALIDITY_NOTIFICATION_JOB } from './revalidation.constants';

export interface ValidityNotificationPayload {
  permitId: string;
  tenantId: string;
  reference: string | null;
  issuerId: string | null;
  validityState: 'renewal_due' | 'expired' | 'max_validity';
  plannedEndAt: string | null;
  hoursRemaining: number | null;
  operationalDate: string;
  maxMultiDayValidityDays?: number;
  elapsedDays?: number | null;
}

@Injectable()
export class RevalidationNotificationService {
  private readonly logger = new Logger(RevalidationNotificationService.name);

  constructor(private readonly queueService: QueueService) {}

  async enqueueValidityNotification(payload: ValidityNotificationPayload): Promise<void> {
    try {
      await this.queueService.getQueue().add(MDP_VALIDITY_NOTIFICATION_JOB, payload, {
        jobId: `${payload.tenantId}:${payload.permitId}:${payload.validityState}:${payload.operationalDate}`,
      });
    } catch (error) {
      this.logger.warn(`Failed to enqueue validity notification for permit ${payload.permitId}`);
      this.logger.debug(error);
    }
  }
}
