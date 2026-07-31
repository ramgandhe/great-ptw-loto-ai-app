import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { ArchiveSearchDto } from './dto/archive-search.dto';

@Injectable()
export class ClosureCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('closure.cacheTtlSeconds') ?? 300;
  }

  searchKey(tenantId: string, query: ArchiveSearchDto): string {
    const q = query.q ?? '';
    const from = query.from ?? '';
    const to = query.to ?? '';
    return `closure:archive:${tenantId}:${q}:${from}:${to}`;
  }

  detailKey(tenantId: string, permitId: string): string {
    return `closure:archive:detail:${tenantId}:${permitId}`;
  }

  async getSearchResults<T>(tenantId: string, query: ArchiveSearchDto): Promise<T | null> {
    return this.cacheService.getJson<T>(this.searchKey(tenantId, query));
  }

  async setSearchResults<T>(
    tenantId: string,
    query: ArchiveSearchDto,
    value: T,
  ): Promise<void> {
    await this.cacheService.setJson(this.searchKey(tenantId, query), value, this.ttlSeconds());
  }

  async getArchiveDetail<T>(tenantId: string, permitId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.detailKey(tenantId, permitId));
  }

  async setArchiveDetail<T>(tenantId: string, permitId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.detailKey(tenantId, permitId), value, this.ttlSeconds());
  }

  async invalidatePermit(tenantId: string, permitId: string): Promise<void> {
    await this.cacheService.del(this.detailKey(tenantId, permitId));
    await this.cacheService.delByPattern(`closure:archive:${tenantId}:*`);
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    await this.cacheService.delByPattern(`closure:*:${tenantId}*`);
  }
}
