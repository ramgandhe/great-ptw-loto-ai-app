import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../infrastructure/redis/cache.service';

/**
 * Redis cache for SIMOPS conflict detection + resolution (SP-04.01 / SP-04.02).
 * Keys cover active-permit snapshots, conflict views, approval queues and history.
 */
@Injectable()
export class SimopsCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private ttlSeconds(): number {
    return this.configService.get<number>('simops.cacheTtlSeconds') ?? 300;
  }

  activePermitsKey(tenantId: string): string {
    return `simops:active-permits:${tenantId}`;
  }

  conflictListKey(tenantId: string): string {
    return `simops:conflicts:list:${tenantId}`;
  }

  conflictDetailKey(tenantId: string, conflictId: string): string {
    return `simops:conflict:${tenantId}:${conflictId}`;
  }

  approvalQueueKey(tenantId: string): string {
    return `simops:approval-queue:${tenantId}`;
  }

  historyListKey(tenantId: string): string {
    return `simops:history:list:${tenantId}`;
  }

  historyDetailKey(tenantId: string, conflictId: string): string {
    return `simops:history:${tenantId}:${conflictId}`;
  }

  async getActivePermits<T>(tenantId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.activePermitsKey(tenantId));
  }

  async setActivePermits<T>(tenantId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.activePermitsKey(tenantId), value, this.ttlSeconds());
  }

  async getConflictList<T>(tenantId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.conflictListKey(tenantId));
  }

  async setConflictList<T>(tenantId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.conflictListKey(tenantId), value, this.ttlSeconds());
  }

  async getConflictDetail<T>(tenantId: string, conflictId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.conflictDetailKey(tenantId, conflictId));
  }

  async setConflictDetail<T>(tenantId: string, conflictId: string, value: T): Promise<void> {
    await this.cacheService.setJson(
      this.conflictDetailKey(tenantId, conflictId),
      value,
      this.ttlSeconds(),
    );
  }

  async getApprovalQueue<T>(tenantId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.approvalQueueKey(tenantId));
  }

  async setApprovalQueue<T>(tenantId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.approvalQueueKey(tenantId), value, this.ttlSeconds());
  }

  async getHistoryList<T>(tenantId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.historyListKey(tenantId));
  }

  async setHistoryList<T>(tenantId: string, value: T): Promise<void> {
    await this.cacheService.setJson(this.historyListKey(tenantId), value, this.ttlSeconds());
  }

  async getHistoryDetail<T>(tenantId: string, conflictId: string): Promise<T | null> {
    return this.cacheService.getJson<T>(this.historyDetailKey(tenantId, conflictId));
  }

  async setHistoryDetail<T>(tenantId: string, conflictId: string, value: T): Promise<void> {
    await this.cacheService.setJson(
      this.historyDetailKey(tenantId, conflictId),
      value,
      this.ttlSeconds(),
    );
  }

  async invalidateConflict(tenantId: string, conflictId: string): Promise<void> {
    await this.cacheService.del(this.conflictDetailKey(tenantId, conflictId));
    await this.cacheService.del(this.conflictListKey(tenantId));
    await this.cacheService.del(this.approvalQueueKey(tenantId));
    await this.cacheService.del(this.historyDetailKey(tenantId, conflictId));
    await this.cacheService.del(this.historyListKey(tenantId));
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    await this.cacheService.delByPattern(`simops:*:${tenantId}*`);
  }
}
