import { Injectable, Logger } from '@nestjs/common';

export interface IncidentLogEvent {
  action: string;
  incidentId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class IncidentLogService {
  private readonly logger = new Logger(IncidentLogService.name);

  logEvent(event: IncidentLogEvent): void {
    this.logger.log({
      msg: 'incident.event',
      domain: 'incident-management',
      module: 'incident-recording',
      loki: true,
      ...event,
    });
  }
}
