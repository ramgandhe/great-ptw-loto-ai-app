import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

@Injectable()
export class IncidentClosureCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('incidentClosure.cacheTtlSeconds') ?? 300;
  }

  archiveListKey(tenantId: string): string {
    return `incident:archive:list:${tenantId}`;
  }

  archiveDetailKey(tenantId: string, incidentId: string): string {
    return `incident:archive:detail:${tenantId}:${incidentId}`;
  }

  async getArchiveList<T>(tenantId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.archiveListKey(tenantId));
  }

  async setArchiveList<T>(tenantId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.archiveListKey(tenantId), value, this.ttlSeconds());
  }

  async getArchiveDetail<T>(tenantId: string, incidentId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.archiveDetailKey(tenantId, incidentId));
  }

  async setArchiveDetail<T>(tenantId: string, incidentId: string, value: T): Promise<void> {
    await this.cacheService.setJson(
      this.archiveDetailKey(tenantId, incidentId),
      value,
      this.ttlSeconds(),
    );
  }

  async invalidateArchive(tenantId: string, incidentId: string): Promise<void> {
    await this.cacheService.del(this.archiveDetailKey(tenantId, incidentId));
    await this.cacheService.del(this.archiveListKey(tenantId));
  }
}
