import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  billingInvoices,
  incidents,
  permits,
  tenantSubscriptions,
} from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BILLING_CYCLE_INVOICE_JOB,
  BILLING_RENEWAL_NOTIFY_JOB,
  BILLING_SYSTEM_ACTOR_ID,
  BILLING_USAGE_AGGREGATE_JOB,
} from './billing.constants';
import { BillingLogService } from './billing-log.service';
import { BillingService, UsageTrackingService } from './billing.service';

/**
 * BullMQ scheduled jobs for billing cycle, usage aggregation and renewal notices.
 * FR-BIL-003 / FR-BIL-004 / FR-BIL-005.
 */
@Injectable()
export class BillingJobsService implements OnModuleInit {
  private readonly logger = new Logger(BillingJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: BillingLogService,
    private readonly billingService: BillingService,
    private readonly usageTracking: UsageTrackingService,
    private readonly notificationsService: NotificationsService,
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

  async processBillingCycle(): Promise<number> {
    const now = new Date();
    const due = await this.db
      .select({
        id: tenantSubscriptions.id,
        tenantId: tenantSubscriptions.tenantId,
        status: tenantSubscriptions.status,
        renewAt: tenantSubscriptions.renewAt,
      })
      .from(tenantSubscriptions)
      .where(
        and(
          inArray(tenantSubscriptions.status, ['active', 'past_due', 'trial']),
          isNotNull(tenantSubscriptions.renewAt),
          lte(tenantSubscriptions.renewAt, now),
        ),
      );

    let drafted = 0;
    for (const row of due) {
      const result = await this.billingService.draftInvoiceForSubscription(row.id);
      if (result.created) {
        drafted += 1;
      }

      if (result.invoice.status === 'draft') {
        await this.db
          .update(billingInvoices)
          .set({
            status: 'issued',
            updatedBy: BILLING_SYSTEM_ACTOR_ID,
            updatedAt: new Date(),
          })
          .where(eq(billingInvoices.id, result.invoice.id));
      }

      if (row.status === 'active' || row.status === 'trial') {
        await this.db
          .update(tenantSubscriptions)
          .set({
            status: 'past_due',
            updatedBy: BILLING_SYSTEM_ACTOR_ID,
            updatedAt: new Date(),
          })
          .where(eq(tenantSubscriptions.id, row.id));
      }

      this.logService.logEvent({
        action: 'billing.cycle-invoice',
        tenantId: row.tenantId,
        subscriptionId: row.id,
        metadata: {
          status: row.status,
          renewAt: row.renewAt?.toISOString(),
          invoiceId: result.invoice.id,
          created: result.created,
        },
      });
    }

    if (due.length > 0) {
      this.logger.log(`Billing cycle: ${due.length} due, ${drafted} invoices drafted`);
    }
    return due.length;
  }

  async aggregateUsage(): Promise<number> {
    const periodLabel = new Date().toISOString().slice(0, 7);
    const tenants = await this.db
      .selectDistinct({ tenantId: tenantSubscriptions.tenantId })
      .from(tenantSubscriptions)
      .where(inArray(tenantSubscriptions.status, ['trial', 'active', 'past_due']));

    for (const { tenantId } of tenants) {
      const [permitRow] = await this.db
        .select({ value: count() })
        .from(permits)
        .where(
          and(eq(permits.tenantId, tenantId), inArray(permits.status, ['active', 'approved'])),
        );
      const [incidentRow] = await this.db
        .select({ value: count() })
        .from(incidents)
        .where(
          and(
            eq(incidents.tenantId, tenantId),
            inArray(incidents.status, ['open', 'investigating', 'pending_verification']),
          ),
        );

      await this.usageTracking.recordSystemUsage(
        tenantId,
        'active_permits',
        Number(permitRow?.value ?? 0),
        periodLabel,
      );
      await this.usageTracking.recordSystemUsage(
        tenantId,
        'open_incidents',
        Number(incidentRow?.value ?? 0),
        periodLabel,
      );
    }

    this.logService.logEvent({
      action: 'billing.usage-aggregate',
      metadata: { trigger: 'scheduled', tenants: tenants.length, periodLabel },
    });
    this.logger.log(`Usage aggregation wrote metrics for ${tenants.length} tenant(s)`);
    return tenants.length;
  }

  async notifyUpcomingRenewals(): Promise<number> {
    const horizonDays = this.configService.get<number>('billing.renewalHorizonDays') ?? 7;
    const horizon = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000);
    const upcoming = await this.db
      .select({
        id: tenantSubscriptions.id,
        tenantId: tenantSubscriptions.tenantId,
        renewAt: tenantSubscriptions.renewAt,
        createdBy: tenantSubscriptions.createdBy,
        updatedBy: tenantSubscriptions.updatedBy,
      })
      .from(tenantSubscriptions)
      .where(
        and(
          inArray(tenantSubscriptions.status, ['active', 'trial']),
          isNotNull(tenantSubscriptions.renewAt),
          lte(tenantSubscriptions.renewAt, horizon),
        ),
      );

    let notified = 0;
    for (const row of upcoming) {
      const recipients = [
        ...new Set(
          [row.createdBy, row.updatedBy].filter((id): id is string => typeof id === 'string'),
        ),
      ];
      if (recipients.length === 0) {
        continue;
      }

      const renewIso = row.renewAt?.toISOString() ?? 'unknown';
      const systemUser = {
        id: BILLING_SYSTEM_ACTOR_ID,
        username: 'billing-jobs',
        roles: ['platform-admin'],
        tenantId: row.tenantId,
      };

      await this.notificationsService.generate(
        {
          eventType: 'subscription_renewal',
          category: 'system',
          priority: 'high',
          title: 'Subscription renewal upcoming',
          body: `Your organisation subscription renews on ${renewIso}. Review plan and payment status.`,
          recipientUserIds: recipients,
          entityType: 'tenant_subscription',
          entityId: row.id,
          dedupeKey: `billing:renewal:${row.id}:${renewIso}`,
          sourceModule: 'billing',
        },
        systemUser,
      );
      notified += 1;

      this.logService.logEvent({
        action: 'billing.renewal-notify',
        tenantId: row.tenantId,
        subscriptionId: row.id,
        metadata: { renewAt: renewIso, horizonDays, recipients: recipients.length },
      });
    }

    if (upcoming.length > 0) {
      this.logger.log(`Renewal notifications dispatched: ${notified}/${upcoming.length}`);
    }
    return notified;
  }
}
