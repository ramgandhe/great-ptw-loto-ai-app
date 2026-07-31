import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

/** Redis cache for active multi-day permit daily-progress views (tenant-scoped). */
@Injectable()
export class DailyProgressCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('mdp.cacheTtlSeconds') ?? 300;
  }

  activeListKey(tenantId: string): string {
    return `mdp:active:${tenantId}`;
  }

  permitProgressKey(tenantId: string, permitId: string): string {
    return `mdp:progress:${tenantId}:${permitId}`;
  }

  async getActiveList<T>(tenantId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.activeListKey(tenantId));
  }

  async setActiveList<T>(tenantId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.activeListKey(tenantId), value, this.ttlSeconds());
  }

  async getPermitProgress<T>(tenantId: string, permitId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.permitProgressKey(tenantId, permitId));
  }

  async setPermitProgress<T>(tenantId: string, permitId: string, value: T): Promise<void> {
    await this.cacheService.setJson(
      this.permitProgressKey(tenantId, permitId),
      value,
      this.ttlSeconds(),
    );
  }

  async invalidatePermit(tenantId: string, permitId: string): Promise<void> {
    await this.cacheService.del(this.permitProgressKey(tenantId, permitId));
    await this.cacheService.del(this.activeListKey(tenantId));
  }
}
