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
  permitDaySecures,
  permitMdpOverrides,
  permitRevalidations,
  permits,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { MDP_AUDIT_ACTIONS } from '../revalidation/mdp-audit-events';
import { buildMultiDaySummary } from '../revalidation/multi-day-summary';
import { operationalDateKey } from '../revalidation/permit-validity.service';
import {
  buildDaySecureChecklistTemplate,
  missingDaySecureChecklistKeys,
  resolveDaySecureChecklistMode,
} from './day-secure-checklist';
import {
  OVERNIGHT_OPEN_ISOLATION_STATUSES,
  decideDaySecureCountersign,
} from './day-secure-countersign';
import {
  hasCompleteSecureForDate,
  isClearedForWorkToday,
  isFinalDaySecure,
  isLateSecure,
  missingPriorSecureDates,
  resolveMultiDayCycleState,
} from './day-secure-cycle';
import { buildDayCycleAction, dayNumberOfWindow } from './day-cycle-presentation';
import { resolveReopenDayContext } from '../revalidation/multi-day-reopen';
import { DailyProgressCacheService } from './daily-progress-cache.service';
import { DailyProgressLogService } from './daily-progress-log.service';
import { MorningBriefingService } from './morning-briefing.service';
import { CountersignDaySecureDto, CreateDaySecureDto } from './dto/day-secure.dto';

const WRITABLE_PERMIT_STATUSES = new Set(['active']);
const READABLE_PERMIT_STATUSES = new Set(['active', 'suspended']);

@Injectable()
export class DaySecureService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly cacheService: DailyProgressCacheService,
    private readonly logService: DailyProgressLogService,
    private readonly morningBriefingService: MorningBriefingService,
  ) {}

  async listDaySecures(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requirePermit(permitId, tenantId, 'read');

    const cached = await this.cacheService.getDaySecures<
      Awaited<ReturnType<DaySecureService['loadDaySecures']>>
    >(tenantId, permitId);
    if (cached) {
      return cached;
    }

    const rows = await this.loadDaySecures(permitId, tenantId);
    await this.cacheService.setDaySecures(tenantId, permitId, rows);
    return rows;
  }

  /** Checklist template for the permit’s daily-audit mode (UI prefill). */
  async getChecklistTemplate(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const permit = await this.requirePermit(permitId, tenantId, 'read');

    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    if (!multiDay.isMultiDay) {
      throw new BadRequestException('End-of-day secure applies only to multi-day permits');
    }

    return buildDaySecureChecklistTemplate(multiDay.dailyRevalidationRequired);
  }

  /**
   * Day-cycle snapshot for UI / gates: missing prior secures, late flag, final day.
   */
  async getDayCycle(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requirePermit(permitId, tenantId, 'read');
    return this.resolveDayCycle(permitId, tenantId);
  }

  /** Job-safe day-cycle resolution (no AuthenticatedUser). */
  async resolveDayCycle(permitId: string, tenantId: string) {
    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)))
      .limit(1);
    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    if (!multiDay.isMultiDay || !multiDay.startOperationalDate || !multiDay.endOperationalDate) {
      return {
        isMultiDay: false,
        dayCycleState: 'not_multi_day' as const,
        currentOperationalDate: null as string | null,
        missingPriorSecureDates: [] as string[],
        lateSecureRequired: false,
        finalDay: multiDay.endOperationalDate,
        dayNumber: null as number | null,
        maxMultiDayValidityDays: multiDay.maxMultiDayValidityDays,
        operationalDayCutoff: multiDay.operationalDayCutoff,
        timezone: multiDay.timezone,
        dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
        emergencyOverrideAllowed: multiDay.emergencyOverrideAllowed,
        requiredAction: buildDayCycleAction(permitId, 'not_multi_day'),
        submittedBy: permit.submittedBy,
        reference: permit.reference,
      };
    }

    const timezone = multiDay.timezone || 'UTC';
    const dayContext = resolveReopenDayContext(
      new Date(),
      timezone,
      multiDay.operationalDayCutoff,
    );
    const currentOperationalDate = dayContext.operationalDate;
    const secures = await this.loadDaySecures(permitId, tenantId);
    const missing = missingPriorSecureDates({
      startOperationalDate: multiDay.startOperationalDate,
      endOperationalDate: multiDay.endOperationalDate,
      currentOperationalDate,
      secures,
    });
    const lateSecureRequired = missing.length > 0;
    const onFinalDay = isFinalDaySecure(currentOperationalDate, multiDay.endOperationalDate);
    const isFirstOperationalDay = currentOperationalDate === multiDay.startOperationalDate;
    const todaySecureComplete = hasCompleteSecureForDate(secures, currentOperationalDate);

    const [[todayReopen], [overrideToday], [todayProgress], overnightIsolationRemains] =
      await Promise.all([
        this.db
          .select({
            outcome: permitRevalidations.outcome,
            operationalDate: permitRevalidations.operationalDate,
          })
          .from(permitRevalidations)
          .where(
            and(
              eq(permitRevalidations.tenantId, tenantId),
              eq(permitRevalidations.permitId, permitId),
              eq(permitRevalidations.operationalDate, currentOperationalDate),
            ),
          )
          .limit(1),
        this.db
          .select({ id: permitMdpOverrides.id })
          .from(permitMdpOverrides)
          .where(
            and(
              eq(permitMdpOverrides.tenantId, tenantId),
              eq(permitMdpOverrides.permitId, permitId),
              eq(permitMdpOverrides.operationalDate, currentOperationalDate),
            ),
          )
          .limit(1),
        this.db
          .select({ status: permitDailyProgress.status })
          .from(permitDailyProgress)
          .where(
            and(
              eq(permitDailyProgress.tenantId, tenantId),
              eq(permitDailyProgress.permitId, permitId),
              eq(permitDailyProgress.operationalDate, currentOperationalDate),
            ),
          )
          .limit(1),
        this.hasOpenLototoIsolations(permitId, tenantId, permit),
      ]);

    const todayReopenOutcome =
      todayReopen?.outcome === 'passed' || todayReopen?.outcome === 'failed'
        ? todayReopen.outcome
        : null;
    const overrideUsedToday = Boolean(overrideToday);
    const progressSubmittedToday = todayProgress?.status === 'submitted';

    const dayCycleState = resolveMultiDayCycleState({
      lateSecureRequired,
      overrideUsedToday,
      todayReopenOutcome,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      isFirstOperationalDay,
      onFinalDay,
      todaySecureComplete,
      pastCutoff: dayContext.pastCutoff,
      progressSubmittedToday,
    });

    const clearedForWorkToday = isClearedForWorkToday({
      lateSecureRequired,
      overrideUsedToday,
      todayReopenOutcome,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      isFirstOperationalDay,
    });

    const dayNumber = dayNumberOfWindow({
      startOperationalDate: multiDay.startOperationalDate,
      currentOperationalDate,
      maxDays: multiDay.maxMultiDayValidityDays,
    });

    return {
      isMultiDay: true,
      dayCycleState,
      currentOperationalDate,
      missingPriorSecureDates: missing,
      lateSecureRequired,
      clearedForWorkToday,
      overrideUsedToday,
      overnightIsolationRemains,
      todaySecureComplete,
      pastCutoff: dayContext.pastCutoff,
      progressSubmittedToday,
      emergencyOverrideAllowed: multiDay.emergencyOverrideAllowed,
      finalDay: multiDay.endOperationalDate,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      startOperationalDate: multiDay.startOperationalDate,
      endOperationalDate: multiDay.endOperationalDate,
      dayNumber,
      maxMultiDayValidityDays: multiDay.maxMultiDayValidityDays,
      operationalDayCutoff: multiDay.operationalDayCutoff,
      timezone: multiDay.timezone,
      requiredAction: buildDayCycleAction(permitId, dayCycleState),
      submittedBy: permit.submittedBy,
      reference: permit.reference,
    };
  }

  async listMissingPriorSecureDates(permitId: string, tenantId: string): Promise<string[]> {
    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)))
      .limit(1);
    if (!permit) {
      return [];
    }

    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    if (!multiDay.isMultiDay || !multiDay.startOperationalDate || !multiDay.endOperationalDate) {
      return [];
    }

    const currentOperationalDate = operationalDateKey(new Date(), multiDay.timezone || 'UTC');
    const secures = await this.loadDaySecures(permitId, tenantId);
    return missingPriorSecureDates({
      startOperationalDate: multiDay.startOperationalDate,
      endOperationalDate: multiDay.endOperationalDate,
      currentOperationalDate,
      secures,
    });
  }

  /**
   * B6 gate: block reopen/continue/clear while a prior operational day lacks a complete secure.
   */
  async assertNoOutstandingLateSecure(permitId: string, tenantId: string): Promise<void> {
    const missing = await this.listMissingPriorSecureDates(permitId, tenantId);
    if (missing.length > 0) {
      throw new ConflictException(
        `Late secure outstanding for operational day(s): ${missing.join(', ')}. Complete late secure with reason before reopen/clear.`,
      );
    }
  }

  async createDaySecure(permitId: string, dto: CreateDaySecureDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, 'write');
    await this.morningBriefingService.assertCustody(permitId, tenantId, user);

    if (!dto.personnelCleared) {
      throw new BadRequestException(
        'Personnel must be cleared / accounted for before end-of-day secure',
      );
    }

    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    if (!multiDay.isMultiDay) {
      throw new BadRequestException('End-of-day secure applies only to multi-day permits');
    }

    const mode = resolveDaySecureChecklistMode(multiDay.dailyRevalidationRequired);
    const missing = missingDaySecureChecklistKeys(
      multiDay.dailyRevalidationRequired,
      dto.checklist as unknown as Record<string, unknown>,
      dto.personnelCleared,
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Incomplete ${mode} day-secure checklist; missing: ${missing.join(', ')}`,
      );
    }

    const operationalDate = dto.operationalDate.slice(0, 10);
    await this.requireSubmittedProgress(permitId, tenantId, operationalDate);

    const currentOperationalDate = operationalDateKey(new Date(), multiDay.timezone || 'UTC');
    const late = isLateSecure(operationalDate, currentOperationalDate);
    const lateReason = dto.lateReason?.trim() || '';
    if (late && lateReason.length < 3) {
      throw new BadRequestException(
        'Late secure requires a reason (prior operational day was not secured on time)',
      );
    }

    const finalDay = isFinalDaySecure(operationalDate, multiDay.endOperationalDate);

    const existing = await this.db
      .select({ id: permitDaySecures.id })
      .from(permitDaySecures)
      .where(
        and(
          eq(permitDaySecures.tenantId, tenantId),
          eq(permitDaySecures.permitId, permitId),
          eq(permitDaySecures.operationalDate, operationalDate),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Day already secured for this operational date');
    }

    const openIsolationsRemain = await this.hasOpenLototoIsolations(permitId, tenantId, permit);
    const countersign = decideDaySecureCountersign({
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      openIsolationsRemain,
    });

    const checklistPayload: Record<string, unknown> = {
      mode,
      personnelCleared: true,
      workAreaLeftSafe: dto.checklist.workAreaLeftSafe,
      materialsToolsSecured: dto.checklist.materialsToolsSecured,
      countersignRequired: countersign.required,
      countersignReasons: countersign.reasons,
      finalDay,
      closedPath: finalDay,
    };
    if (mode === 'full') {
      checklistPayload.isolationsIntact = dto.checklist.isolationsIntact === true;
      checklistPayload.openingsBarricaded = dto.checklist.openingsBarricaded === true;
      checklistPayload.emergencyAccessClear = dto.checklist.emergencyAccessClear === true;
      checklistPayload.overnightHazardsNoted = dto.checklist.overnightHazardsNoted === true;
    }

    const status = countersign.required ? 'pending_countersign' : 'submitted';
    const now = new Date();
    const [row] = await this.db
      .insert(permitDaySecures)
      .values({
        tenantId,
        permitId,
        operationalDate,
        checklist: checklistPayload,
        notes: dto.notes ?? '',
        personnelCleared: true,
        late,
        lateReason: late ? lateReason : null,
        securedBy: actorId,
        securedAt: now,
        status,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    const eventType = late ? 'late_secure_recorded' : 'day_secured';
    const auditAction = late
      ? MDP_AUDIT_ACTIONS.lateSecureRecorded
      : MDP_AUDIT_ACTIONS.daySecured;

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType,
      actorId,
      payload: {
        daySecureId: row.id,
        operationalDate,
        countersignRequired: countersign.required,
        countersignReasons: countersign.reasons,
        late,
        finalDay,
      },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: auditAction,
      entityType: 'permit_day_secure',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: {
        permitId,
        operationalDate,
        countersignRequired: countersign.required,
        countersignReasons: countersign.reasons,
        late,
        finalDay,
      },
    });

    this.logService.logEvent({
      action: auditAction,
      permitId,
      tenantId,
      userId: actorId,
      metadata: {
        daySecureId: row.id,
        operationalDate,
        countersignRequired: countersign.required,
        late,
        finalDay,
      },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return row;
  }

  /**
   * Next-morning Resume persists the open pause as that day's secure.
   * The pause was made on that operational date, so this is not a late secure.
   * It counts as complete: the executor already attested the leave-safe checklist.
   */
  async recordSecureFromOvernightPause(
    permitId: string,
    user: AuthenticatedUser,
    input: {
      operationalDate: string;
      summary: string;
      checklist: Record<string, unknown>;
      /** Missed pause: one reason covers every missing operational date. */
      late?: boolean;
      lateReason?: string;
    },
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, 'write');
    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    if (!multiDay.isMultiDay) {
      return null;
    }

    const operationalDate = input.operationalDate.slice(0, 10);
    const existing = await this.db
      .select({ id: permitDaySecures.id })
      .from(permitDaySecures)
      .where(
        and(
          eq(permitDaySecures.tenantId, tenantId),
          eq(permitDaySecures.permitId, permitId),
          eq(permitDaySecures.operationalDate, operationalDate),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return null;
    }

    const personnelCleared = input.checklist.personnelCleared === true;
    const missing = missingDaySecureChecklistKeys(
      multiDay.dailyRevalidationRequired,
      input.checklist,
      personnelCleared,
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Incomplete pause checklist for day secure; missing: ${missing.join(', ')}`,
      );
    }

    const late = input.late === true;
    const lateReason = input.lateReason?.trim() ?? '';
    if (late && lateReason.length < 3) {
      throw new BadRequestException(
        'Late secure requires a reason (prior operational day was not secured on time)',
      );
    }

    const mode = resolveDaySecureChecklistMode(multiDay.dailyRevalidationRequired);
    const finalDay = isFinalDaySecure(operationalDate, multiDay.endOperationalDate);
    const checklistPayload: Record<string, unknown> = {
      mode,
      source: late ? 'work_pause_late' : 'work_pause',
      personnelCleared: true,
      workAreaLeftSafe: input.checklist.workAreaLeftSafe === true,
      materialsToolsSecured: input.checklist.materialsToolsSecured === true,
      countersignRequired: false,
      countersignReasons: [],
      finalDay,
      closedPath: finalDay,
    };
    if (mode === 'full') {
      checklistPayload.isolationsIntact = input.checklist.isolationsIntact === true;
      checklistPayload.openingsBarricaded = input.checklist.openingsBarricaded === true;
      checklistPayload.emergencyAccessClear = input.checklist.emergencyAccessClear === true;
      checklistPayload.overnightHazardsNoted = input.checklist.overnightHazardsNoted === true;
    }

    const [row] = await this.db
      .insert(permitDaySecures)
      .values({
        tenantId,
        permitId,
        operationalDate,
        checklist: checklistPayload,
        notes: input.summary.trim(),
        personnelCleared: true,
        late,
        lateReason: late ? lateReason : null,
        securedBy: actorId,
        securedAt: new Date(),
        status: 'submitted',
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType: late ? 'late_secure_recorded' : 'day_secured',
      actorId,
      payload: {
        daySecureId: row.id,
        operationalDate,
        source: late ? 'work_pause_late' : 'work_pause',
        late,
        finalDay,
      },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: late ? MDP_AUDIT_ACTIONS.lateSecureRecorded : MDP_AUDIT_ACTIONS.daySecured,
      entityType: 'permit_day_secure',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: {
        permitId,
        operationalDate,
        source: late ? 'work_pause_late' : 'work_pause',
        late,
        finalDay,
      },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return row;
  }

  async countersignDaySecure(
    permitId: string,
    secureId: string,
    dto: CountersignDaySecureDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    await this.requirePermit(permitId, tenantId, 'write');

    const [row] = await this.db
      .select()
      .from(permitDaySecures)
      .where(
        and(
          eq(permitDaySecures.id, secureId),
          eq(permitDaySecures.tenantId, tenantId),
          eq(permitDaySecures.permitId, permitId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Day secure record not found');
    }

    const checklist = (row.checklist ?? {}) as Record<string, unknown>;
    if (checklist.countersignRequired !== true) {
      throw new ConflictException('Countersign is not required for this day secure');
    }

    if (row.status !== 'pending_countersign') {
      throw new ConflictException('Day secure is not awaiting countersign');
    }

    if (row.countersignedBy) {
      throw new ConflictException('Day secure already countersigned');
    }

    if (row.securedBy === actorId) {
      throw new ForbiddenException('Executor cannot countersign their own day secure');
    }

    const now = new Date();
    const notes =
      dto.notes && dto.notes.trim().length > 0
        ? `${row.notes}${row.notes ? '\n' : ''}[countersign] ${dto.notes.trim()}`
        : row.notes;

    const [updated] = await this.db
      .update(permitDaySecures)
      .set({
        countersignedBy: actorId,
        countersignedAt: now,
        status: 'submitted',
        notes,
        updatedBy: actorId,
        updatedAt: now,
      })
      .where(eq(permitDaySecures.id, row.id))
      .returning();

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType: 'day_secure_countersigned',
      actorId,
      payload: { daySecureId: row.id, operationalDate: row.operationalDate },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.daySecureCountersigned,
      entityType: 'permit_day_secure',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId, operationalDate: row.operationalDate },
    });

    this.logService.logEvent({
      action: MDP_AUDIT_ACTIONS.daySecureCountersigned,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { daySecureId: row.id, operationalDate: row.operationalDate },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return updated;
  }

  /**
   * Batch day-cycle resolution for morning queue / KPIs (avoids N+1 per permit).
   */
  async resolveDayCyclesBatch(
    permitList: Array<{
      id: string;
      reference: string | null;
      plannedStartAt: Date | null;
      plannedEndAt: Date | null;
      dailyRevalidationRequired: boolean | null;
      emergencyOverrideAllowed: boolean | null;
      submittedBy: string | null;
    }>,
    tenantId: string,
  ): Promise<Map<string, Awaited<ReturnType<DaySecureService['resolveDayCycle']>>>> {
    const out = new Map<string, Awaited<ReturnType<DaySecureService['resolveDayCycle']>>>();
    if (permitList.length === 0) {
      return out;
    }

    const [org] = await this.loadOrgMdp(tenantId);
    const timezone = org?.timezone?.trim() || 'UTC';
    const dayContext = resolveReopenDayContext(
      new Date(),
      timezone,
      org?.operationalDayCutoff ?? undefined,
    );
    const currentOperationalDate = dayContext.operationalDate;
    const ids = permitList.map((p) => p.id);

    const [allSecures, allReopens, allOverrides, allProgress, openIsolationPermitIds] =
      await Promise.all([
        this.db
          .select()
          .from(permitDaySecures)
          .where(
            and(eq(permitDaySecures.tenantId, tenantId), inArray(permitDaySecures.permitId, ids)),
          ),
        this.db
          .select({
            permitId: permitRevalidations.permitId,
            outcome: permitRevalidations.outcome,
            operationalDate: permitRevalidations.operationalDate,
          })
          .from(permitRevalidations)
          .where(
            and(
              eq(permitRevalidations.tenantId, tenantId),
              inArray(permitRevalidations.permitId, ids),
              eq(permitRevalidations.operationalDate, currentOperationalDate),
            ),
          ),
        this.db
          .select({
            permitId: permitMdpOverrides.permitId,
            id: permitMdpOverrides.id,
          })
          .from(permitMdpOverrides)
          .where(
            and(
              eq(permitMdpOverrides.tenantId, tenantId),
              inArray(permitMdpOverrides.permitId, ids),
              eq(permitMdpOverrides.operationalDate, currentOperationalDate),
            ),
          ),
        this.db
          .select({
            permitId: permitDailyProgress.permitId,
            status: permitDailyProgress.status,
          })
          .from(permitDailyProgress)
          .where(
            and(
              eq(permitDailyProgress.tenantId, tenantId),
              inArray(permitDailyProgress.permitId, ids),
              eq(permitDailyProgress.operationalDate, currentOperationalDate),
            ),
          ),
        this.loadOpenIsolationPermitIds(ids, tenantId),
      ]);

    const securesByPermit = new Map<string, typeof allSecures>();
    for (const row of allSecures) {
      const list = securesByPermit.get(row.permitId) ?? [];
      list.push(row);
      securesByPermit.set(row.permitId, list);
    }
    const reopenByPermit = new Map(allReopens.map((r) => [r.permitId, r]));
    const overrideByPermit = new Set(allOverrides.map((r) => r.permitId));
    const progressByPermit = new Map(allProgress.map((r) => [r.permitId, r.status]));
    const isolationByPermit = new Set(openIsolationPermitIds);

    for (const permit of permitList) {
      const multiDay = buildMultiDaySummary(permit, org ?? null);
      if (!multiDay.isMultiDay || !multiDay.startOperationalDate || !multiDay.endOperationalDate) {
        out.set(permit.id, {
          isMultiDay: false,
          dayCycleState: 'not_multi_day' as const,
          currentOperationalDate: null,
          missingPriorSecureDates: [],
          lateSecureRequired: false,
          finalDay: multiDay.endOperationalDate,
          dayNumber: null,
          maxMultiDayValidityDays: multiDay.maxMultiDayValidityDays,
          operationalDayCutoff: multiDay.operationalDayCutoff,
          timezone: multiDay.timezone,
          dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
          emergencyOverrideAllowed: multiDay.emergencyOverrideAllowed,
          requiredAction: buildDayCycleAction(permit.id, 'not_multi_day'),
          submittedBy: permit.submittedBy,
          reference: permit.reference,
        });
        continue;
      }

      const secures = securesByPermit.get(permit.id) ?? [];
      const missing = missingPriorSecureDates({
        startOperationalDate: multiDay.startOperationalDate,
        endOperationalDate: multiDay.endOperationalDate,
        currentOperationalDate,
        secures,
      });
      const lateSecureRequired = missing.length > 0;
      const onFinalDay = isFinalDaySecure(currentOperationalDate, multiDay.endOperationalDate);
      const isFirstOperationalDay = currentOperationalDate === multiDay.startOperationalDate;
      const todaySecureComplete = hasCompleteSecureForDate(secures, currentOperationalDate);
      const todayReopen = reopenByPermit.get(permit.id);
      const overrideUsedToday = overrideByPermit.has(permit.id);
      const todayReopenOutcome =
        todayReopen?.outcome === 'passed' || todayReopen?.outcome === 'failed'
          ? todayReopen.outcome
          : null;
      const progressSubmittedToday = progressByPermit.get(permit.id) === 'submitted';
      const overnightIsolationRemains = isolationByPermit.has(permit.id);

      const dayCycleState = resolveMultiDayCycleState({
        lateSecureRequired,
        overrideUsedToday,
        todayReopenOutcome,
        dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
        isFirstOperationalDay,
        onFinalDay,
        todaySecureComplete,
        pastCutoff: dayContext.pastCutoff,
        progressSubmittedToday,
      });

      const clearedForWorkToday = isClearedForWorkToday({
        lateSecureRequired,
        overrideUsedToday,
        todayReopenOutcome,
        dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
        isFirstOperationalDay,
      });

      out.set(permit.id, {
        isMultiDay: true,
        dayCycleState,
        currentOperationalDate,
        missingPriorSecureDates: missing,
        lateSecureRequired,
        clearedForWorkToday,
        overrideUsedToday,
        overnightIsolationRemains,
        todaySecureComplete,
        pastCutoff: dayContext.pastCutoff,
        progressSubmittedToday,
        emergencyOverrideAllowed: multiDay.emergencyOverrideAllowed,
        finalDay: multiDay.endOperationalDate,
        dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
        startOperationalDate: multiDay.startOperationalDate,
        endOperationalDate: multiDay.endOperationalDate,
        dayNumber: dayNumberOfWindow({
          startOperationalDate: multiDay.startOperationalDate,
          currentOperationalDate,
          maxDays: multiDay.maxMultiDayValidityDays,
        }),
        maxMultiDayValidityDays: multiDay.maxMultiDayValidityDays,
        operationalDayCutoff: multiDay.operationalDayCutoff,
        timezone: multiDay.timezone,
        requiredAction: buildDayCycleAction(permit.id, dayCycleState),
        submittedBy: permit.submittedBy,
        reference: permit.reference,
      });
    }

    return out;
  }

  /** Batch: permit IDs with open overnight isolations (certificates or crew locks). */
  private async loadOpenIsolationPermitIds(
    permitIds: string[],
    tenantId: string,
  ): Promise<string[]> {
    if (permitIds.length === 0) {
      return [];
    }

    const linked = await this.db
      .select({ permitId: isolationCertificatePermits.permitId })
      .from(isolationCertificatePermits)
      .innerJoin(
        isolationCertificates,
        eq(isolationCertificatePermits.certificateId, isolationCertificates.id),
      )
      .where(
        and(
          eq(isolationCertificatePermits.tenantId, tenantId),
          inArray(isolationCertificatePermits.permitId, permitIds),
          ne(isolationCertificatePermits.attachmentStatus, 'detached'),
          inArray(isolationCertificates.status, [...OVERNIGHT_OPEN_ISOLATION_STATUSES]),
        ),
      );

    const withLocks = await this.db
      .select({ permitId: lockboxCrewLocks.permitId })
      .from(lockboxCrewLocks)
      .innerJoin(permits, eq(lockboxCrewLocks.permitId, permits.id))
      .where(
        and(
          inArray(lockboxCrewLocks.permitId, permitIds),
          eq(permits.tenantId, tenantId),
          eq(permits.lototoRequired, true),
          isNull(lockboxCrewLocks.removedAt),
        ),
      );

    return [
      ...new Set(
        [...linked.map((r) => r.permitId), ...withLocks.map((r) => r.permitId)].filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        ),
      ),
    ];
  }

  private async loadDaySecures(permitId: string, tenantId: string) {
    return this.db
      .select()
      .from(permitDaySecures)
      .where(and(eq(permitDaySecures.tenantId, tenantId), eq(permitDaySecures.permitId, permitId)))
      .orderBy(desc(permitDaySecures.operationalDate));
  }

  private async loadOrgMdp(tenantId: string) {
    return this.db
      .select({
        timezone: organisations.timezone,
        maxMultiDayValidityDays: organisations.maxMultiDayValidityDays,
        operationalDayCutoff: organisations.operationalDayCutoff,
        overtimeApproverRole: organisations.overtimeApproverRole,
      })
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId))
      .limit(1);
  }

  /**
   * Open overnight isolations: linked certificates still isolated, or crew locks still on.
   */
  private async hasOpenLototoIsolations(
    permitId: string,
    tenantId: string,
    permit: typeof permits.$inferSelect,
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
          eq(isolationCertificatePermits.permitId, permitId),
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
      .where(and(eq(lockboxCrewLocks.permitId, permitId), isNull(lockboxCrewLocks.removedAt)))
      .limit(1);

    return Boolean(lock);
  }

  /** Progress-first gate: secure requires submitted daily progress for the same operational date. */
  private async requireSubmittedProgress(
    permitId: string,
    tenantId: string,
    operationalDate: string,
  ): Promise<void> {
    const [progress] = await this.db
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

    if (!progress) {
      throw new BadRequestException(
        'Daily progress must be submitted for this operational date before end-of-day secure',
      );
    }

    if (progress.status !== 'submitted') {
      throw new BadRequestException(
        'Daily progress must be submitted (not draft) before end-of-day secure',
      );
    }
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
          ? 'Day secure can only be recorded for active permits'
          : 'Permit is not available for day-secure viewing',
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
