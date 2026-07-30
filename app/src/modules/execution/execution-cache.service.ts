import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

@Injectable()
export class ExecutionCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('execution.cacheTtlSeconds') ?? 300;
  }

  activeListKey(tenantId: string): string {
    return `execution:active:${tenantId}`;
  }

  detailKey(tenantId: string, permitId: string): string {
    return `execution:detail:${tenantId}:${permitId}`;
  }

  async getActiveList<T>(tenantId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.activeListKey(tenantId));
  }

  async setActiveList<T>(tenantId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.activeListKey(tenantId), value, this.ttlSeconds());
  }

  async getExecutionDetail<T>(tenantId: string, permitId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.detailKey(tenantId, permitId));
  }

  async setExecutionDetail<T>(tenantId: string, permitId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.detailKey(tenantId, permitId), value, this.ttlSeconds());
  }

  async invalidatePermit(tenantId: string, permitId: string): Promise<void> {
    await this.cacheService.del(this.detailKey(tenantId, permitId));
    await this.cacheService.del(this.activeListKey(tenantId));
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    await this.cacheService.delByPattern(`execution:*:${tenantId}*`);
  }
}
