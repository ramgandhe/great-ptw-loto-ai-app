import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

/**
 * Redis-backed cache for active isolation sessions. Execution detail is cached
 * per tenant, keyed by both execution id and plan id, and invalidated whenever
 * the session changes (lock/tag/verification/status/evidence).
 */
@Injectable()
export class IsolationCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('isolation.cacheTtlSeconds') ?? 300;
  }

  detailByExecutionKey(tenantId: string, executionId: string): string {
    return `isolation:detail:${tenantId}:${executionId}`;
  }

  detailByPlanKey(tenantId: string, planId: string): string {
    return `isolation:plan:${tenantId}:${planId}`;
  }

  async getDetailByExecution<T>(tenantId: string, executionId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.detailByExecutionKey(tenantId, executionId));
  }

  async setDetailByExecution<T>(tenantId: string, executionId: string, value: T): Promise<void> {
    await this.cacheService.setJson(
      this.detailByExecutionKey(tenantId, executionId),
      value,
      this.ttlSeconds(),
    );
  }

  async getDetailByPlan<T>(tenantId: string, planId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.detailByPlanKey(tenantId, planId));
  }

  async setDetailByPlan<T>(tenantId: string, planId: string, value: T): Promise<void> {
    await this.cacheService.setJson(
      this.detailByPlanKey(tenantId, planId),
      value,
      this.ttlSeconds(),
    );
  }

  /** Invalidate all cached views of an execution session. */
  async invalidate(tenantId: string, executionId: string, planId?: string): Promise<void> {
    await this.cacheService.del(this.detailByExecutionKey(tenantId, executionId));
    if (planId) {
      await this.cacheService.del(this.detailByPlanKey(tenantId, planId));
    }
  }
}
