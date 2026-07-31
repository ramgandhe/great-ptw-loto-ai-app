import { Injectable, Logger } from '@nestjs/common';

export interface RestorationLogEvent {
  action: string;
  executionId?: string;
  planId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Structured logging of restoration events for Grafana Loki. Emits pino JSON
 * with a `loki: true` marker (same convention as the isolation-execution
 * module) so the log pipeline ships restoration activity.
 */
@Injectable()
export class RestorationLogService {
  private readonly logger = new Logger(RestorationLogService.name);

  logEvent(event: RestorationLogEvent): void {
    this.logger.log({
      msg: 'restoration.event',
      domain: 'permit-to-work',
      module: 'lototo-restoration',
      loki: true,
      ...event,
    });
  }
}
