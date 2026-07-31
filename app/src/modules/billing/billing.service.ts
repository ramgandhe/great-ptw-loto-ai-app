import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { billingInvoices, usageRecords } from '../../database/schema';
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

    const [existing] = await this.db
      .select()
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.tenantId, tenantId),
          eq(usageRecords.metricKey, dto.metricKey),
          eq(usageRecords.periodLabel, dto.periodLabel),
        ),
      )
      .limit(1);

    let row;
    if (existing) {
      [row] = await this.db
        .update(usageRecords)
        .set({
          quantity: dto.quantity,
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
          metricKey: dto.metricKey,
          quantity: dto.quantity,
          periodLabel: dto.periodLabel,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
    }

    await this.cache.invalidateUsage(tenantId, dto.metricKey, dto.periodLabel);
    this.logService.logEvent({
      action: 'billing.usage-recorded',
      tenantId,
      userId: actorId,
      metadata: { metricKey: dto.metricKey, quantity: dto.quantity, periodLabel: dto.periodLabel },
    });

    return row;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly logService: BillingLogService,
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

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
