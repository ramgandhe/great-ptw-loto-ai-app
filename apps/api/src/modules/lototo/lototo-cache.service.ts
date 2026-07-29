import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

@Injectable()
export class LototoCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('lototo.cacheTtlSeconds') ?? 300;
  }

  listKey(tenantId: string, permitId?: string): string {
    return `lototo:list:${tenantId}:${permitId ?? 'all'}`;
  }

  detailKey(tenantId: string, planId: string): string {
    return `lototo:detail:${tenantId}:${planId}`;
  }

  async getPlanList<T>(tenantId: string, permitId?: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.listKey(tenantId, permitId));
  }

  async setPlanList<T>(tenantId: string, permitId: string | undefined, value: T): Promise<void> {
    await this.cacheService.setJson(this.listKey(tenantId, permitId), value, this.ttlSeconds());
  }

  async getPlanDetail<T>(tenantId: string, planId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.detailKey(tenantId, planId));
  }

  async setPlanDetail<T>(tenantId: string, planId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.detailKey(tenantId, planId), value, this.ttlSeconds());
  }

  async invalidatePlan(tenantId: string, planId: string, permitId?: string): Promise<void> {
    await this.cacheService.del(this.detailKey(tenantId, planId));
    await this.cacheService.del(this.listKey(tenantId, permitId));
    await this.cacheService.del(this.listKey(tenantId));
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    await this.cacheService.delByPattern(`lototo:*:${tenantId}:*`);
  }
}
