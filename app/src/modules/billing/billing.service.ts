import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  billingInvoices,
  subscriptionPlans,
  tenantSubscriptions,
  usageRecords,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { BILLING_SYSTEM_ACTOR_ID } from './billing.constants';
import { BillingCacheService } from './billing-cache.service';
import { BillingLogService } from './billing-log.service';
import { ListInvoicesQueryDto, UsageRecordDto } from './dto/billing.dto';

@Injectable()
export class UsageTrackingService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cache: BillingCacheService,
    private readonly logService: BillingLogService,
  ) {}

  async list(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    return this.db
      .select()
      .from(usageRecords)
      .where(eq(usageRecords.tenantId, tenantId))
      .orderBy(desc(usageRecords.recordedAt));
  }

  async upsert(dto: UsageRecordDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    await this.assertWithinLimit(tenantId, dto.metricKey, dto.quantity);
    return this.writeUsage(tenantId, dto.metricKey, dto.quantity, dto.periodLabel, actorId);
  }

  /** Job/system path for FR-BIL-003 aggregation (skips interactive user). */
  async recordSystemUsage(
    tenantId: string,
    metricKey: string,
    quantity: number,
    periodLabel: string,
    actorId = BILLING_SYSTEM_ACTOR_ID,
  ) {
    return this.writeUsage(tenantId, metricKey, quantity, periodLabel, actorId);
  }

  /**
   * Compares quantity against plan.usage_limits[metricKey] when limit is numeric (FR-BIL-003).
   * Unlimited when key absent or non-numeric.
   */
  async assertWithinLimit(tenantId: string, metricKey: string, quantity: number): Promise<void> {
    const limit = await this.resolveLimit(tenantId, metricKey);
    if (limit === null) {
      return;
    }
    if (quantity > limit) {
      throw new BadRequestException(
        `Usage limit exceeded for ${metricKey}: ${quantity} > ${limit}`,
      );
    }
  }

  async getUsageSnapshot(tenantId: string, metricKey: string, periodLabel: string) {
    const [row] = await this.db
      .select()
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.tenantId, tenantId),
          eq(usageRecords.metricKey, metricKey),
          eq(usageRecords.periodLabel, periodLabel),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async writeUsage(
    tenantId: string,
    metricKey: string,
    quantity: number,
    periodLabel: string,
    actorId: string,
  ) {
    const [existing] = await this.db
      .select()
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.tenantId, tenantId),
          eq(usageRecords.metricKey, metricKey),
          eq(usageRecords.periodLabel, periodLabel),
        ),
      )
      .limit(1);

    let row;
    if (existing) {
      [row] = await this.db
        .update(usageRecords)
        .set({
          quantity,
          recordedAt: new Date(),
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(usageRecords.id, existing.id))
        .returning();
    } else {
      [row] = await this.db
        .insert(usageRecords)
        .values({
          tenantId,
          metricKey,
          quantity,
          periodLabel,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
    }

    await this.cache.invalidateUsage(tenantId, metricKey, periodLabel);
    this.logService.logEvent({
      action: 'billing.usage-recorded',
      tenantId,
      userId: actorId,
      metadata: { metricKey, quantity, periodLabel },
    });

    return row;
  }

  private async resolveLimit(tenantId: string, metricKey: string): Promise<number | null> {
    const [sub] = await this.db
      .select({ usageLimits: subscriptionPlans.usageLimits })
      .from(tenantSubscriptions)
      .innerJoin(subscriptionPlans, eq(tenantSubscriptions.planId, subscriptionPlans.id))
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .limit(1);

    if (!sub) {
      return null;
    }
    const raw = sub.usageLimits?.[metricKey];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
      return Number(raw);
    }
    return null;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}

const INVOICE_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['issued', 'void'],
  issued: ['paid', 'void'],
  paid: [],
  void: [],
};

@Injectable()
export class BillingService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly logService: BillingLogService,
    private readonly auditService: AuditService,
  ) {}

  async listInvoices(user: AuthenticatedUser, query: ListInvoicesQueryDto) {
    const tenantId = this.requireTenant(user);
    const conditions = [eq(billingInvoices.tenantId, tenantId)];
    if (query.status) {
      conditions.push(eq(billingInvoices.status, query.status));
    }

    const rows = await this.db
      .select()
      .from(billingInvoices)
      .where(and(...conditions))
      .orderBy(desc(billingInvoices.createdAt));

    this.logService.logEvent({
      action: 'billing.invoices-listed',
      tenantId,
      userId: user.id,
      metadata: { count: rows.length },
    });

    return rows;
  }

  /**
   * Idempotent draft invoice for a subscription period (FR-BIL-004).
   * Duplicate period → returns existing row (no double charge).
   */
  async draftInvoiceForSubscription(
    subscriptionId: string,
    actorId = BILLING_SYSTEM_ACTOR_ID,
  ) {
    const [row] = await this.db
      .select({
        subscription: tenantSubscriptions,
        plan: subscriptionPlans,
      })
      .from(tenantSubscriptions)
      .innerJoin(subscriptionPlans, eq(tenantSubscriptions.planId, subscriptionPlans.id))
      .where(eq(tenantSubscriptions.id, subscriptionId))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Subscription not found');
    }

    const { subscription, plan } = row;
    const [existing] = await this.db
      .select()
      .from(billingInvoices)
      .where(
        and(
          eq(billingInvoices.subscriptionId, subscription.id),
          eq(billingInvoices.periodStart, subscription.periodStart),
          eq(billingInvoices.periodEnd, subscription.periodEnd),
        ),
      )
      .limit(1);

    if (existing) {
      return { invoice: existing, created: false };
    }

    const invoiceNumber = this.buildInvoiceNumber(subscription.id, subscription.periodStart);
    const dueAt = new Date(subscription.periodEnd);
    dueAt.setUTCDate(dueAt.getUTCDate() + 14);

    try {
      const [created] = await this.db
        .insert(billingInvoices)
        .values({
          tenantId: subscription.tenantId,
          subscriptionId: subscription.id,
          invoiceNumber,
          amountMinor: plan.priceMinor,
          currency: plan.currency,
          status: 'draft',
          periodStart: subscription.periodStart,
          periodEnd: subscription.periodEnd,
          dueAt,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      this.logService.logEvent({
        action: 'billing.invoice-drafted',
        tenantId: subscription.tenantId,
        userId: actorId,
        subscriptionId: subscription.id,
        metadata: { invoiceId: created.id, amountMinor: created.amountMinor },
      });

      return { invoice: created, created: true };
    } catch (error) {
      // Unique invoice_number race → re-read
      const [raced] = await this.db
        .select()
        .from(billingInvoices)
        .where(eq(billingInvoices.invoiceNumber, invoiceNumber))
        .limit(1);
      if (raced) {
        return { invoice: raced, created: false };
      }
      throw error;
    }
  }

  async transitionInvoice(
    invoiceId: string,
    nextStatus: 'issued' | 'paid' | 'void',
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);

    const [invoice] = await this.db
      .select()
      .from(billingInvoices)
      .where(and(eq(billingInvoices.id, invoiceId), eq(billingInvoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const allowed = INVOICE_TRANSITIONS[invoice.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid invoice transition ${invoice.status} → ${nextStatus}`,
      );
    }

    const patch: Partial<typeof billingInvoices.$inferInsert> = {
      status: nextStatus,
      updatedBy: actorId,
      updatedAt: new Date(),
    };
    if (nextStatus === 'paid') {
      patch.paidAt = new Date();
    }

    const [updated] = await this.db
      .update(billingInvoices)
      .set(patch)
      .where(eq(billingInvoices.id, invoiceId))
      .returning();

    if (nextStatus === 'paid') {
      await this.activateAndAdvanceSubscription(invoice.subscriptionId, actorId);
    } else if (nextStatus === 'issued') {
      await this.db
        .update(tenantSubscriptions)
        .set({ status: 'past_due', updatedBy: actorId, updatedAt: new Date() })
        .where(
          and(
            eq(tenantSubscriptions.id, invoice.subscriptionId),
            eq(tenantSubscriptions.status, 'active'),
          ),
        );
    }

    this.logService.logEvent({
      action: 'billing.invoice-transition',
      tenantId,
      userId: actorId,
      metadata: { invoiceId, from: invoice.status, to: nextStatus },
    });
    await this.auditService.log({
      action: 'billing.invoice-transition',
      entityType: 'billing_invoice',
      entityId: invoiceId,
      userId: actorId,
      tenantId,
      metadata: { from: invoice.status, to: nextStatus, amountMinor: invoice.amountMinor },
    });

    return updated;
  }

  private async activateAndAdvanceSubscription(subscriptionId: string, actorId: string) {
    const [sub] = await this.db
      .select({
        subscription: tenantSubscriptions,
        plan: subscriptionPlans,
      })
      .from(tenantSubscriptions)
      .innerJoin(subscriptionPlans, eq(tenantSubscriptions.planId, subscriptionPlans.id))
      .where(eq(tenantSubscriptions.id, subscriptionId))
      .limit(1);

    if (!sub) {
      return;
    }

    const periodStart = sub.subscription.periodEnd;
    const periodEnd = this.addInterval(periodStart, sub.plan.billingInterval);

    await this.db
      .update(tenantSubscriptions)
      .set({
        status: 'active',
        periodStart,
        periodEnd,
        renewAt: periodEnd,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(tenantSubscriptions.id, subscriptionId));
  }

  private buildInvoiceNumber(subscriptionId: string, periodStart: Date): string {
    const day = periodStart.toISOString().slice(0, 10);
    return `INV-${subscriptionId.replace(/-/g, '').slice(0, 12)}-${day}`;
  }

  private addInterval(start: Date, interval: string): Date {
    const end = new Date(start);
    if (interval === 'yearly') {
      end.setUTCFullYear(end.getUTCFullYear() + 1);
    } else {
      end.setUTCMonth(end.getUTCMonth() + 1);
    }
    return end;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
