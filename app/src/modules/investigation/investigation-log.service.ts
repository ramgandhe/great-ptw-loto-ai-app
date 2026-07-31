import { Injectable, Logger } from '@nestjs/common';

export interface InvestigationLogEvent {
  action: string;
  incidentId?: string;
  investigationId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class InvestigationLogService {
  private readonly logger = new Logger(InvestigationLogService.name);

  logEvent(event: InvestigationLogEvent): void {
    this.logger.log({
      msg: 'investigation.event',
      domain: 'incident-management',
      module: 'investigation',
      loki: true,
      ...event,
    });
  }
}
