import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

/**
 * Redis-backed historical cache for restoration & LOTOTO history reads.
 * Caches the restoration detail per execution and the history lists per
 * execution / plan, invalidated whenever a restoration mutation writes new
 * history.
 */
@Injectable()
export class RestorationCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('restoration.cacheTtlSeconds') ?? 300;
  }

  restorationDetailKey(tenantId: string, executionId: string): string {
    return `restoration:detail:${tenantId}:${executionId}`;
  }

  historyByExecutionKey(tenantId: string, executionId: string): string {
    return `restoration:history:exec:${tenantId}:${executionId}`;
  }

  historyByPlanKey(tenantId: string, planId: string): string {
    return `restoration:history:plan:${tenantId}:${planId}`;
  }

  async getJson<T>(key: string): Promise<T | null> {
    return this.cacheService.getJson<T>(key);
  }

  async setJson<T>(key: string, value: T): Promise<void> {
    await this.cacheService.setJson(key, value, this.ttlSeconds());
  }

  /** Invalidate all cached restoration/history views for an execution. */
  async invalidate(tenantId: string, executionId: string, planId?: string | null): Promise<void> {
    await this.cacheService.del(
      this.restorationDetailKey(tenantId, executionId),
      this.historyByExecutionKey(tenantId, executionId),
    );
    if (planId) {
      await this.cacheService.del(this.historyByPlanKey(tenantId, planId));
    }
  }
}
