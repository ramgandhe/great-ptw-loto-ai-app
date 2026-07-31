import { Injectable, Logger } from '@nestjs/common';

export interface RevalidationLogEvent {
  action: string;
  permitId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class RevalidationLogService {
  private readonly logger = new Logger(RevalidationLogService.name);

  logEvent(event: RevalidationLogEvent): void {
    this.logger.log({
      msg: 'mdp.revalidation.event',
      domain: 'permit-to-work',
      module: 'multi-day-revalidation',
      loki: true,
      ...event,
    });
  }
}
