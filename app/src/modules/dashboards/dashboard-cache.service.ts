import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

/** Redis cache for dashboard payloads, KPIs and analytics views. */
@Injectable()
export class DashboardCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('dashboard.cacheTtlSeconds') ?? 120;
  }

  dashboardKey(tenantId: string, userId: string, kind: string): string {
    return `dashboard:${kind}:${tenantId}:${userId}`;
  }

  kpiKey(tenantId: string, kpiKey: string, periodLabel: string): string {
    return `dashboard:kpi:${tenantId}:${kpiKey}:${periodLabel}`;
  }

  analyticsKey(tenantId: string, scope: string): string {
    return `dashboard:analytics:${tenantId}:${scope}`;
  }

  async getDashboard<T>(tenantId: string, userId: string, kind: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.dashboardKey(tenantId, userId, kind));
  }

  async setDashboard<T>(
    tenantId: string,
    userId: string,
    kind: string,
    value: T,
  ): Promise<void> {
    await this.cacheService.setJson(
      this.dashboardKey(tenantId, userId, kind),
      value,
      this.ttlSeconds(),
    );
  }

  async getKpi<T>(tenantId: string, kpiKey: string, periodLabel: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.kpiKey(tenantId, kpiKey, periodLabel));
  }

  async setKpi<T>(
    tenantId: string,
    kpiKey: string,
    periodLabel: string,
    value: T,
  ): Promise<void> {
    await this.cacheService.setJson(
      this.kpiKey(tenantId, kpiKey, periodLabel),
      value,
      this.ttlSeconds(),
    );
  }

  async invalidateTenant(tenantId: string, userId?: string, kind?: string): Promise<void> {
    if (userId && kind) {
      await this.cacheService.del(this.dashboardKey(tenantId, userId, kind));
    }
  }

  async invalidateKpi(tenantId: string, kpiKey: string, periodLabel: string): Promise<void> {
    await this.cacheService.del(this.kpiKey(tenantId, kpiKey, periodLabel));
  }

  async invalidateAnalytics(tenantId: string, scope: string): Promise<void> {
    await this.cacheService.del(this.analyticsKey(tenantId, scope));
  }
}
