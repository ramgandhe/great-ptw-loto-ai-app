import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

@Injectable()
export class InvestigationCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('investigation.cacheTtlSeconds') ?? 300;
  }

  detailKey(tenantId: string, incidentId: string): string {
    return `investigation:detail:${tenantId}:${incidentId}`;
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

  async invalidate(tenantId: string, incidentId: string): Promise<void> {
    await this.cacheService.del(this.detailKey(tenantId, incidentId));
  }
}
