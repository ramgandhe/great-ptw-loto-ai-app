import { Injectable, Logger } from '@nestjs/common';

export interface DailyProgressLogEvent {
  action: string;
  permitId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DailyProgressLogService {
  private readonly logger = new Logger(DailyProgressLogService.name);

  logEvent(event: DailyProgressLogEvent): void {
    this.logger.log({
      msg: 'mdp.event',
      domain: 'permit-to-work',
      module: 'multi-day-daily-progress',
      loki: true,
      ...event,
    });
  }
}
