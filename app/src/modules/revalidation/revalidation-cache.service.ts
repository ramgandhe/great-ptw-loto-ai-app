import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

@Injectable()
export class RevalidationCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('mdp.revalidationCacheTtlSeconds') ?? 300;
  }

  permitKey(tenantId: string, permitId: string): string {
    return `mdp:revalidation:${tenantId}:${permitId}`;
  }

  pendingExtensionsKey(tenantId: string): string {
    return `mdp:extensions:pending:${tenantId}`;
  }

  async getPermitView<T>(tenantId: string, permitId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.permitKey(tenantId, permitId));
  }

  async setPermitView<T>(tenantId: string, permitId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.permitKey(tenantId, permitId), value, this.ttlSeconds());
  }

  async invalidatePermit(tenantId: string, permitId: string): Promise<void> {
    await this.cacheService.del(this.permitKey(tenantId, permitId));
    await this.cacheService.del(this.pendingExtensionsKey(tenantId));
  }
}
