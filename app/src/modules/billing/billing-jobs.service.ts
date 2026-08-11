import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  billingInvoices,
  subscriptionPlans,
  tenantSubscriptions,
} from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { CanonicalNotificationService } from '../notifications/canonical-notification.service';
import {
  BILLING_CYCLE_INVOICE_JOB,
  BILLING_RENEWAL_NOTIFY_JOB,
  BILLING_USAGE_AGGREGATE_JOB,
} from './billing.constants';
import { BillingLogService } from './billing-log.service';

/**
 * BullMQ scheduled jobs for billing cycle, usage aggregation and renewal notices.
 */
@Injectable()
export class BillingJobsService implements OnModuleInit {
  private readonly logger = new Logger(BillingJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: BillingLogService,
    private readonly canonicalNotifications: CanonicalNotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(BILLING_CYCLE_INVOICE_JOB, async () => {
      await this.processBillingCycle();
    });
    this.queueService.registerHandler(BILLING_USAGE_AGGREGATE_JOB, async () => {
      await this.aggregateUsage();
    });
    this.queueService.registerHandler(BILLING_RENEWAL_NOTIFY_JOB, async () => {
      await this.notifyUpcomingRenewals();
    });

    const cycleCron =
      this.configService.get<string>('billing.cycleInvoiceCron') ?? '0 2 * * *';
    const usageCron =
      this.configService.get<string>('billing.usageAggregateCron') ?? '0 * * * *';
    const renewalCron =
      this.configService.get<string>('billing.renewalNotifyCron') ?? '0 9 * * *';

    try {
      await this.queueService.getQueue().add(
        BILLING_CYCLE_INVOICE_JOB,
        {},
        { repeat: { pattern: cycleCron }, jobId: 'billing-cycle-invoice-schedule' },
      );
      await this.queueService.getQueue().add(
        BILLING_USAGE_AGGREGATE_JOB,
        {},
        { repeat: { pattern: usageCron }, jobId: 'billing-usage-aggregate-schedule' },
      );
      await this.queueService.getQueue().add(
        BILLING_RENEWAL_NOTIFY_JOB,
        {},
        { repeat: { pattern: renewalCron }, jobId: 'billing-renewal-notify-schedule' },
      );
      this.logger.log(
        `Scheduled billing jobs: cycle (${cycleCron}), usage (${usageCron}), renewal (${renewalCron})`,
      );
    } catch (error) {
      this.logger.warn('Could not schedule billing jobs');
      this.logger.debug(error);
    }
  }

  async processBillingCycle(): Promise<void> {
    const now = new Date();
    const due = await this.db
      .select({
        subscription: tenantSubscriptions,
        plan: subscriptionPlans,
      })
      .from(tenantSubscriptions)
      .innerJoin(subscriptionPlans, eq(tenantSubscriptions.planId, subscriptionPlans.id))
      .where(
        and(
          inArray(tenantSubscriptions.status, ['active', 'past_due', 'trial']),
          isNotNull(tenantSubscriptions.renewAt),
          lte(tenantSubscriptions.renewAt, now),
        ),
      );

    for (const row of due) {
      await this.ensureCycleInvoice(row.subscription, row.plan);
      this.logService.logEvent({
        action: 'billing.cycle-invoice',
        tenantId: row.subscription.tenantId,
        subscriptionId: row.subscription.id,
        metadata: {
          status: row.subscription.status,
          renewAt: row.subscription.renewAt?.toISOString(),
        },
      });
    }

    if (due.length > 0) {
      this.logger.log(`Billing cycle candidates processed: ${due.length}`);
    }
  }

  async aggregateUsage(): Promise<void> {
    this.logService.logEvent({
      action: 'billing.usage-aggregate',
      metadata: { trigger: 'scheduled' },
    });
    this.logger.log('Usage aggregation sweep emitted');
  }

  async notifyUpcomingRenewals(): Promise<void> {
    const horizonDays = this.configService.get<number>('billing.renewalHorizonDays') ?? 7;
    const horizon = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000);
    const upcoming = await this.db
      .select({
        id: tenantSubscriptions.id,
        tenantId: tenantSubscriptions.tenantId,
        renewAt: tenantSubscriptions.renewAt,
        createdBy: tenantSubscriptions.createdBy,
      })
      .from(tenantSubscriptions)
      .where(
        and(
          inArray(tenantSubscriptions.status, ['active', 'trial']),
          isNotNull(tenantSubscriptions.renewAt),
          lte(tenantSubscriptions.renewAt, horizon),
        ),
      );

    for (const row of upcoming) {
      if (!row.renewAt || !row.createdBy) {
        continue;
      }

      await this.canonicalNotifications.fromBillingRenewal({
        tenantId: row.tenantId,
        subscriptionId: row.id,
        adminUserId: row.createdBy,
        renewAt: row.renewAt,
        horizonDays,
      });

      this.logService.logEvent({
        action: 'billing.renewal-notify',
        tenantId: row.tenantId,
        subscriptionId: row.id,
        metadata: { renewAt: row.renewAt.toISOString(), horizonDays },
      });
    }

    if (upcoming.length > 0) {
      this.logger.log(`Renewal notifications sent: ${upcoming.length}`);
    }
  }

  private async ensureCycleInvoice(
    subscription: typeof tenantSubscriptions.$inferSelect,
    plan: typeof subscriptionPlans.$inferSelect,
  ): Promise<void> {
    const periodStart = subscription.periodStart;
    const periodEnd = subscription.periodEnd;

    const [existing] = await this.db
      .select({ id: billingInvoices.id })
      .from(billingInvoices)
      .where(
        and(
          eq(billingInvoices.tenantId, subscription.tenantId),
          eq(billingInvoices.subscriptionId, subscription.id),
          eq(billingInvoices.periodStart, periodStart),
          eq(billingInvoices.periodEnd, periodEnd),
        ),
      )
      .limit(1);

    if (existing) {
      return;
    }

    const invoiceNumber = `INV-${subscription.tenantId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
    await this.db.insert(billingInvoices).values({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      invoiceNumber,
      amountMinor: plan.priceMinor,
      currency: plan.currency,
      status: 'draft',
      periodStart,
      periodEnd,
      dueAt: subscription.renewAt,
      createdBy: subscription.createdBy,
      updatedBy: subscription.createdBy,
    });
  }
}
