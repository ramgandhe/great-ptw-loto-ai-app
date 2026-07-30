import { Injectable, Logger } from '@nestjs/common';

export interface MasterDataLogEvent {
  action: string;
  tenantId?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MasterDataLogService {
  private readonly logger = new Logger(MasterDataLogService.name);

  logEvent(event: MasterDataLogEvent): void {
    this.logger.log({
      msg: 'master-data.event',
      domain: 'permit-to-work',
      module: 'master-data',
      loki: true,
      ...event,
    });
  }
}
