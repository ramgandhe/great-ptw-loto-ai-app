import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

/** Redis cache for plan catalogue, tenant subscription and usage lookups. */
@Injectable()
export class BillingCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('billing.cacheTtlSeconds') ?? 300;
  }

  planKey(planCode: string): string {
    return `billing:plan:${planCode}`;
  }

  subscriptionKey(tenantId: string): string {
    return `billing:subscription:${tenantId}`;
  }

  usageKey(tenantId: string, metricKey: string, periodLabel: string): string {
    return `billing:usage:${tenantId}:${metricKey}:${periodLabel}`;
  }

  async getPlan<T>(planCode: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.planKey(planCode));
  }

  async setPlan<T>(planCode: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.planKey(planCode), value, this.ttlSeconds());
  }

  async getSubscription<T>(tenantId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.subscriptionKey(tenantId));
  }

  async setSubscription<T>(tenantId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.subscriptionKey(tenantId), value, this.ttlSeconds());
  }

  async invalidateSubscription(tenantId: string): Promise<void> {
    await this.cacheService.del(this.subscriptionKey(tenantId));
  }

  async invalidatePlan(planCode: string): Promise<void> {
    await this.cacheService.del(this.planKey(planCode));
  }

  async invalidateUsage(tenantId: string, metricKey: string, periodLabel: string): Promise<void> {
    await this.cacheService.del(this.usageKey(tenantId, metricKey, periodLabel));
  }
}
