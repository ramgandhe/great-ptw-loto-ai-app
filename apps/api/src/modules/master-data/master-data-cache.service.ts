import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

@Injectable()
export class MasterDataCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('masterData.cacheTtlSeconds') ?? 300;
  }

  key(tenantId: string, type: string): string {
    return `ref:${tenantId}:${type}`;
  }

  async get<T>(tenantId: string, type: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.key(tenantId, type));
  }

  async set<T>(tenantId: string, type: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.key(tenantId, type), value, this.ttlSeconds());
  }

  async invalidate(tenantId: string, type?: string): Promise<void> {
    if (type) {
      await this.cacheService.del(this.key(tenantId, type));
      return;
    }
    await this.cacheService.delByPattern(`ref:${tenantId}:*`);
  }
}
