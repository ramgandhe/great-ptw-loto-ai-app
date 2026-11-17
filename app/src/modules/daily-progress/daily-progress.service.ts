import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  dailyActivityHistory,
  isolationCertificatePermits,
  isolationCertificates,
  lockboxCrewLocks,
  organisations,
  permitDailyProgress,
  permitExecutors,
  permits,
  shiftHandovers,
  tenantUsers,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CanonicalNotificationService } from '../notifications/canonical-notification.service';
import { MDP_AUDIT_ACTIONS } from '../revalidation/mdp-audit-events';
import { buildMultiDaySummary } from '../revalidation/multi-day-summary';
import { operationalDateKey } from '../revalidation/permit-validity.service';
import { OVERNIGHT_OPEN_ISOLATION_STATUSES } from './day-secure-countersign';
import { DailyProgressCacheService } from './daily-progress-cache.service';
import { DailyProgressLogService } from './daily-progress-log.service';
import {
  CreateShiftHandoverDto,
  DecideShiftHandoverDto,
  RecordDailyProgressDto,
} from './dto/daily-progress.dto';
import { MorningBriefingService } from './morning-briefing.service';
import {
  assertCanDecideHandover,
  canCancelHandover,
  handoverBlocksNewSubmit,
  normalizeHandoverStatus,
} from './shift-handover';

const WRITABLE_PERMIT_STATUSES = new Set(['active']);
const READABLE_PERMIT_STATUSES = new Set(['active', 'suspended']);

@Injectable()
export class DailyProgressService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly cacheService: DailyProgressCacheService,
    private readonly logService: DailyProgressLogService,
    private readonly canonicalNotifications: CanonicalNotificationService,
    private readonly morningBriefingService: MorningBriefingService,
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
    await this.morningBriefingService.assertCustody(permitId, tenantId, user);

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

  /**
   * Work progress creates today's daily-progress row once.
   * A later note the same day does not create another.
   * Pause replaces that row's summary with the leave-safe text, creating the row if none exists.
   */
  async noteFromWork(
    permitId: string,
    user: AuthenticatedUser,
    input: { text: string; kind: 'progress' | 'pause' },
  ): Promise<void> {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, 'write');
    const [org] = await this.db
      .select({
        timezone: organisations.timezone,
        maxMultiDayValidityDays: organisations.maxMultiDayValidityDays,
        operationalDayCutoff: organisations.operationalDayCutoff,
      })
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId))
      .limit(1);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    if (!multiDay.isMultiDay) {
      return;
    }

    const operationalDate = operationalDateKey(new Date(), multiDay.timezone || 'UTC');
    const text = input.text.trim();
    if (!text) {
      return;
    }
    const summary = text.slice(0, 2000);
    const completedWork = text.slice(0, 8000);

    const [existing] = await this.db
      .select({ id: permitDailyProgress.id, status: permitDailyProgress.status })
      .from(permitDailyProgress)
      .where(
        and(
          eq(permitDailyProgress.tenantId, tenantId),
          eq(permitDailyProgress.permitId, permitId),
          eq(permitDailyProgress.operationalDate, operationalDate),
        ),
      )
      .limit(1);

    if (input.kind === 'progress' && existing) {
      return;
    }

    if (existing) {
      if (existing.status === 'submitted') {
        return;
      }
      await this.db
        .update(permitDailyProgress)
        .set({ summary, updatedBy: actorId, updatedAt: new Date() })
        .where(eq(permitDailyProgress.id, existing.id));
      await this.cacheService.invalidatePermit(tenantId, permitId);
      return;
    }

    const [row] = await this.db
      .insert(permitDailyProgress)
      .values({
        tenantId,
        permitId,
        operationalDate,
        completedWork,
        pendingWork: '',
        summary,
        status: 'draft',
        recordedBy: actorId,
        submittedBy: null,
        submittedAt: null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType: 'progress_recorded',
      actorId,
      payload: { dailyProgressId: row.id, operationalDate, source: input.kind },
      createdBy: actorId,
    });
    await this.auditService.log({
      action: 'mdp.progress.recorded',
      entityType: 'permit_daily_progress',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId, operationalDate, source: input.kind },
    });
    this.logService.logEvent({
      action: 'mdp.progress.recorded',
      permitId,
      tenantId,
      userId: actorId,
      metadata: { dailyProgressId: row.id, operationalDate, source: input.kind },
    });
    await this.cacheService.invalidatePermit(tenantId, permitId);
  }

  async listHandovers(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requirePermit(permitId, tenantId, 'read');

    const rows = await this.db
      .select()
      .from(shiftHandovers)
      .where(and(eq(shiftHandovers.tenantId, tenantId), eq(shiftHandovers.permitId, permitId)))
      .orderBy(desc(shiftHandovers.handedOverAt));

    return rows.map((row) => this.presentHandover(row));
  }

  async createHandover(permitId: string, dto: CreateShiftHandoverDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    await this.requirePermit(permitId, tenantId, 'write');
    await this.morningBriefingService.assertCustody(permitId, tenantId, user);

    if (dto.incomingUserId === actorId) {
      throw new BadRequestException('Cannot hand over a permit to yourself');
    }

    const [[assignedIncoming], [activeIncoming]] = await Promise.all([
      this.db
        .select({ id: permitExecutors.id })
        .from(permitExecutors)
        .where(
          and(
            eq(permitExecutors.permitId, permitId),
            eq(permitExecutors.workforceUserId, dto.incomingUserId),
          ),
        )
        .limit(1),
      this.db
        .select({ id: tenantUsers.id })
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, tenantId),
            eq(tenantUsers.keycloakUserId, dto.incomingUserId),
            eq(tenantUsers.status, 'active'),
          ),
        )
        .limit(1),
    ]);
    if (!assignedIncoming || !activeIncoming) {
      throw new BadRequestException(
        'Handover recipient must be an active executor assigned to this permit',
      );
    }

    const pending = await this.findPendingHandover(permitId, tenantId);
    if (pending && handoverBlocksNewSubmit(pending.status)) {
      throw new ConflictException(
        'A shift handover is awaiting acceptance; custody remains with the outgoing party until it is accepted or rejected',
      );
    }

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
        status: 'pending_acceptance',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType: 'handover_completed',
      actorId,
      payload: {
        handoverId: row.id,
        incomingUserId: dto.incomingUserId,
        status: 'pending_acceptance',
      },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.handoverCompleted,
      entityType: 'shift_handover',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId, status: 'pending_acceptance' },
    });

    this.logService.logEvent({
      action: MDP_AUDIT_ACTIONS.handoverCompleted,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { handoverId: row.id, status: 'pending_acceptance' },
    });

    await this.canonicalNotifications
      .fromMdpHandoverPending({
        tenantId,
        permitId,
        actorId,
        handoverId: row.id,
        incomingUserId: dto.incomingUserId,
      })
      .catch(() => undefined);

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return this.presentHandover(row);
  }

  async acceptHandover(
    permitId: string,
    handoverId: string,
    dto: DecideShiftHandoverDto,
    user: AuthenticatedUser,
  ) {
    return this.decideHandover(permitId, handoverId, 'accepted', dto, user);
  }

  async rejectHandover(
    permitId: string,
    handoverId: string,
    dto: DecideShiftHandoverDto,
    user: AuthenticatedUser,
  ) {
    return this.decideHandover(permitId, handoverId, 'rejected', dto, user);
  }

  async cancelHandover(
    permitId: string,
    handoverId: string,
    dto: DecideShiftHandoverDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    await this.requirePermit(permitId, tenantId, 'write');

    const [row] = await this.db
      .select()
      .from(shiftHandovers)
      .where(
        and(
          eq(shiftHandovers.id, handoverId),
          eq(shiftHandovers.tenantId, tenantId),
          eq(shiftHandovers.permitId, permitId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Shift handover not found');
    }
    if (!canCancelHandover({ ...row, actorId })) {
      throw new ForbiddenException(
        'Only the outgoing party can cancel a handover awaiting acceptance',
      );
    }

    const notes = dto.notes?.trim() ?? '';
    const [updated] = await this.db
      .update(shiftHandovers)
      .set({
        status: 'cancelled',
        acceptanceNotes: notes,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(shiftHandovers.id, row.id))
      .returning();

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType: 'handover_cancelled',
      actorId,
      payload: { handoverId: row.id, notes },
      createdBy: actorId,
    });
    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.handoverCancelled,
      entityType: 'shift_handover',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId },
    });
    this.logService.logEvent({
      action: MDP_AUDIT_ACTIONS.handoverCancelled,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { handoverId: row.id },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return this.presentHandover(updated);
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

  private async decideHandover(
    permitId: string,
    handoverId: string,
    decision: 'accepted' | 'rejected',
    dto: DecideShiftHandoverDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, 'write');

    const [row] = await this.db
      .select()
      .from(shiftHandovers)
      .where(
        and(
          eq(shiftHandovers.id, handoverId),
          eq(shiftHandovers.tenantId, tenantId),
          eq(shiftHandovers.permitId, permitId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Shift handover not found');
    }

    const gate = assertCanDecideHandover({
      status: row.status,
      outgoingUserId: row.outgoingUserId,
      incomingUserId: row.incomingUserId,
      actorId,
    });
    if (!gate.ok) {
      if (gate.reason === 'not_pending') {
        throw new ConflictException('Handover is not awaiting acceptance');
      }
      if (gate.reason === 'self_outgoing') {
        throw new ForbiddenException('Outgoing party cannot accept or reject their own handover');
      }
      throw new ForbiddenException('Only the incoming party can accept or reject this handover');
    }

    let lototoCustodyAcknowledged = false;
    if (decision === 'accepted') {
      const openIsolationsRemain = await this.hasOpenLototoIsolations(permit, tenantId);
      if (openIsolationsRemain && dto.lototoCustodyAcknowledged !== true) {
        throw new BadRequestException(
          'Acknowledge LOTOTO isolation custody before accepting lead change while isolations remain open',
        );
      }
      lototoCustodyAcknowledged = openIsolationsRemain && dto.lototoCustodyAcknowledged === true;
    }

    const now = new Date();
    const notes = dto.notes?.trim() ?? '';
    const [updated] = await this.db
      .update(shiftHandovers)
      .set({
        status: decision,
        acceptedBy: actorId,
        acceptedAt: now,
        acceptanceNotes: notes,
        updatedBy: actorId,
        updatedAt: now,
      })
      .where(eq(shiftHandovers.id, row.id))
      .returning();

    const eventType = decision === 'accepted' ? 'handover_accepted' : 'handover_rejected';
    const auditAction =
      decision === 'accepted'
        ? MDP_AUDIT_ACTIONS.handoverAccepted
        : MDP_AUDIT_ACTIONS.handoverRejected;

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType,
      actorId,
      payload: {
        handoverId: row.id,
        decision,
        notes,
        ...(decision === 'accepted' ? { lototoCustodyAcknowledged } : {}),
      },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: auditAction,
      entityType: 'shift_handover',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId, decision },
    });

    this.logService.logEvent({
      action: auditAction,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { handoverId: row.id, decision },
    });

    await this.canonicalNotifications
      .fromMdpHandoverDecided({
        tenantId,
        permitId,
        actorId,
        handoverId: row.id,
        outgoingUserId: row.outgoingUserId,
        decision,
      })
      .catch(() => undefined);

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return this.presentHandover(updated);
  }

  private async findPendingHandover(permitId: string, tenantId: string) {
    const rows = await this.db
      .select()
      .from(shiftHandovers)
      .where(and(eq(shiftHandovers.tenantId, tenantId), eq(shiftHandovers.permitId, permitId)))
      .orderBy(desc(shiftHandovers.handedOverAt))
      .limit(20);

    return rows.find((row) => handoverBlocksNewSubmit(row.status)) ?? null;
  }

  private presentHandover(row: typeof shiftHandovers.$inferSelect) {
    return {
      ...row,
      status: normalizeHandoverStatus(row.status),
      custodyHeldBy:
        normalizeHandoverStatus(row.status) === 'pending_acceptance'
          ? row.outgoingUserId
          : normalizeHandoverStatus(row.status) === 'accepted'
            ? row.incomingUserId
            : row.outgoingUserId,
    };
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

  private async hasOpenLototoIsolations(
    permit: typeof permits.$inferSelect,
    tenantId: string,
  ): Promise<boolean> {
    const linked = await this.db
      .select({ status: isolationCertificates.status })
      .from(isolationCertificatePermits)
      .innerJoin(
        isolationCertificates,
        eq(isolationCertificatePermits.certificateId, isolationCertificates.id),
      )
      .where(
        and(
          eq(isolationCertificatePermits.permitId, permit.id),
          eq(isolationCertificatePermits.tenantId, tenantId),
          ne(isolationCertificatePermits.attachmentStatus, 'detached'),
          inArray(isolationCertificates.status, [...OVERNIGHT_OPEN_ISOLATION_STATUSES]),
        ),
      )
      .limit(1);

    if (linked.length > 0) {
      return true;
    }

    if (!permit.lototoRequired) {
      return false;
    }

    const [lock] = await this.db
      .select({ id: lockboxCrewLocks.id })
      .from(lockboxCrewLocks)
      .where(and(eq(lockboxCrewLocks.permitId, permit.id), isNull(lockboxCrewLocks.removedAt)))
      .limit(1);

    return Boolean(lock);
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
