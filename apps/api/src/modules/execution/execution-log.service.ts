import { Injectable, Logger } from '@nestjs/common';

export interface ExecutionLogEvent {
  action: string;
  permitId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ExecutionLogService {
  private readonly logger = new Logger(ExecutionLogService.name);

  logEvent(event: ExecutionLogEvent): void {
    this.logger.log({
      msg: 'execution.event',
      domain: 'permit-to-work',
      module: 'permit-execution',
      loki: true,
      ...event,
    });
  }
}
