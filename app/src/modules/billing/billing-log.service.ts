import { Injectable, Logger } from '@nestjs/common';

export interface BillingLogEvent {
  action: string;
  tenantId?: string;
  userId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  planCode?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class BillingLogService {
  private readonly logger = new Logger(BillingLogService.name);

  logEvent(event: BillingLogEvent): void {
    this.logger.log({
      msg: 'billing.event',
      domain: 'billing-subscription',
      module: 'billing-infra',
      loki: true,
      ...event,
    });
  }
}
