import { Injectable, Logger } from '@nestjs/common';

export interface IncidentClosureLogEvent {
  action: string;
  incidentId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class IncidentClosureLogService {
  private readonly logger = new Logger(IncidentClosureLogService.name);

  logEvent(event: IncidentClosureLogEvent): void {
    this.logger.log({
      msg: 'incident.closure.event',
      domain: 'incident-management',
      module: 'incident-closure',
      loki: true,
      ...event,
    });
  }
}
