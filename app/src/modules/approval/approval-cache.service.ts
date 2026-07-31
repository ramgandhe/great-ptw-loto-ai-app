import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

@Injectable()
export class ApprovalCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('approval.cacheTtlSeconds') ?? 300;
  }

  pendingKey(tenantId: string, userId: string): string {
    return `approval:pending:${tenantId}:${userId}`;
  }

  async getPendingList<T>(tenantId: string, userId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.pendingKey(tenantId, userId));
  }

  async setPendingList<T>(tenantId: string, userId: string, value: T): Promise<void> {
    await this.cacheService.setJson(
      this.pendingKey(tenantId, userId),
      value,
      this.ttlSeconds(),
    );
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    await this.cacheService.delByPattern(`approval:pending:${tenantId}:*`);
  }

  async invalidateUser(tenantId: string, userId: string): Promise<void> {
    await this.cacheService.del(this.pendingKey(tenantId, userId));
  }
}
