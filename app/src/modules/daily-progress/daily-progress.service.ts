import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  dailyActivityHistory,
  permitDailyProgress,
  permits,
  shiftHandovers,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { DailyProgressCacheService } from './daily-progress-cache.service';
import { DailyProgressLogService } from './daily-progress-log.service';
import { CreateShiftHandoverDto, RecordDailyProgressDto } from './dto/daily-progress.dto';

const WRITABLE_PERMIT_STATUSES = new Set(['active']);
const READABLE_PERMIT_STATUSES = new Set(['active', 'suspended']);

@Injectable()
export class DailyProgressService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly cacheService: DailyProgressCacheService,
    private readonly logService: DailyProgressLogService,
  ) {}

  async listDailyProgress(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requirePermit(permitId, tenantId, 'read');

    const cached = await this.cacheService.getPermitProgress<
      Awaited<ReturnType<DailyProgressService['loadProgress']>>
    >(tenantId, permitId);
    if (cached) {
      return cached;
    }

    const rows = await this.loadProgress(permitId, tenantId);
    await this.cacheService.setPermitProgress(tenantId, permitId, rows);
    return rows;
  }

  async recordDailyProgress(permitId: string, dto: RecordDailyProgressDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    await this.requirePermit(permitId, tenantId, 'write');

    const operationalDate = dto.operationalDate.slice(0, 10);
    const submit = dto.submit !== false;
    const status = submit ? 'submitted' : 'draft';

    const existing = await this.db
      .select({ id: permitDailyProgress.id })
      .from(permitDailyProgress)
      .where(
        and(
          eq(permitDailyProgress.tenantId, tenantId),
          eq(permitDailyProgress.permitId, permitId),
          eq(permitDailyProgress.operationalDate, operationalDate),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Daily progress already recorded for this operational day');
    }

    const now = new Date();
    const [row] = await this.db
      .insert(permitDailyProgress)
      .values({
        tenantId,
        permitId,
        operationalDate,
        completedWork: dto.completedWork,
        pendingWork: dto.pendingWork ?? '',
        summary: dto.summary,
        status,
        recordedBy: actorId,
        submittedBy: submit ? actorId : null,
        submittedAt: submit ? now : null,
        attachmentMeta: dto.attachmentMeta ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType: submit ? 'progress_submitted' : 'progress_recorded',
      actorId,
      payload: { dailyProgressId: row.id, operationalDate },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: submit ? 'mdp.progress.submitted' : 'mdp.progress.recorded',
      entityType: 'permit_daily_progress',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId, operationalDate },
    });

    this.logService.logEvent({
      action: submit ? 'mdp.progress.submitted' : 'mdp.progress.recorded',
      permitId,
      tenantId,
      userId: actorId,
      metadata: { dailyProgressId: row.id, operationalDate },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return row;
  }

  async listHandovers(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requirePermit(permitId, tenantId, 'read');

    return this.db
      .select()
      .from(shiftHandovers)
      .where(and(eq(shiftHandovers.tenantId, tenantId), eq(shiftHandovers.permitId, permitId)))
      .orderBy(desc(shiftHandovers.handedOverAt));
  }

  async createHandover(permitId: string, dto: CreateShiftHandoverDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    await this.requirePermit(permitId, tenantId, 'write');

    if (dto.dailyProgressId) {
      const [progress] = await this.db
        .select()
        .from(permitDailyProgress)
        .where(
          and(
            eq(permitDailyProgress.id, dto.dailyProgressId),
            eq(permitDailyProgress.tenantId, tenantId),
            eq(permitDailyProgress.permitId, permitId),
          ),
        )
        .limit(1);
      if (!progress) {
        throw new NotFoundException('Daily progress record not found for this permit');
      }
    }

    const [row] = await this.db
      .insert(shiftHandovers)
      .values({
        tenantId,
        permitId,
        dailyProgressId: dto.dailyProgressId ?? null,
        outgoingUserId: actorId,
        incomingUserId: dto.incomingUserId,
        completedActivities: dto.completedActivities,
        outstandingWork: dto.outstandingWork,
        safetyObservations: dto.safetyObservations ?? '',
        status: 'submitted',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType: 'handover_completed',
      actorId,
      payload: { handoverId: row.id, incomingUserId: dto.incomingUserId },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: 'mdp.handover.completed',
      entityType: 'shift_handover',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId },
    });

    this.logService.logEvent({
      action: 'mdp.handover.completed',
      permitId,
      tenantId,
      userId: actorId,
      metadata: { handoverId: row.id },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return row;
  }

  async listActivityHistory(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requirePermit(permitId, tenantId, 'read');

    return this.db
      .select()
      .from(dailyActivityHistory)
      .where(
        and(eq(dailyActivityHistory.tenantId, tenantId), eq(dailyActivityHistory.permitId, permitId)),
      )
      .orderBy(desc(dailyActivityHistory.createdAt));
  }

  private async loadProgress(permitId: string, tenantId: string) {
    return this.db
      .select()
      .from(permitDailyProgress)
      .where(
        and(eq(permitDailyProgress.tenantId, tenantId), eq(permitDailyProgress.permitId, permitId)),
      )
      .orderBy(desc(permitDailyProgress.operationalDate));
  }

  private async requirePermit(
    permitId: string,
    tenantId: string,
    mode: 'read' | 'write',
  ): Promise<typeof permits.$inferSelect> {
    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)))
      .limit(1);

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    const allowed = mode === 'write' ? WRITABLE_PERMIT_STATUSES : READABLE_PERMIT_STATUSES;
    if (!allowed.has(permit.status)) {
      throw new ConflictException(
        mode === 'write'
          ? 'Daily progress can only be recorded for active permits'
          : 'Permit is not available for daily progress viewing',
      );
    }

    return permit;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
