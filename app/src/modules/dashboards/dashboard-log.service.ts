import { Injectable, Logger } from '@nestjs/common';

export interface DashboardLogEvent {
  action: string;
  tenantId?: string;
  userId?: string;
  reportId?: string;
  kpiKey?: string;
  scope?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DashboardLogService {
  private readonly logger = new Logger(DashboardLogService.name);

  logEvent(event: DashboardLogEvent): void {
    this.logger.log({
      msg: 'dashboard.event',
      domain: 'dashboards-analytics',
      module: 'dashboard-infra',
      loki: true,
      ...event,
    });
  }
}
