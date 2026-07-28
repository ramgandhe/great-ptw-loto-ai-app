import { Injectable, Logger } from '@nestjs/common';

export interface ApprovalLogEvent {
  action: string;
  permitId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ApprovalLogService {
  private readonly logger = new Logger(ApprovalLogService.name);

  logEvent(event: ApprovalLogEvent): void {
    this.logger.log({
      msg: 'approval.event',
      domain: 'permit-to-work',
      module: 'permit-approval',
      loki: true,
      ...event,
    });
  }
}
