import { Injectable, Logger } from '@nestjs/common';

export interface IsolationLogEvent {
  action: string;
  executionId?: string;
  planId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Structured logging of isolation events for Grafana Loki. Emits pino JSON with
 * a `loki: true` marker so the log pipeline ships these events (same convention
 * as the permit-execution module).
 */
@Injectable()
export class IsolationLogService {
  private readonly logger = new Logger(IsolationLogService.name);

  logEvent(event: IsolationLogEvent): void {
    this.logger.log({
      msg: 'isolation.event',
      domain: 'permit-to-work',
      module: 'lototo-isolation-execution',
      loki: true,
      ...event,
    });
  }
}
