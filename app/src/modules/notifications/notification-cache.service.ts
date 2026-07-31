import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

/** Redis cache for tenant-scoped notification list/unread views. */
@Injectable()
export class NotificationCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('notification.cacheTtlSeconds') ?? 300;
  }

  listKey(tenantId: string, userId: string): string {
    return `notification:list:${tenantId}:${userId}`;
  }

  unreadCountKey(tenantId: string, userId: string): string {
    return `notification:unread:${tenantId}:${userId}`;
  }

  async getList<T>(tenantId: string, userId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.listKey(tenantId, userId));
  }

  async setList<T>(tenantId: string, userId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.listKey(tenantId, userId), value, this.ttlSeconds());
  }

  async getUnreadCount(tenantId: string, userId: string): Promise<number | null> {
    return this.cacheService.getJson<number>(this.unreadCountKey(tenantId, userId));
  }

  async setUnreadCount(tenantId: string, userId: string, value: number): Promise<void> {
    await this.cacheService.setJson(
      this.unreadCountKey(tenantId, userId),
      value,
      this.ttlSeconds(),
    );
  }

  async invalidateUser(tenantId: string, userId: string): Promise<void> {
    await this.cacheService.del(this.listKey(tenantId, userId));
    await this.cacheService.del(this.unreadCountKey(tenantId, userId));
  }
}
