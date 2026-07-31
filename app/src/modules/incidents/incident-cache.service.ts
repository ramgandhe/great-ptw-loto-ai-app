import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

/** Redis cache for tenant-scoped incident list/detail views. */
@Injectable()
export class IncidentCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('incident.cacheTtlSeconds') ?? 300;
  }

  listKey(tenantId: string): string {
    return `incident:list:${tenantId}`;
  }

  detailKey(tenantId: string, incidentId: string): string {
    return `incident:detail:${tenantId}:${incidentId}`;
  }

  async getList<T>(tenantId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.listKey(tenantId));
  }

  async setList<T>(tenantId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.listKey(tenantId), value, this.ttlSeconds());
  }

  async getDetail<T>(tenantId: string, incidentId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.detailKey(tenantId, incidentId));
  }

  async setDetail<T>(tenantId: string, incidentId: string, value: T): Promise<void> {
    await this.cacheService.setJson(
      this.detailKey(tenantId, incidentId),
      value,
      this.ttlSeconds(),
    );
  }

  async invalidateIncident(tenantId: string, incidentId: string): Promise<void> {
    await this.cacheService.del(this.detailKey(tenantId, incidentId));
    await this.cacheService.del(this.listKey(tenantId));
  }
}
