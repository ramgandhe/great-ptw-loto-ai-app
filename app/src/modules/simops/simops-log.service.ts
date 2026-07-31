import { Injectable, Logger } from '@nestjs/common';

export interface SimopsLogEvent {
  action: string;
  tenantId?: string;
  conflictId?: string;
  permitId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Structured SIMOPS logging for Grafana Loki (`loki: true` marker).
 */
@Injectable()
export class SimopsLogService {
  private readonly logger = new Logger(SimopsLogService.name);

  logEvent(event: SimopsLogEvent): void {
    this.logger.log({
      msg: 'simops.event',
      domain: 'simultaneous-operations',
      module: 'conflict-detection',
      loki: true,
      ...event,
    });
  }
}
