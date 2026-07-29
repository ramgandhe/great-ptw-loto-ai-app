import { Injectable, Logger } from '@nestjs/common';

export interface LototoLogEvent {
  action: string;
  planId?: string;
  permitId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LototoLogService {
  private readonly logger = new Logger(LototoLogService.name);

  logEvent(event: LototoLogEvent): void {
    this.logger.log({
      msg: 'lototo.event',
      domain: 'lock-out-tag-out',
      module: 'lototo-configuration',
      loki: true,
      ...event,
    });
  }
}
