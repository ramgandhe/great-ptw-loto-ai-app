import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { and, asc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  appliedLocks,
  appliedTags,
  equipmentRestorations,
  isolationExecution,
  isolationSequences,
  lockRemovals,
  tagRemovals,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  EXECUTION_RESTORED,
  EXECUTION_VERIFIED,
} from '../isolation-execution/isolation-execution.constants';
import { IsolationExecutionService } from '../isolation-execution/isolation-execution.service';
import { ArchiveService } from './archive.service';
import { EvidenceUploadUrlDto } from './dto/evidence-upload-url.dto';
import { HistoryService } from './history.service';
import { RestorationCacheService } from './restoration-cache.service';
import { RestorationLogService } from './restoration-log.service';
import {
  LOCK_REMOVED,
  RESTORATION_STATUS_RESTORED,
} from './restoration.constants';

@Injectable()
export class RestorationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly executionService: IsolationExecutionService,
    private readonly historyService: HistoryService,
    private readonly archiveService: ArchiveService,
    private readonly auditService: AuditService,
    private readonly cacheService: RestorationCacheService,
    private readonly logService: RestorationLogService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async removeLock(executionId: string, appliedLockId: string, reason: string | undefined, user: AuthenticatedUser) {
    const execution = await this.getRestorableExecution(executionId, user);

    const [lock] = await this.db
      .select()
      .from(appliedLocks)
      .where(and(eq(appliedLocks.id, appliedLockId), eq(appliedLocks.executionId, executionId)));
    if (!lock) {
      throw new NotFoundException('Applied lock not found for this execution');
    }
    if (lock.status === LOCK_REMOVED) {
      throw new ConflictException('Lock has already been removed');
    }

    const removal = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(lockRemovals)
        .values({
          tenantId: execution.tenantId,
          executionId,
          appliedLockId,
          reason: reason ?? null,
          removedBy: user.id,
          createdBy: user.id,
        })
        .returning();

      await tx
        .update(appliedLocks)
        .set({ status: LOCK_REMOVED, removedBy: user.id, removedAt: new Date(), updatedBy: user.id })
        .where(eq(appliedLocks.id, appliedLockId));

      await this.historyService.record(
        {
          tenantId: execution.tenantId,
          planId: execution.planId,
          executionId,
          action: 'lock.removed',
          entityType: 'applied_lock',
          entityId: appliedLockId,
          actorId: user.id,
        },
        tx,
      );

      return created;
    });

    await this.afterMutation('lock.removed', execution, user, { appliedLockId });
    return removal;
  }

  async removeTag(executionId: string, appliedTagId: string, reason: string | undefined, user: AuthenticatedUser) {
    const execution = await this.getRestorableExecution(executionId, user);

    const [tag] = await this.db
      .select()
      .from(appliedTags)
      .where(and(eq(appliedTags.id, appliedTagId), eq(appliedTags.executionId, executionId)));
    if (!tag) {
      throw new NotFoundException('Applied tag not found for this execution');
    }
    if (tag.status === LOCK_REMOVED) {
      throw new ConflictException('Tag has already been removed');
    }

    const removal = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(tagRemovals)
        .values({
          tenantId: execution.tenantId,
          executionId,
          appliedTagId,
          reason: reason ?? null,
          removedBy: user.id,
          createdBy: user.id,
        })
        .returning();

      await tx
        .update(appliedTags)
        .set({ status: LOCK_REMOVED, removedBy: user.id, removedAt: new Date(), updatedBy: user.id })
        .where(eq(appliedTags.id, appliedTagId));

      await this.historyService.record(
        {
          tenantId: execution.tenantId,
          planId: execution.planId,
          executionId,
          action: 'tag.removed',
          entityType: 'applied_tag',
          entityId: appliedTagId,
          actorId: user.id,
        },
        tx,
      );

      return created;
    });

    await this.afterMutation('tag.removed', execution, user, { appliedTagId });
    return removal;
  }

  async restoreEquipment(
    executionId: string,
    dto: { isolationPointId: string; method?: string; notes?: string },
    user: AuthenticatedUser,
  ) {
    const execution = await this.getRestorableExecution(executionId, user);
    await this.executionService.assertPointBelongsToPlan(dto.isolationPointId, execution.planId);

    const [existing] = await this.db
      .select()
      .from(equipmentRestorations)
      .where(
        and(
          eq(equipmentRestorations.executionId, executionId),
          eq(equipmentRestorations.isolationPointId, dto.isolationPointId),
        ),
      );
    if (existing) {
      throw new ConflictException('Isolation point has already been restored for this execution');
    }

    const restoration = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(equipmentRestorations)
        .values({
          tenantId: execution.tenantId,
          executionId,
          isolationPointId: dto.isolationPointId,
          status: RESTORATION_STATUS_RESTORED,
          method: dto.method ?? null,
          notes: dto.notes ?? null,
          restoredBy: user.id,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.historyService.record(
        {
          tenantId: execution.tenantId,
          planId: execution.planId,
          executionId,
          action: 'equipment.restored',
          entityType: 'equipment_restoration',
          entityId: created.id,
          actorId: user.id,
          metadata: { isolationPointId: dto.isolationPointId },
        },
        tx,
      );

      return created;
    });

    await this.afterMutation('equipment.restored', execution, user, {
      restorationId: restoration.id,
      isolationPointId: dto.isolationPointId,
    });
    return restoration;
  }

  async completeRestoration(executionId: string, user: AuthenticatedUser) {
    const execution = await this.getRestorableExecution(executionId, user);
    await this.assertAllPointsRestored(executionId, execution.planId);

    const restoredAt = new Date();
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(isolationExecution)
        .set({ status: EXECUTION_RESTORED, restoredAt, restoredBy: user.id, updatedBy: user.id })
        .where(
          and(eq(isolationExecution.id, executionId), eq(isolationExecution.tenantId, execution.tenantId)),
        )
        .returning();

      await this.historyService.record(
        {
          tenantId: execution.tenantId,
          planId: execution.planId,
          executionId,
          action: 'execution.restored',
          entityType: 'isolation_execution',
          entityId: executionId,
          actorId: user.id,
        },
        tx,
      );

      return row;
    });

    await this.archiveService.archiveExecution({ ...execution, status: EXECUTION_RESTORED, restoredAt, restoredBy: user.id }, user);
    await this.afterMutation('execution.restored', execution, user, { planId: execution.planId });
    return updated;
  }

  async getRestoration(executionId: string, user: AuthenticatedUser) {
    const execution = await this.executionService.getExecutionEntity(executionId, user);
    const key = this.cacheService.restorationDetailKey(execution.tenantId, executionId);

    const cached = await this.cacheService.getJson<
      Awaited<ReturnType<RestorationService['loadRestorationDetail']>>
    >(key);
    if (cached) {
      return cached;
    }

    const detail = await this.loadRestorationDetail(execution);
    await this.cacheService.setJson(key, detail);
    return detail;
  }

  private async loadRestorationDetail(execution: typeof isolationExecution.$inferSelect) {
    const [restorations, locks, tags] = await Promise.all([
      this.db.select().from(equipmentRestorations).where(eq(equipmentRestorations.executionId, execution.id)).orderBy(asc(equipmentRestorations.restoredAt)),
      this.db.select().from(lockRemovals).where(eq(lockRemovals.executionId, execution.id)),
      this.db.select().from(tagRemovals).where(eq(tagRemovals.executionId, execution.id)),
    ]);
    return { execution, restorations, lockRemovals: locks, tagRemovals: tags };
  }

  /**
   * MinIO wiring for restoration evidence: presigned PUT URL for direct upload
   * to object storage, keyed under the execution's restoration path.
   */
  async evidenceUploadUrl(executionId: string, dto: EvidenceUploadUrlDto, user: AuthenticatedUser) {
    const execution = await this.executionService.getExecutionEntity(executionId, user);
    const storageKey = `${execution.tenantId}/${execution.planId}/restoration/${executionId}/${randomUUID()}-${dto.fileName}`;
    const expiry = this.configService.get<number>('restoration.evidenceUrlExpirySeconds') ?? 3600;
    const uploadUrl = await this.storageService.presignedPutObject(storageKey, expiry);
    return { storageBucket: this.storageService.getBucket(), storageKey, uploadUrl, expiresInSeconds: expiry };
  }

  async evidenceDownloadUrl(executionId: string, storageKey: string, user: AuthenticatedUser) {
    const execution = await this.executionService.getExecutionEntity(executionId, user);
    const prefix = `${execution.tenantId}/${execution.planId}/restoration/${executionId}/`;
    if (!storageKey.startsWith(prefix)) {
      throw new NotFoundException('Evidence object does not belong to this execution restoration');
    }
    const expiry = this.configService.get<number>('restoration.evidenceUrlExpirySeconds') ?? 3600;
    const downloadUrl = await this.storageService.presignedGetObject(storageKey, expiry);
    return { storageKey, downloadUrl, expiresInSeconds: expiry };
  }

  private async getRestorableExecution(executionId: string, user: AuthenticatedUser) {
    const execution = await this.executionService.getExecutionEntity(executionId, user);
    if (execution.status !== EXECUTION_VERIFIED) {
      throw new ConflictException(
        `Restoration requires execution status '${EXECUTION_VERIFIED}', but it is '${execution.status}'`,
      );
    }
    return execution;
  }

  private async assertAllPointsRestored(executionId: string, planId: string) {
    const sequences = await this.db
      .select()
      .from(isolationSequences)
      .where(eq(isolationSequences.planId, planId));
    if (sequences.length === 0) {
      throw new ConflictException('Isolation plan has no configured sequence to restore');
    }

    const restorations = await this.db
      .select()
      .from(equipmentRestorations)
      .where(
        and(
          eq(equipmentRestorations.executionId, executionId),
          eq(equipmentRestorations.status, RESTORATION_STATUS_RESTORED),
        ),
      );
    const restoredPointIds = new Set(restorations.map((r) => r.isolationPointId));

    const missing = sequences.filter((s) => !restoredPointIds.has(s.isolationPointId));
    if (missing.length > 0) {
      throw new ConflictException(
        'All isolation points must be restored before the execution can be marked restored',
      );
    }
  }

  private async afterMutation(
    action: string,
    execution: typeof isolationExecution.$inferSelect,
    user: AuthenticatedUser,
    metadata: Record<string, unknown>,
  ) {
    await this.auditService.log({
      action: `isolation.restoration.${action}`,
      entityType: 'restoration',
      entityId: execution.id,
      userId: user.id,
      tenantId: execution.tenantId,
      metadata: { executionId: execution.id, ...metadata },
    });
    this.logService.logEvent({
      action: `restoration.${action}`,
      executionId: execution.id,
      planId: execution.planId,
      tenantId: execution.tenantId,
      userId: user.id,
      metadata,
    });
    await this.cacheService.invalidate(execution.tenantId, execution.id, execution.planId);
  }
}
