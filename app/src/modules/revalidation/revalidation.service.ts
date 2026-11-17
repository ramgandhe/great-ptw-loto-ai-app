import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  incidentPermits,
  incidents,
  isolationCertificatePermits,
  isolationCertificates,
  lockboxCrewLocks,
  organisations,
  permitExtensions,
  permitGasTesting,
  permitHazards,
  permitMdpOverrides,
  permitOvertimeRequests,
  permitPpe,
  permitRevalidations,
  permits,
  permitSuspensions,
  revalidationHistory,
  simopsCasePermits,
  simopsCases,
} from '../../database/schema';
import { OVERNIGHT_OPEN_ISOLATION_STATUSES } from '../daily-progress/day-secure-countersign';
import { DaySecureService } from '../daily-progress/day-secure.service';
import { MorningBriefingService } from '../daily-progress/morning-briefing.service';
import {
  isDailyCrewRequiredForClear,
  isPpeHazardReconfirmRequired,
  isToolboxTalkRequiredForClear,
} from '../daily-progress/morning-briefing';
import { hazardControlKey } from '../execution/execution-start';
import { AuditService } from '../logging/audit.service';
import { CanonicalNotificationService } from '../notifications/canonical-notification.service';
import { areaAuthorityIds } from '../permit/permit-access';
import { SimopsService } from '../simops/simops.service';
import {
  DecideExtensionDto,
  DecideOvertimeDto,
  MdpOverrideDto,
  ReopenPermitDto,
  RequestExtensionDto,
  RequestOvertimeDto,
  RevalidatePermitDto,
  SuspendPermitDto,
} from './dto/revalidation.dto';
import { MDP_AUDIT_ACTIONS } from './mdp-audit-events';
import {
  canClearSuspensionViaMdpReopen,
  evaluateClearanceGate,
  type MdpSuspensionSource,
} from './multi-day-clearance';
import {
  actorMayApproveOvertime,
  extensionExceedsMaxValidity,
  validateOvertimeRequestedUntil,
} from './multi-day-overtime';
import { resolveMultiDayTenantSettings } from './multi-day-settings';
import { buildMultiDaySummary } from './multi-day-summary';
import {
  bindTodayOperationalDate,
  isDailyReopenRequired,
  resolveReopenDayContext,
} from './multi-day-reopen';
import {
  buildSiteSecurityTemplate,
  decideReopenModules,
  evaluateReopenComposition,
} from './multi-day-reopen-composition';
import { RevalidationCacheService } from './revalidation-cache.service';
import { RevalidationLogService } from './revalidation-log.service';

@Injectable()
export class RevalidationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly cacheService: RevalidationCacheService,
    private readonly logService: RevalidationLogService,
    private readonly daySecureService: DaySecureService,
    private readonly morningBriefingService: MorningBriefingService,
    private readonly canonicalNotifications: CanonicalNotificationService,
    @Optional() private readonly simopsService?: SimopsService,
  ) {}

  /** Preferred today-bound reopen (Slice C1). */
  async reopen(permitId: string, dto: ReopenPermitDto, user: AuthenticatedUser) {
    return this.recordTodayBoundRevalidation(permitId, dto, user, null);
  }

  /**
   * First work-resume of a new operational day writes one passed reopen for today.
   * An existing row for today is left unchanged. Resume already checked the blocking
   * modules; toolbox and crew records are written by later resume steps.
   */
  async recordPassedReopenFromWorkResume(
    permitId: string,
    user: AuthenticatedUser,
    input: { checklist: Record<string, unknown>; findings: string },
  ): Promise<{ id: string; created: boolean } | null> {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active']);
    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    if (!multiDay.isMultiDay) {
      return null;
    }

    const dayContext = resolveReopenDayContext(
      new Date(),
      multiDay.timezone,
      multiDay.operationalDayCutoff,
    );
    const operationalDate = dayContext.operationalDate;

    const [existing] = await this.db
      .select({ id: permitRevalidations.id })
      .from(permitRevalidations)
      .where(
        and(
          eq(permitRevalidations.tenantId, tenantId),
          eq(permitRevalidations.permitId, permitId),
          eq(permitRevalidations.operationalDate, operationalDate),
        ),
      )
      .limit(1);

    if (existing) {
      return { id: existing.id, created: false };
    }

    const findings = (input.findings.trim() || 'Morning clear recorded from work resume.').slice(
      0,
      8000,
    );
    const checklistPayload: Record<string, unknown> = {
      ...input.checklist,
      reopen: true,
      todayBound: true,
      source: 'work_resume',
      clearedForWork: true,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      timezone: dayContext.timezone,
      operationalDayCutoff: dayContext.operationalDayCutoff,
      pastCutoff: dayContext.pastCutoff,
    };

    const [row] = await this.db
      .insert(permitRevalidations)
      .values({
        tenantId,
        permitId,
        operationalDate,
        outcome: 'passed',
        findings,
        checklist: checklistPayload,
        revalidatedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.appendHistory(tenantId, permitId, 'revalidation_passed', actorId, {
      revalidationId: row.id,
      operationalDate,
      todayBound: true,
      pastCutoff: dayContext.pastCutoff,
      clearedForWork: true,
      source: 'work_resume',
    });
    await this.clearForWorkToday(permit, actorId, row.id);
    await this.appendHistory(tenantId, permitId, 'permit_cleared', actorId, {
      revalidationId: row.id,
      operationalDate,
      source: 'work_resume',
    });
    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.revalidationPassed,
      entityType: 'permit_revalidation',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: {
        permitId,
        outcome: 'passed',
        operationalDate,
        source: 'work_resume',
      },
    });
    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.permitCleared,
      entityType: 'permit',
      entityId: permitId,
      userId: actorId,
      tenantId,
      metadata: { revalidationId: row.id, operationalDate, source: 'work_resume' },
    });
    this.logService.logEvent({
      action: MDP_AUDIT_ACTIONS.revalidationPassed,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { revalidationId: row.id, operationalDate, source: 'work_resume' },
    });
    await this.cacheService.invalidatePermit(tenantId, permitId);
    return { id: row.id, created: true };
  }

  /** Slice G: composed reopen checklist + live module status / links. */
  async getReopenComposition(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active', 'suspended']);
    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    const dayContext = resolveReopenDayContext(
      new Date(),
      multiDay.timezone,
      multiDay.operationalDayCutoff,
    );

    const context = await this.loadReopenCompositionContext(permit, tenantId);
    const briefing = await this.morningBriefingService.loadBriefingSnapshot(
      permitId,
      tenantId,
      dayContext.operationalDate,
    );
    const toolboxTalkRequired = isToolboxTalkRequiredForClear({
      isMultiDay: multiDay.isMultiDay,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      dailyToolboxTalkRequired: briefing.policy.dailyToolboxTalkRequired,
    });
    const crewRosterRequired = isDailyCrewRequiredForClear({
      isMultiDay: multiDay.isMultiDay,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      dailyCrewRosterRequired: briefing.policy.dailyCrewRosterRequired,
    });
    const ppeHazardReconfirmRequired = isPpeHazardReconfirmRequired({
      isMultiDay: multiDay.isMultiDay,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      dailyPpeHazardReconfirm: briefing.policy.dailyPpeHazardReconfirm,
    });
    const rosterUserIds = briefing.crew.map((row) => row.workforceUserId);
    const attendeeUserIds = briefing.talk?.attendeeUserIds ?? [];

    const decided = decideReopenModules({
      permitId,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      gasTestingRequired: context.gasTestingRequired,
      openIsolationsRemain: context.openIsolationsRemain,
      unresolvedSimopsCount: context.unresolvedSimopsCount,
      toolboxTalkRequired,
      crewRosterRequired,
      ppeHazardReconfirmRequired,
    });
    const evaluated = evaluateReopenComposition({
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      gasTestingRequired: context.gasTestingRequired,
      openIsolationsRemain: context.openIsolationsRemain,
      unresolvedSimopsCount: context.unresolvedSimopsCount,
      gasItems: context.gasItems,
      openIsolationCount: context.openIsolationCount,
      toolboxTalkRequired,
      crewRosterRequired,
      ppeHazardReconfirmRequired,
      talkRecorded: Boolean(briefing.talk),
      crewCount: briefing.crew.length,
      attendeeUserIds,
      rosterUserIds,
      requiredHazardKeys: context.requiredHazardKeys,
      requiredPpeIds: context.requiredPpeIds,
      checklist: {},
    });

    // Prefer live module hrefs from decide; satisfaction starts false until checklist submitted.
    const modules = decided.map((mod) => {
      const live = evaluated.modules.find((row) => row.key === mod.key);
      return {
        ...mod,
        href: mod.href,
        satisfied: false,
        blockers: live?.blockers ?? [],
      };
    });

    return {
      isMultiDay: multiDay.isMultiDay,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      operationalDate: dayContext.operationalDate,
      siteSecurity: multiDay.dailyRevalidationRequired ? buildSiteSecurityTemplate() : [],
      gasItems: context.gasItems,
      requiredHazardKeys: context.requiredHazardKeys,
      requiredPpeIds: context.requiredPpeIds,
      openIsolationsRemain: context.openIsolationsRemain,
      openIsolationCount: context.openIsolationCount,
      overnightIsolationRemains: context.openIsolationsRemain,
      toolboxTalkRecorded: Boolean(briefing.talk),
      crewCount: briefing.crew.length,
      modules,
      links: {
        gas: `/execution/${permitId}`,
        lototo: `/lototo/active`,
        simops: `/simops?permitId=${permitId}`,
        toolbox: `/permits/${permitId}?tab=work`,
        crew: `/permits/${permitId}?tab=work`,
      },
    };
  }

  /** Legacy alias — still today-bound; optional operationalDate must match org today. */
  async revalidate(permitId: string, dto: RevalidatePermitDto, user: AuthenticatedUser) {
    return this.recordTodayBoundRevalidation(permitId, dto, user, dto.operationalDate ?? null);
  }

  private async recordTodayBoundRevalidation(
    permitId: string,
    dto: Pick<ReopenPermitDto, 'outcome' | 'findings' | 'checklist'>,
    user: AuthenticatedUser,
    requestedOperationalDate: string | null,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active', 'suspended']);
    await this.assertCanReopen(permitId, tenantId, permit);
    await this.morningBriefingService.assertCustody(permitId, tenantId, user);

    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    const dayContext = resolveReopenDayContext(
      new Date(),
      multiDay.timezone,
      multiDay.operationalDayCutoff,
    );

    const bound = bindTodayOperationalDate(requestedOperationalDate, dayContext);
    if (!bound.ok) {
      throw new BadRequestException(
        `Reopen is today-bound (${dayContext.timezone}); expected operational date ${bound.expected}, got ${bound.requested}`,
      );
    }
    const operationalDate = bound.operationalDate;

    if (!multiDay.isMultiDay) {
      throw new BadRequestException('Daily reopen applies only to multi-day permits');
    }

    // C4: audit OFF — reopen is optional (not mandatory); still allow recording.
    const reopenRequired = isDailyReopenRequired({
      isMultiDay: multiDay.isMultiDay,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      endOperationalDate: multiDay.endOperationalDate,
      currentOperationalDate: operationalDate,
    });

    const existing = await this.db
      .select({ id: permitRevalidations.id })
      .from(permitRevalidations)
      .where(
        and(
          eq(permitRevalidations.tenantId, tenantId),
          eq(permitRevalidations.permitId, permitId),
          eq(permitRevalidations.operationalDate, operationalDate),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Reopen / revalidation already recorded for today');
    }

    const compositionContext = await this.loadReopenCompositionContext(permit, tenantId);
    const briefing = await this.morningBriefingService.loadBriefingSnapshot(
      permitId,
      tenantId,
      operationalDate,
    );
    const toolboxTalkRequired = isToolboxTalkRequiredForClear({
      isMultiDay: multiDay.isMultiDay,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      dailyToolboxTalkRequired: briefing.policy.dailyToolboxTalkRequired,
    });
    const crewRosterRequired = isDailyCrewRequiredForClear({
      isMultiDay: multiDay.isMultiDay,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      dailyCrewRosterRequired: briefing.policy.dailyCrewRosterRequired,
    });
    const ppeHazardReconfirmRequired = isPpeHazardReconfirmRequired({
      isMultiDay: multiDay.isMultiDay,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      dailyPpeHazardReconfirm: briefing.policy.dailyPpeHazardReconfirm,
    });
    let compositionResult: ReturnType<typeof evaluateReopenComposition> | null = null;
    if (dto.outcome === 'passed') {
      compositionResult = evaluateReopenComposition({
        dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
        gasTestingRequired: compositionContext.gasTestingRequired,
        openIsolationsRemain: compositionContext.openIsolationsRemain,
        unresolvedSimopsCount: compositionContext.unresolvedSimopsCount,
        gasItems: compositionContext.gasItems,
        openIsolationCount: compositionContext.openIsolationCount,
        toolboxTalkRequired,
        crewRosterRequired,
        ppeHazardReconfirmRequired,
        talkRecorded: Boolean(briefing.talk),
        crewCount: briefing.crew.length,
        attendeeUserIds: briefing.talk?.attendeeUserIds ?? [],
        rosterUserIds: briefing.crew.map((row) => row.workforceUserId),
        requiredHazardKeys: compositionContext.requiredHazardKeys,
        requiredPpeIds: compositionContext.requiredPpeIds,
        checklist: dto.checklist ?? {},
      });
      // G: block clear when composed checks are incomplete (audit ON site security + conditional modules).
      if (!compositionResult.ok) {
        throw new BadRequestException(
          `Reopen cannot clear for work until composed checks are current: ${compositionResult.missing.join('; ')}`,
        );
      }
    }

    const clearedForWork = dto.outcome === 'passed';
    const checklistPayload: Record<string, unknown> = {
      ...(dto.checklist ?? {}),
      reopen: true,
      todayBound: true,
      reopenRequired,
      clearedForWork,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      timezone: dayContext.timezone,
      operationalDayCutoff: dayContext.operationalDayCutoff,
      pastCutoff: dayContext.pastCutoff,
      composition: compositionResult
        ? {
            ok: compositionResult.ok,
            modules: compositionResult.modules.map((mod) => ({
              key: mod.key,
              required: mod.required,
              satisfied: mod.satisfied,
            })),
          }
        : null,
    };

    const [row] = await this.db
      .insert(permitRevalidations)
      .values({
        tenantId,
        permitId,
        operationalDate,
        outcome: dto.outcome,
        findings: dto.findings,
        checklist: checklistPayload,
        revalidatedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    const eventType = dto.outcome === 'passed' ? 'revalidation_passed' : 'revalidation_failed';
    const auditAction =
      dto.outcome === 'passed'
        ? MDP_AUDIT_ACTIONS.revalidationPassed
        : MDP_AUDIT_ACTIONS.revalidationFailed;

    await this.appendHistory(tenantId, permitId, eventType, actorId, {
      revalidationId: row.id,
      operationalDate,
      todayBound: true,
      pastCutoff: dayContext.pastCutoff,
      clearedForWork,
    });

    let cleared: { status: string; resumedSuspensionId?: string } | null = null;

    if (dto.outcome === 'passed') {
      // C2: pass → cleared for work (no separate Continue).
      cleared = await this.clearForWorkToday(permit, actorId, row.id);
      await this.appendHistory(tenantId, permitId, 'permit_cleared', actorId, {
        revalidationId: row.id,
        operationalDate,
      });
      await this.auditService.log({
        action: MDP_AUDIT_ACTIONS.permitCleared,
        entityType: 'permit',
        entityId: permitId,
        userId: actorId,
        tenantId,
        metadata: { revalidationId: row.id, operationalDate },
      });
    } else {
      // C5: fail → suspend + failed_reopen
      if (permit.status !== 'suspended') {
        await this.suspendInternal(permit, actorId, 'Failed daily reopen', 'failed_revalidation');
      }
      await this.appendHistory(tenantId, permitId, 'failed_reopen', actorId, {
        revalidationId: row.id,
        operationalDate,
        dayCycleState: 'failed_reopen',
      });
      await this.canonicalNotifications
        .fromMdpFailedReopen({
          tenantId,
          permitId,
          actorId,
          operationalDate,
          findings: dto.findings,
        })
        .catch(() => undefined);
    }

    await this.auditService.log({
      action: auditAction,
      entityType: 'permit_revalidation',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: {
        permitId,
        outcome: dto.outcome,
        operationalDate,
        timezone: dayContext.timezone,
        pastCutoff: dayContext.pastCutoff,
        clearedForWork,
      },
    });

    this.logService.logEvent({
      action: auditAction,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { revalidationId: row.id, operationalDate, clearedForWork },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return {
      ...row,
      reopenContext: dayContext,
      clearedForWork,
      cleared,
    };
  }

  /**
   * C3 compat shim: Continue is no longer required after reopen.
   * If already cleared today, returns current status; otherwise requires today's passed reopen.
   */
  async continuePermit(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active', 'suspended']);
    await this.daySecureService.assertNoOutstandingLateSecure(permitId, tenantId);

    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    const dayContext = resolveReopenDayContext(
      new Date(),
      multiDay.timezone,
      multiDay.operationalDayCutoff,
    );

    const [todayRow] = await this.db
      .select()
      .from(permitRevalidations)
      .where(
        and(
          eq(permitRevalidations.tenantId, tenantId),
          eq(permitRevalidations.permitId, permitId),
          eq(permitRevalidations.operationalDate, dayContext.operationalDate),
          eq(permitRevalidations.outcome, 'passed'),
        ),
      )
      .limit(1);

    if (!todayRow) {
      throw new ConflictException(
        'Continue is deprecated; submit today\'s reopen (POST /reopen) which clears for work automatically',
      );
    }

    const cleared = await this.clearForWorkToday(permit, actorId, todayRow.id);

    await this.appendHistory(tenantId, permitId, 'permit_continued', actorId, {
      revalidationId: todayRow.id,
      deprecatedShim: true,
      operationalDate: dayContext.operationalDate,
    });

    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.permitContinued,
      entityType: 'permit',
      entityId: permitId,
      userId: actorId,
      tenantId,
      metadata: { deprecatedShim: true, revalidationId: todayRow.id },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return {
      permitId,
      status: cleared.status,
      revalidationId: todayRow.id,
      deprecated: true,
      message: 'Continue is a compatibility shim; reopen already clears for work',
    };
  }

  /** C6 execution gate: multi-day + daily audit ON requires cleared today (or override). */
  async assertClearedForWorkToday(permitId: string, tenantId: string): Promise<void> {
    await this.daySecureService.assertNoOutstandingLateSecure(permitId, tenantId);

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
    const dayContext = resolveReopenDayContext(
      new Date(),
      multiDay.timezone,
      multiDay.operationalDayCutoff,
    );

    const [todayRow] = await this.db
      .select()
      .from(permitRevalidations)
      .where(
        and(
          eq(permitRevalidations.tenantId, tenantId),
          eq(permitRevalidations.permitId, permitId),
          eq(permitRevalidations.operationalDate, dayContext.operationalDate),
        ),
      )
      .limit(1);

    const [overrideRow] = await this.db
      .select({ id: permitMdpOverrides.id })
      .from(permitMdpOverrides)
      .where(
        and(
          eq(permitMdpOverrides.tenantId, tenantId),
          eq(permitMdpOverrides.permitId, permitId),
          eq(permitMdpOverrides.operationalDate, dayContext.operationalDate),
        ),
      )
      .limit(1);

    const gate = evaluateClearanceGate({
      isMultiDay: multiDay.isMultiDay,
      dailyRevalidationRequired: multiDay.dailyRevalidationRequired,
      operationalDate: dayContext.operationalDate,
      todayRevalidation: todayRow ?? null,
      overrideUsedToday: Boolean(overrideRow),
      startOperationalDate: multiDay.startOperationalDate,
    });

    if (!gate.allowed) {
      throw new ConflictException(
        `Multi-day permit is not cleared for work today (${dayContext.operationalDate}). Complete reopen or use emergency override.`,
      );
    }
  }

  /** Slice D: day-scoped emergency override of the reopen hard gate. */
  async useMdpOverride(permitId: string, dto: MdpOverrideDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active', 'suspended']);

    // Still require overnight secure hygiene before override bypasses reopen.
    await this.daySecureService.assertNoOutstandingLateSecure(permitId, tenantId);

    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    if (!multiDay.isMultiDay) {
      throw new BadRequestException('Emergency override applies only to multi-day permits');
    }

    // D2: reject if override disabled on the permit
    if (!multiDay.emergencyOverrideAllowed) {
      throw new ForbiddenException(
        'Emergency override is disabled for this permit (set at final approval)',
      );
    }

    const dayContext = resolveReopenDayContext(
      new Date(),
      multiDay.timezone,
      multiDay.operationalDayCutoff,
    );
    const operationalDate = dayContext.operationalDate;
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Override reason is required');
    }

    const existing = await this.db
      .select({ id: permitMdpOverrides.id })
      .from(permitMdpOverrides)
      .where(
        and(
          eq(permitMdpOverrides.tenantId, tenantId),
          eq(permitMdpOverrides.permitId, permitId),
          eq(permitMdpOverrides.operationalDate, operationalDate),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Emergency override already recorded for today');
    }

    const [row] = await this.db
      .insert(permitMdpOverrides)
      .values({
        tenantId,
        permitId,
        operationalDate,
        reason,
        overriddenBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    // Resume MDP-eligible holds so override actually unblocks work today.
    const cleared = await this.clearForWorkToday(permit, actorId, row.id);

    await this.appendHistory(tenantId, permitId, 'override_used', actorId, {
      overrideId: row.id,
      operationalDate,
      reason,
    });

    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.overrideUsed,
      entityType: 'permit_mdp_override',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId, operationalDate, reason },
    });

    this.logService.logEvent({
      action: MDP_AUDIT_ACTIONS.overrideUsed,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { overrideId: row.id, operationalDate },
    });

    // D3: notify issuer / HOD / safety
    await this.canonicalNotifications
      .fromMdpOverride({
        tenantId,
        permitId,
        actorId,
        operationalDate,
        reason,
      })
      .catch(() => undefined);

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return {
      ...row,
      cleared,
      dayCycleState: 'override_used' as const,
      reopenContext: dayContext,
    };
  }

  async suspend(permitId: string, dto: SuspendPermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active']);
    return this.suspendInternal(permit, actorId, dto.reason, 'manual');
  }

  async requestExtension(permitId: string, dto: RequestExtensionDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active', 'suspended']);
    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    const requestedEndAt = new Date(dto.requestedEndAt);

    // H5: beyond tenant max → renew instead of extend.
    if (
      extensionExceedsMaxValidity({
        plannedStartAt: permit.plannedStartAt,
        requestedEndAt,
        maxMultiDayValidityDays: multiDay.maxMultiDayValidityDays,
        timezone: multiDay.timezone,
      })
    ) {
      throw new BadRequestException(
        `Requested end exceeds the tenant multi-day maximum of ${multiDay.maxMultiDayValidityDays} operational days. Use renewal (POST /permits/{id}/renew) instead of extension.`,
      );
    }

    const [row] = await this.db
      .insert(permitExtensions)
      .values({
        tenantId,
        permitId,
        requestedEndAt,
        previousEndAt: permit.plannedEndAt,
        justification: dto.justification,
        status: 'pending',
        requestedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.appendHistory(tenantId, permitId, 'extension_requested', actorId, {
      extensionId: row.id,
    });

    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.extensionRequested,
      entityType: 'permit_extension',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId },
    });

    await this.canonicalNotifications
      .fromMdpTimeRequest({
        tenantId,
        permitId,
        actorId,
        kind: 'extension',
        phase: 'requested',
        requestId: row.id,
      })
      .catch(() => undefined);

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return row;
  }

  async approveExtension(extensionId: string, dto: DecideExtensionDto, user: AuthenticatedUser) {
    return this.decideExtension(extensionId, 'approved', dto, user);
  }

  async rejectExtension(extensionId: string, dto: DecideExtensionDto, user: AuthenticatedUser) {
    return this.decideExtension(extensionId, 'rejected', dto, user);
  }

  /** H1: same-day overtime request. */
  async requestOvertime(permitId: string, dto: RequestOvertimeDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active']);
    const [org] = await this.loadOrgMdp(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    const now = new Date();
    const requestedUntil = new Date(dto.requestedUntil);
    const bound = validateOvertimeRequestedUntil({
      requestedUntil,
      now,
      timezone: multiDay.timezone,
      operationalDayCutoff: multiDay.operationalDayCutoff,
    });
    if (!bound.ok) {
      throw new BadRequestException(
        bound.reason === 'wrong_day'
          ? `Overtime must end on today's operational date (${bound.expectedOperationalDate}); got ${bound.requestedOperationalDate}`
          : 'Overtime requestedUntil must be after now',
      );
    }

    const [existing] = await this.db
      .select({ id: permitOvertimeRequests.id })
      .from(permitOvertimeRequests)
      .where(
        and(
          eq(permitOvertimeRequests.tenantId, tenantId),
          eq(permitOvertimeRequests.permitId, permitId),
          eq(permitOvertimeRequests.operationalDate, bound.operationalDate),
          eq(permitOvertimeRequests.status, 'pending'),
        ),
      )
      .limit(1);
    if (existing) {
      throw new ConflictException('A pending overtime request already exists for today');
    }

    const [row] = await this.db
      .insert(permitOvertimeRequests)
      .values({
        tenantId,
        permitId,
        operationalDate: bound.operationalDate,
        requestedUntil,
        justification: dto.justification,
        status: 'pending',
        requestedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.appendHistory(tenantId, permitId, 'overtime_requested', actorId, {
      overtimeId: row.id,
      operationalDate: bound.operationalDate,
    });
    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.overtimeRequested,
      entityType: 'permit_overtime_request',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId, operationalDate: bound.operationalDate },
    });
    await this.canonicalNotifications
      .fromMdpTimeRequest({
        tenantId,
        permitId,
        actorId,
        kind: 'overtime',
        phase: 'requested',
        requestId: row.id,
      })
      .catch(() => undefined);

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return row;
  }

  async listOvertime(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requirePermit(permitId, tenantId, ['active', 'suspended', 'closed', 'approved']);
    return this.db
      .select()
      .from(permitOvertimeRequests)
      .where(
        and(
          eq(permitOvertimeRequests.tenantId, tenantId),
          eq(permitOvertimeRequests.permitId, permitId),
        ),
      )
      .orderBy(desc(permitOvertimeRequests.requestedAt));
  }

  async approveOvertime(overtimeId: string, dto: DecideOvertimeDto, user: AuthenticatedUser) {
    return this.decideOvertime(overtimeId, 'approved', dto, user);
  }

  async rejectOvertime(overtimeId: string, dto: DecideOvertimeDto, user: AuthenticatedUser) {
    return this.decideOvertime(overtimeId, 'rejected', dto, user);
  }

  /** H7: pending overtime + extension inbox for approvers. */
  async listPendingTimeRequests(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const [extensions, overtime] = await Promise.all([
      this.db
        .select()
        .from(permitExtensions)
        .where(and(eq(permitExtensions.tenantId, tenantId), eq(permitExtensions.status, 'pending')))
        .orderBy(desc(permitExtensions.requestedAt)),
      this.db
        .select()
        .from(permitOvertimeRequests)
        .where(
          and(
            eq(permitOvertimeRequests.tenantId, tenantId),
            eq(permitOvertimeRequests.status, 'pending'),
          ),
        )
        .orderBy(desc(permitOvertimeRequests.requestedAt)),
    ]);
    return { extensions, overtime };
  }

  async listHistory(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requirePermit(permitId, tenantId, ['active', 'suspended', 'closed', 'approved']);

    return this.db
      .select()
      .from(revalidationHistory)
      .where(
        and(eq(revalidationHistory.tenantId, tenantId), eq(revalidationHistory.permitId, permitId)),
      )
      .orderBy(desc(revalidationHistory.createdAt));
  }

  private async decideOvertime(
    overtimeId: string,
    status: 'approved' | 'rejected',
    dto: DecideOvertimeDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const [row] = await this.db
      .select()
      .from(permitOvertimeRequests)
      .where(
        and(eq(permitOvertimeRequests.id, overtimeId), eq(permitOvertimeRequests.tenantId, tenantId)),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Overtime request not found');
    }
    if (row.status !== 'pending') {
      throw new ConflictException('Overtime request has already been decided');
    }

    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, row.permitId), eq(permits.tenantId, tenantId)))
      .limit(1);
    if (!permit) {
      throw new NotFoundException('Permit not found');
    }
    const [org] = await this.loadOrgMdp(tenantId);
    const settings = resolveMultiDayTenantSettings(org ?? null);
    const authorityIds = await areaAuthorityIds(this.db, tenantId, permit.workLocationId);
    if (
      !actorMayApproveOvertime({
        actorRoles: user.roles,
        actorId,
        setting: settings.overtimeApproverRole,
        areaAuthorityUserIds: authorityIds,
      })
    ) {
      throw new ForbiddenException(
        `Overtime approval requires role routed by tenant setting (${settings.overtimeApproverRole})`,
      );
    }

    const now = new Date();
    const [updated] = await this.db
      .update(permitOvertimeRequests)
      .set({
        status,
        decidedBy: actorId,
        decidedAt: now,
        decisionComments: dto.comments ?? null,
        updatedBy: actorId,
      })
      .where(eq(permitOvertimeRequests.id, overtimeId))
      .returning();

    const eventType = status === 'approved' ? 'overtime_approved' : 'overtime_rejected';
    const auditAction =
      status === 'approved'
        ? MDP_AUDIT_ACTIONS.overtimeApproved
        : MDP_AUDIT_ACTIONS.overtimeRejected;
    await this.appendHistory(tenantId, row.permitId, eventType, actorId, { overtimeId });
    await this.auditService.log({
      action: auditAction,
      entityType: 'permit_overtime_request',
      entityId: overtimeId,
      userId: actorId,
      tenantId,
      metadata: { permitId: row.permitId, status },
    });
    await this.canonicalNotifications
      .fromMdpTimeRequest({
        tenantId,
        permitId: row.permitId,
        actorId,
        kind: 'overtime',
        phase: status,
        requestId: overtimeId,
        recipientUserIds: [row.requestedBy],
      })
      .catch(() => undefined);

    await this.cacheService.invalidatePermit(tenantId, row.permitId);
    return {
      ...updated,
      /** Approved overtime authorises work until requestedUntil on the same operational day. */
      allowsWorkUntil: status === 'approved' ? updated.requestedUntil : null,
    };
  }

  private async decideExtension(
    extensionId: string,
    status: 'approved' | 'rejected',
    dto: DecideExtensionDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);

    const [extension] = await this.db
      .select()
      .from(permitExtensions)
      .where(and(eq(permitExtensions.id, extensionId), eq(permitExtensions.tenantId, tenantId)))
      .limit(1);

    if (!extension) {
      throw new NotFoundException('Extension request not found');
    }
    if (extension.status !== 'pending') {
      throw new ConflictException('Extension request has already been decided');
    }

    const now = new Date();
    const [updated] = await this.db
      .update(permitExtensions)
      .set({
        status,
        decidedBy: actorId,
        decidedAt: now,
        decisionComments: dto.comments ?? null,
        updatedBy: actorId,
      })
      .where(eq(permitExtensions.id, extensionId))
      .returning();

    let simops: unknown = null;
    if (status === 'approved') {
      // H3: duration extension updates plannedEndAt.
      await this.db
        .update(permits)
        .set({ plannedEndAt: extension.requestedEndAt, updatedBy: actorId })
        .where(and(eq(permits.id, extension.permitId), eq(permits.tenantId, tenantId)));

      // H4: re-run SIMOPS for the new window (FR-SIM-013).
      if (this.simopsService) {
        simops = await this.simopsService
          .analyse({ ...user, tenantId } as AuthenticatedUser, extension.permitId)
          .catch((err: unknown) => ({
            error: err instanceof Error ? err.message : 'SIMOPS analyse failed',
          }));
      }
    }

    const eventType = status === 'approved' ? 'extension_approved' : 'extension_rejected';
    const auditAction =
      status === 'approved'
        ? MDP_AUDIT_ACTIONS.extensionApproved
        : MDP_AUDIT_ACTIONS.extensionRejected;
    await this.appendHistory(tenantId, extension.permitId, eventType, actorId, {
      extensionId,
      simopsTriggered: status === 'approved',
    });

    await this.auditService.log({
      action: auditAction,
      entityType: 'permit_extension',
      entityId: extensionId,
      userId: actorId,
      tenantId,
    });

    await this.canonicalNotifications
      .fromMdpTimeRequest({
        tenantId,
        permitId: extension.permitId,
        actorId,
        kind: 'extension',
        phase: status,
        requestId: extensionId,
        recipientUserIds: [extension.requestedBy],
      })
      .catch(() => undefined);

    await this.cacheService.invalidatePermit(tenantId, extension.permitId);
    return { ...updated, simops };
  }

  private async suspendInternal(
    permit: typeof permits.$inferSelect,
    actorId: string,
    reason: string,
    source: MdpSuspensionSource,
  ) {
    if (permit.status === 'suspended') {
      throw new ConflictException('Permit is already suspended');
    }

    const [row] = await this.db
      .insert(permitSuspensions)
      .values({
        tenantId: permit.tenantId,
        permitId: permit.id,
        reason,
        suspendedBy: actorId,
        source,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db
      .update(permits)
      .set({ status: 'suspended', updatedBy: actorId })
      .where(and(eq(permits.id, permit.id), eq(permits.tenantId, permit.tenantId)));

    await this.appendHistory(permit.tenantId, permit.id, 'permit_suspended', actorId, {
      suspensionId: row.id,
      source,
    });

    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.permitSuspended,
      entityType: 'permit_suspension',
      entityId: row.id,
      userId: actorId,
      tenantId: permit.tenantId,
      metadata: { permitId: permit.id, source },
    });

    this.logService.logEvent({
      action: MDP_AUDIT_ACTIONS.permitSuspended,
      permitId: permit.id,
      tenantId: permit.tenantId,
      userId: actorId,
      metadata: { source },
    });

    await this.cacheService.invalidatePermit(permit.tenantId, permit.id);
    return row;
  }

  /** C2/C7/C10: resume MDP-eligible open suspensions and set permit active. */
  private async clearForWorkToday(
    permit: typeof permits.$inferSelect,
    actorId: string,
    _revalidationId: string,
  ): Promise<{ status: string; resumedSuspensionId?: string }> {
    const [openSuspension] = await this.db
      .select()
      .from(permitSuspensions)
      .where(
        and(
          eq(permitSuspensions.tenantId, permit.tenantId),
          eq(permitSuspensions.permitId, permit.id),
          isNull(permitSuspensions.resumedAt),
        ),
      )
      .orderBy(desc(permitSuspensions.suspendedAt))
      .limit(1);

    let resumedSuspensionId: string | undefined;

    if (openSuspension) {
      if (
        !canClearSuspensionViaMdpReopen({
          source: openSuspension.source,
          reason: openSuspension.reason,
        })
      ) {
        throw new ConflictException(
          openSuspension.source === 'simops' || openSuspension.reason.startsWith('SIMOPS')
            ? 'SIMOPS-rejection suspension cannot be cleared via MDP reopen'
            : 'This suspension source cannot be cleared via MDP reopen',
        );
      }

      await this.db
        .update(permitSuspensions)
        .set({ resumedAt: new Date(), resumedBy: actorId, updatedBy: actorId })
        .where(eq(permitSuspensions.id, openSuspension.id));
      resumedSuspensionId = openSuspension.id;
    }

    if (permit.status === 'suspended') {
      await this.db
        .update(permits)
        .set({ status: 'active', updatedBy: actorId })
        .where(and(eq(permits.id, permit.id), eq(permits.tenantId, permit.tenantId)));
    }

    return { status: 'active', resumedSuspensionId };
  }

  /** C9/C10 guards before recording reopen. */
  private async assertCanReopen(
    permitId: string,
    tenantId: string,
    permit: typeof permits.$inferSelect,
  ): Promise<void> {
    if (permit.status === 'cancelled') {
      throw new ConflictException('Cancelled permits cannot be reopened');
    }

    await this.daySecureService.assertNoOutstandingLateSecure(permitId, tenantId);

    const [openSuspension] = await this.db
      .select()
      .from(permitSuspensions)
      .where(
        and(
          eq(permitSuspensions.tenantId, tenantId),
          eq(permitSuspensions.permitId, permitId),
          isNull(permitSuspensions.resumedAt),
        ),
      )
      .orderBy(desc(permitSuspensions.suspendedAt))
      .limit(1);

    if (
      openSuspension &&
      !canClearSuspensionViaMdpReopen({
        source: openSuspension.source,
        reason: openSuspension.reason,
      })
    ) {
      throw new ConflictException(
        'Open SIMOPS/incident suspension blocks MDP reopen; resolve that hold first',
      );
    }

    const blocking = await this.db
      .select({ id: incidents.id, status: incidents.status })
      .from(incidentPermits)
      .innerJoin(incidents, eq(incidentPermits.incidentId, incidents.id))
      .where(
        and(
          eq(incidentPermits.permitId, permitId),
          eq(incidents.tenantId, tenantId),
          inArray(incidents.status, [
            'open',
            'pending_hod_decision',
            'investigating',
            'pending_verification',
          ]),
        ),
      )
      .limit(1);

    if (blocking.length > 0) {
      throw new ConflictException(
        'Linked open incident blocks MDP reopen until the incident is closed or unlinked',
      );
    }
  }

  private async loadReopenCompositionContext(
    permit: typeof permits.$inferSelect,
    tenantId: string,
  ) {
    const gasTestingRequired = Boolean(permit.gasTestingRequired);
    const gasRows = gasTestingRequired
      ? await this.db
          .select({
            gasTestingCatalogueId: permitGasTesting.gasTestingCatalogueId,
            parameter: permitGasTesting.parameter,
            minimum: permitGasTesting.minimum,
            maximum: permitGasTesting.maximum,
            unit: permitGasTesting.unit,
            removedReason: permitGasTesting.removedReason,
          })
          .from(permitGasTesting)
          .where(eq(permitGasTesting.permitId, permit.id))
      : [];

    const gasItems = gasRows
      .filter(
        (row) =>
          !row.removedReason &&
          row.gasTestingCatalogueId &&
          typeof row.minimum === 'number' &&
          typeof row.maximum === 'number',
      )
      .map((row) => ({
        gasTestingCatalogueId: row.gasTestingCatalogueId as string,
        parameter: row.parameter || 'Gas',
        minimum: row.minimum as number,
        maximum: row.maximum as number,
        unit: row.unit || '',
      }));

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
      );

    let openIsolationCount = linked.length;
    if (permit.lototoRequired) {
      const crewLocks = await this.db
        .select({ id: lockboxCrewLocks.id })
        .from(lockboxCrewLocks)
        .where(and(eq(lockboxCrewLocks.permitId, permit.id), isNull(lockboxCrewLocks.removedAt)));
      openIsolationCount += crewLocks.length;
    }
    const openIsolationsRemain = openIsolationCount > 0;

    const openSimops = await this.db
      .select({ id: simopsCases.id })
      .from(simopsCasePermits)
      .innerJoin(simopsCases, eq(simopsCasePermits.caseId, simopsCases.id))
      .where(
        and(
          eq(simopsCasePermits.permitId, permit.id),
          eq(simopsCasePermits.tenantId, tenantId),
          eq(simopsCases.status, 'review_required'),
        ),
      );

    const [ppeRows, hazardRows] = await Promise.all([
      this.db
        .select({ ppeCatalogueId: permitPpe.ppeCatalogueId })
        .from(permitPpe)
        .where(eq(permitPpe.permitId, permit.id)),
      this.db
        .select({
          hazardCategoryId: permitHazards.hazardCategoryId,
        })
        .from(permitHazards)
        .where(eq(permitHazards.permitId, permit.id)),
    ]);

    const requiredPpeIds = ppeRows.map((row) => row.ppeCatalogueId);
    const requiredHazardKeys = hazardRows
      .map((row) => row.hazardCategoryId)
      .filter((id): id is string => Boolean(id))
      .map((id) => hazardControlKey(id));

    return {
      gasTestingRequired,
      gasItems,
      openIsolationsRemain,
      openIsolationCount,
      unresolvedSimopsCount: openSimops.length,
      requiredPpeIds,
      requiredHazardKeys,
    };
  }

  private async loadOrgMdp(tenantId: string) {
    return this.db
      .select({
        timezone: organisations.timezone,
        maxMultiDayValidityDays: organisations.maxMultiDayValidityDays,
        operationalDayCutoff: organisations.operationalDayCutoff,
        overtimeApproverRole: organisations.overtimeApproverRole,
        dailyToolboxTalkRequired: organisations.dailyToolboxTalkRequired,
        dailyCrewRosterRequired: organisations.dailyCrewRosterRequired,
        dailyPpeHazardReconfirm: organisations.dailyPpeHazardReconfirm,
        hardMdpCustodyEnforced: organisations.hardMdpCustodyEnforced,
      })
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId))
      .limit(1);
  }

  private async appendHistory(
    tenantId: string,
    permitId: string,
    eventType: string,
    actorId: string,
    payload?: Record<string, unknown>,
  ) {
    await this.db.insert(revalidationHistory).values({
      tenantId,
      permitId,
      eventType: eventType as never,
      actorId,
      payload: payload ?? null,
      createdBy: actorId,
    });
  }

  private async requirePermit(
    permitId: string,
    tenantId: string,
    allowedStatuses: string[],
  ): Promise<typeof permits.$inferSelect> {
    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)))
      .limit(1);

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }
    if (!allowedStatuses.includes(permit.status)) {
      throw new ConflictException(`Permit status '${permit.status}' is not valid for this action`);
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
