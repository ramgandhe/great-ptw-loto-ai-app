import { Injectable, Logger } from '@nestjs/common';

export interface ClosureLogEvent {
  action: string;
  permitId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ClosureLogService {
  private readonly logger = new Logger(ClosureLogService.name);

  logEvent(event: ClosureLogEvent): void {
    this.logger.log({
      msg: 'closure.event',
      domain: 'permit-to-work',
      module: 'permit-closure',
      loki: true,
      ...event,
    });
  }
}
