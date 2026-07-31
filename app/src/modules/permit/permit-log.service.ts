import { Injectable, Logger } from '@nestjs/common';

export interface PermitLogEvent {
  action: string;
  permitId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PermitLogService {
  private readonly logger = new Logger(PermitLogService.name);

  logEvent(event: PermitLogEvent): void {
    this.logger.log({
      msg: 'permit.event',
      domain: 'permit-to-work',
      module: 'permit-creation',
      loki: true,
      ...event,
    });
  }
}
