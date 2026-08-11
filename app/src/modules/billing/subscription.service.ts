import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  planChangeHistory,
  subscriptionPlans,
  tenantSubscriptions,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { BillingCacheService } from './billing-cache.service';
import { BillingLogService } from './billing-log.service';
import {
  CreateSubscriptionDto,
  PlanChangeDto,
  UpdatePlanModulesDto,
} from './dto/billing.dto';

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cache: BillingCacheService,
    private readonly logService: BillingLogService,
    private readonly auditService: AuditService,
  ) {}

  async listPlans() {
    return this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.status, 'active'))
      .orderBy(asc(subscriptionPlans.name));
  }

  async getCurrent(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const cached = await this.cache.getSubscription<unknown>(tenantId);
    if (cached) {
      return cached;
    }

    const [sub] = await this.db
      .select({
        subscription: tenantSubscriptions,
        plan: subscriptionPlans,
      })
      .from(tenantSubscriptions)
      .innerJoin(subscriptionPlans, eq(tenantSubscriptions.planId, subscriptionPlans.id))
      .where(
        and(
          eq(tenantSubscriptions.tenantId, tenantId),
          inArray(tenantSubscriptions.status, ['trial', 'active', 'past_due', 'suspended']),
        ),
      )
      .limit(1);

    const payload = sub
      ? { ...sub.subscription, plan: sub.plan }
      : { subscription: null, plan: null };

    await this.cache.setSubscription(tenantId, payload);
    return payload;
  }

  /** FR-BIL-002 — whether the tenant plan enables a platform module. */
  async isModuleEnabled(tenantId: string, moduleKey: string): Promise<boolean> {
    const [row] = await this.db
      .select({ enabledModules: subscriptionPlans.enabledModules })
      .from(tenantSubscriptions)
      .innerJoin(subscriptionPlans, eq(tenantSubscriptions.planId, subscriptionPlans.id))
      .where(
        and(
          eq(tenantSubscriptions.tenantId, tenantId),
          inArray(tenantSubscriptions.status, ['trial', 'active', 'past_due']),
        ),
      )
      .limit(1);

    if (!row) {
      return false;
    }
    return Array.isArray(row.enabledModules) && row.enabledModules.includes(moduleKey);
  }

  async assertModuleEnabled(tenantId: string, moduleKey: string): Promise<void> {
    const enabled = await this.isModuleEnabled(tenantId, moduleKey);
    if (!enabled) {
      throw new ForbiddenException(`Platform module "${moduleKey}" is not enabled for this tenant`);
    }
  }

  /** Platform-admin manage surface for plan.enabled_modules (FR-BIL-002). */
  async updatePlanModules(planId: string, dto: UpdatePlanModulesDto, user: AuthenticatedUser) {
    const actorId = requireActorId(user);
    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const [updated] = await this.db
      .update(subscriptionPlans)
      .set({
        enabledModules: dto.enabledModules,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPlans.id, planId))
      .returning();

    this.logService.logEvent({
      action: 'billing.plan-modules-updated',
      userId: actorId,
      planCode: plan.code,
      metadata: { planId, enabledModules: dto.enabledModules },
    });
    await this.auditService.log({
      action: 'billing.plan-modules-updated',
      entityType: 'subscription_plan',
      entityId: planId,
      userId: actorId,
      tenantId: user.tenantId,
      metadata: { enabledModules: dto.enabledModules },
    });

    return updated;
  }

  async create(dto: CreateSubscriptionDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const plan = await this.requireActivePlan(dto.planId);

    const existing = await this.getOpenSubscription(tenantId);
    if (existing) {
      throw new BadRequestException('Tenant already has an open subscription');
    }

    const periodStart = new Date();
    const periodEnd = this.addInterval(periodStart, plan.billingInterval);

    const [created] = await this.db
      .insert(tenantSubscriptions)
      .values({
        tenantId,
        planId: plan.id,
        status: dto.status ?? 'trial',
        periodStart,
        periodEnd,
        renewAt: periodEnd,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db.insert(planChangeHistory).values({
      tenantId,
      subscriptionId: created.id,
      fromPlanId: null,
      toPlanId: plan.id,
      changedBy: actorId,
      reason: 'Initial subscription',
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.cache.invalidateSubscription(tenantId);
    this.logService.logEvent({
      action: 'billing.subscription-created',
      tenantId,
      userId: actorId,
      subscriptionId: created.id,
      planCode: plan.code,
    });
    await this.auditService.log({
      action: 'billing.subscription-created',
      entityType: 'tenant_subscription',
      entityId: created.id,
      userId: actorId,
      tenantId,
      metadata: { planId: plan.id },
    });

    return { ...created, plan };
  }

  async changePlan(dto: PlanChangeDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const current = await this.getOpenSubscription(tenantId);
    if (!current) {
      throw new NotFoundException('No open subscription for tenant');
    }

    const newPlan = await this.requireActivePlan(dto.planId);
    if (current.planId === newPlan.id) {
      throw new BadRequestException('Subscription is already on this plan');
    }

    const periodStart = new Date();
    const periodEnd = this.addInterval(periodStart, newPlan.billingInterval);

    const [updated] = await this.db
      .update(tenantSubscriptions)
      .set({
        planId: newPlan.id,
        periodStart,
        periodEnd,
        renewAt: periodEnd,
        status: current.status === 'trial' ? 'trial' : 'active',
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(tenantSubscriptions.id, current.id))
      .returning();

    await this.db.insert(planChangeHistory).values({
      tenantId,
      subscriptionId: current.id,
      fromPlanId: current.planId,
      toPlanId: newPlan.id,
      changedBy: actorId,
      reason: dto.reason ?? 'Plan change',
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.cache.invalidateSubscription(tenantId);
    this.logService.logEvent({
      action: 'billing.plan-changed',
      tenantId,
      userId: actorId,
      subscriptionId: current.id,
      planCode: newPlan.code,
      metadata: { fromPlanId: current.planId, toPlanId: newPlan.id },
    });
    await this.auditService.log({
      action: 'billing.plan-changed',
      entityType: 'tenant_subscription',
      entityId: current.id,
      userId: actorId,
      tenantId,
      metadata: { fromPlanId: current.planId, toPlanId: newPlan.id },
    });

    return { ...updated, plan: newPlan };
  }

  async listPlanChanges(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    return this.db
      .select()
      .from(planChangeHistory)
      .where(eq(planChangeHistory.tenantId, tenantId))
      .orderBy(desc(planChangeHistory.changedAt));
  }

  private async getOpenSubscription(tenantId: string) {
    const [row] = await this.db
      .select()
      .from(tenantSubscriptions)
      .where(
        and(
          eq(tenantSubscriptions.tenantId, tenantId),
          ne(tenantSubscriptions.status, 'cancelled'),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async requireActivePlan(planId: string) {
    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.status, 'active')))
      .limit(1);
    if (!plan) {
      throw new NotFoundException('Subscription plan not found or retired');
    }
    return plan;
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
