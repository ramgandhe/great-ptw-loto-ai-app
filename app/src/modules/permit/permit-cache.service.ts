import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';
import type { PermitDetail } from './permit.service';

@Injectable()
export class PermitCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('permit.cacheTtlSeconds') ?? 300;
  }

  listKey(tenantId: string, status?: string): string {
    return `permit:list:${tenantId}:${status ?? 'all'}`;
  }

  detailKey(tenantId: string, permitId: string): string {
    return `permit:detail:${tenantId}:${permitId}`;
  }

  referenceDataKey(tenantId: string, type: string): string {
    return `ref:${tenantId}:${type}`;
  }

  async getPermitList<T>(tenantId: string, status?: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.listKey(tenantId, status));
  }

  async setPermitList<T>(tenantId: string, status: string | undefined, value: T): Promise<void> {
    await this.cacheService.setJson(this.listKey(tenantId, status), value, this.ttlSeconds());
  }

  async getPermitDetail(tenantId: string, permitId: string): Promise<PermitDetail | null> {
    return this.cacheService.getJson<PermitDetail>(this.detailKey(tenantId, permitId));
  }

  async setPermitDetail(tenantId: string, permitId: string, detail: PermitDetail): Promise<void> {
    await this.cacheService.setJson(this.detailKey(tenantId, permitId), detail, this.ttlSeconds());
  }

  async getReferenceData<T>(tenantId: string, type: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.referenceDataKey(tenantId, type));
  }

  async setReferenceData<T>(tenantId: string, type: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.referenceDataKey(tenantId, type), value, this.ttlSeconds());
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    await this.cacheService.delByPattern(`permit:*:${tenantId}:*`);
    await this.cacheService.delByPattern(`ref:${tenantId}:*`);
  }

  async invalidatePermit(tenantId: string, permitId: string): Promise<void> {
    await this.cacheService.del(this.detailKey(tenantId, permitId));
    await this.cacheService.delByPattern(`permit:list:${tenantId}:*`);
  }
}
