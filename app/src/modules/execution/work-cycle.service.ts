import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  isolationCertificatePermits,
  isolationCertificatePoints,
  isolationCertificates,
  lockboxCrewLocks,
  organisations,
  permitExecution,
  permitExecutors,
  permitStatusHistory,
  permitWorkPauses,
  permitWorkResumes,
  shiftHandovers,
  type OvernightIsolationPolicy,
  type WorkState,
} from '../../database/schema';
import { OVERNIGHT_OPEN_ISOLATION_STATUSES } from '../daily-progress/day-secure-countersign';
import { isDailyCrewRequiredForClear } from '../daily-progress/morning-briefing';
import { normalizeHandoverStatus } from '../daily-progress/shift-handover';
import { MorningBriefingService } from '../daily-progress/morning-briefing.service';
import { DaySecureService } from '../daily-progress/day-secure.service';
import { DailyProgressService } from '../daily-progress/daily-progress.service';
import { AuditService } from '../logging/audit.service';
import { PermitCacheService } from '../permit/permit-cache.service';
import { PermitLototoExecutionService } from '../permit/permit-lototo-execution.service';
import { PermitService } from '../permit/permit.service';
import { evaluateReopenComposition } from '../revalidation/multi-day-reopen-composition';
import { isPastOperationalCutoff } from '../revalidation/multi-day-classification';
import { buildMultiDaySummary } from '../revalidation/multi-day-summary';
import { operationalDateKey } from '../revalidation/permit-validity.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { ACTIVE_STATUS } from './execution.constants';
import { PauseWorkDto } from './dto/work-pause.dto';
import { ResumeWorkDto } from './dto/work-resume.dto';
import { ExecutionCacheService } from './execution-cache.service';
import { ExecutionLogService } from './execution-log.service';
import {
  assertLototoRemovalsKnown,
  decidePauseLototoOutcome,
  type LototoOvernightItem,
} from './work-pause-lototo';
import {
  buildWorkPauseChecklistTemplate,
  missingWorkPauseChecklistKeys,
} from './work-pause-checklist';
import {
  buildWorkResumeChecklistTemplate,
  missingWorkResumeChecklistKeys,
} from './work-resume-checklist';
import {
  assertWorkStateTransition,
  canCompleteWork,
  canPauseWork,
  canRecordProgress,
  canResumeWork,
  resolveWorkUiState,
} from './work-state';

@Injectable()
export class WorkCycleService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly lototoExecutionService: PermitLototoExecutionService,
    private readonly morningBriefingService: MorningBriefingService,
    private readonly daySecureService: DaySecureService,
    private readonly dailyProgressService: DailyProgressService,
    private readonly moduleRef: ModuleRef,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
    private readonly executionCacheService: ExecutionCacheService,
    private readonly executionLogService: ExecutionLogService,
  ) {}

  private getRevalidationService(): RevalidationService {
    return this.moduleRef.get(RevalidationService, { strict: false });
  }

  async getWorkCycle(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;
    const execution = await this.findExecution(permitId);
    const [org] = await this.loadOrg(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    const dailyRevalidationRequired = multiDay.dailyRevalidationRequired !== false;
    const overnightPolicy = this.resolveOvernightPolicy(org?.overnightIsolationPolicy);

    const openPause = execution?.workState === 'paused'
      ? await this.findOpenPause(execution.id)
      : null;

    const uiState = resolveWorkUiState({
      permitStatus: permit.status,
      hasExecution: Boolean(execution),
      workState: execution?.workState,
      suspendedAt: execution?.suspendedAt,
    });

    const lototoRequired = Boolean(permit.lototoRequired);
    const liveIsolated = lototoRequired
      ? await this.isLototoReadyToResume(permitId, user)
      : true;
    const reisolateRequired =
      openPause?.reisolateRequiredOnResume === true || (lototoRequired && !liveIsolated);
    const lototoOvernightItems = lototoRequired
      ? await this.listLototoOvernightItems(permitId, tenantId)
      : [];
    const history = execution ? await this.listWorkHistory(execution.id) : [];
    const resumeExtras = await this.loadResumeCompositionExtras(permitId, user, dailyRevalidationRequired);
    const missingPriorSecureDates = await this.daySecureService.listMissingPriorSecureDates(
      permitId,
      tenantId,
    );
    const lateSecureRequired = missingPriorSecureDates.length > 0 && uiState === 'in_progress';
    const pastCutoff = uiState === 'in_progress' && this.isPastSameDayCutoff(multiDay);
    const today = operationalDateKey(new Date(), multiDay.timezone || 'UTC');
    const pauseDate = openPause ? String(openPause.operationalDate).slice(0, 10) : '';
    const newDayResume = Boolean(multiDay.isMultiDay && pauseDate && pauseDate < today);
    const crewRoster = newDayResume
      ? await this.crewRosterPrompt(permitId, today, multiDay.isMultiDay, dailyRevalidationRequired, org, user)
      : { required: false, suggested: [] as Array<{ workforceUserId: string; role: 'primary' | 'substitute' }> };
    const handoverRequired = Boolean(openPause && openPause.pausedBy !== user.id);
    const handoverAccepted = openPause
      ? await this.hasAcceptedHandoverForResume(
          permitId,
          tenantId,
          openPause.pausedBy,
          openPause.pausedAt,
          user.id,
        )
      : true;

    return {
      workUiState: uiState,
      workState: (execution?.workState as WorkState | null) ?? null,
      workPausedAt: execution?.workPausedAt ?? null,
      workPausedBy: execution?.workPausedBy ?? null,
      workResumedAt: execution?.workResumedAt ?? null,
      workResumedBy: execution?.workResumedBy ?? null,
      canPause: canPauseWork(uiState),
      canResume: canResumeWork(uiState) && !lateSecureRequired && handoverAccepted,
      canComplete: canCompleteWork(uiState) && !lateSecureRequired && !pastCutoff,
      canRecordProgress: canRecordProgress(uiState) && !lateSecureRequired && !pastCutoff,
      missingPriorSecureDates,
      pastCutoff,
      crewRosterRequired: crewRoster.required,
      suggestedCrew: crewRoster.suggested,
      handoverRequired,
      handoverAccepted,
      overnightIsolationPolicy: overnightPolicy,
      dailyRevalidationRequired,
      lototoRequired,
      lototoOvernightItems,
      history,
      openPause: openPause
        ? {
            id: openPause.id,
            summary: openPause.summary,
            pausedAt: openPause.pausedAt,
            operationalDate: openPause.operationalDate,
            reisolateRequiredOnResume: openPause.reisolateRequiredOnResume,
            overnightRestoreChosen: openPause.overnightRestoreChosen,
            lototoRemovals: openPause.lototoRemovals,
          }
        : null,
      pauseTemplate: buildWorkPauseChecklistTemplate(dailyRevalidationRequired),
      resumeTemplate: buildWorkResumeChecklistTemplate({
        dailyRevalidationRequired,
        lototoRequired,
        reisolateRequired,
        ...resumeExtras,
      }),
      execution: execution
        ? {
            id: execution.id,
            workState: execution.workState,
            workPausedAt: execution.workPausedAt,
            workResumedAt: execution.workResumedAt,
            suspendedAt: execution.suspendedAt,
            actualStartAt: execution.actualStartAt,
          }
        : null,
    };
  }

  async pauseWork(permitId: string, dto: PauseWorkDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== ACTIVE_STATUS) {
      throw new ConflictException('Only active permits can pause work');
    }

    await this.requireExecutor(permitId, user);
    await this.morningBriefingService.assertCustody(permitId, tenantId, user);

    const execution = await this.requireExecution(permitId);
    if (execution.suspendedAt) {
      throw new ConflictException('Cannot pause work while the permit is suspended');
    }

    const fromState = (execution.workState as WorkState) || 'in_progress';
    const transition = assertWorkStateTransition(fromState, 'paused');
    if (!transition.ok) {
      throw new ConflictException(transition.reason);
    }

    const [org] = await this.loadOrg(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    const dailyRevalidationRequired = multiDay.dailyRevalidationRequired !== false;
    const overnightPolicy = this.resolveOvernightPolicy(org?.overnightIsolationPolicy);

    const checklist = {
      ...dto.checklist,
      personnelCleared: dto.checklist.personnelCleared,
    } as Record<string, unknown>;

    const missing = missingWorkPauseChecklistKeys(
      dailyRevalidationRequired,
      checklist,
      dto.checklist.personnelCleared,
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Incomplete pause checklist; missing: ${missing.join(', ')}`,
      );
    }

    const missingPriorDates = await this.daySecureService.listMissingPriorSecureDates(
      permitId,
      tenantId,
    );
    if (missingPriorDates.length > 0) {
      const lateReason = dto.lateReason?.trim() ?? '';
      if (lateReason.length < 3) {
        throw new BadRequestException(
          `Late secure requires a reason for ${missingPriorDates.join(', ')}`,
        );
      }
      for (const operationalDate of missingPriorDates) {
        await this.daySecureService.recordSecureFromOvernightPause(permitId, user, {
          operationalDate,
          summary: dto.summary.trim(),
          checklist,
          late: true,
          lateReason,
        });
      }
    }

    const lototoRemovals = [...new Set(dto.lototoRemovals ?? [])];
    const overnightItems = permit.lototoRequired
      ? await this.listLototoOvernightItems(permitId, tenantId)
      : [];
    const unknownRemovals = assertLototoRemovalsKnown(
      lototoRemovals,
      overnightItems.map((item) => item.id),
    );
    if (unknownRemovals) {
      throw new BadRequestException(unknownRemovals);
    }

    const lototoOutcome = decidePauseLototoOutcome({
      overnightIsolationPolicy: overnightPolicy,
      overnightRestoreChosen: dto.overnightRestoreChosen === true,
      lototoRemovals,
    });
    if (lototoOutcome.rejected) {
      throw new BadRequestException(lototoOutcome.rejected);
    }
    const overnightRestoreChosen = lototoOutcome.overnightRestoreChosen;
    const reisolateRequiredOnResume = lototoOutcome.reisolateRequiredOnResume;

    const lototoSnapshot =
      dto.lototoSnapshot ??
      (await this.buildLototoSnapshot(
        permitId,
        tenantId,
        Boolean(permit.lototoRequired),
        overnightItems,
      ));

    const pausedAt = new Date();
    const operationalDate = operationalDateKey(pausedAt, multiDay.timezone || 'UTC');
    await this.dailyProgressService.noteFromWork(permitId, user, {
      text: dto.summary.trim(),
      kind: 'pause',
    });

    const result = await this.db.transaction(async (tx) => {
      const [pause] = await tx
        .insert(permitWorkPauses)
        .values({
          tenantId,
          permitId,
          executionId: execution.id,
          summary: dto.summary.trim(),
          operationalDate,
          checklist: {
            ...checklist,
            mode: dailyRevalidationRequired ? 'full' : 'light',
          },
          notes: (dto.notes ?? '').trim(),
          lototoSnapshot,
          lototoRemovals,
          overnightRestoreChosen,
          reisolateRequiredOnResume,
          pausedBy: user.id,
          pausedAt,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      const [updated] = await tx
        .update(permitExecution)
        .set({
          workState: 'paused',
          workPausedAt: pausedAt,
          workPausedBy: user.id,
          updatedBy: user.id,
        })
        .where(eq(permitExecution.id, execution.id))
        .returning();

      await tx.insert(permitStatusHistory).values({
        permitId,
        executionId: execution.id,
        action: 'work_paused',
        fromStatus: ACTIVE_STATUS,
        toStatus: ACTIVE_STATUS,
        actorId: user.id,
        comment: dto.summary.trim(),
        metadata: {
          pauseId: pause.id,
          overnightRestoreChosen,
          reisolateRequiredOnResume,
          lototoRemovals,
        },
        createdBy: user.id,
      });

      return { pause, execution: updated };
    });

    await this.auditService.log({
      action: 'permit.work_paused',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
      metadata: { pauseId: result.pause.id, executionId: execution.id },
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.executionCacheService.invalidatePermit(tenantId, permitId);

    this.executionLogService.logEvent({
      action: 'execution.work_paused',
      permitId,
      tenantId,
      userId: user.id,
      metadata: { pauseId: result.pause.id },
    });

    return {
      pause: result.pause,
      execution: result.execution,
      permit: { ...permit, status: ACTIVE_STATUS },
      workUiState: 'paused' as const,
    };
  }

  async resumeWork(permitId: string, dto: ResumeWorkDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== ACTIVE_STATUS) {
      throw new ConflictException('Only active permits can resume work');
    }

    await this.requireExecutor(permitId, user);
    await this.morningBriefingService.assertCustody(permitId, tenantId, user);

    const execution = await this.requireExecution(permitId);
    if (execution.suspendedAt) {
      throw new ConflictException('Cannot resume work while the permit is suspended — use suspension resume');
    }

    if (execution.workState !== 'paused') {
      const missingPriorDates = await this.daySecureService.listMissingPriorSecureDates(
        permitId,
        tenantId,
      );
      if (missingPriorDates.length > 0) {
        throw new ConflictException(
          `Pause work to record a late secure for ${missingPriorDates.join(', ')} before resuming.`,
        );
      }
    }

    const fromState = (execution.workState as WorkState) || 'in_progress';
    const transition = assertWorkStateTransition(fromState, 'in_progress');
    if (!transition.ok) {
      throw new ConflictException(transition.reason);
    }

    const openPause = await this.findOpenPause(execution.id);
    if (!openPause) {
      throw new ConflictException('No open pause record found to resume from');
    }

    const handoverAccepted = await this.hasAcceptedHandoverForResume(
      permitId,
      tenantId,
      openPause.pausedBy,
      openPause.pausedAt,
      user.id,
    );
    if (!handoverAccepted) {
      throw new ConflictException(
        'Another person can resume only after an accepted handover from the person who paused.',
      );
    }

    const [org] = await this.loadOrg(tenantId);
    const multiDay = buildMultiDaySummary(permit, org ?? null);
    const dailyRevalidationRequired = multiDay.dailyRevalidationRequired !== false;
    const lototoRequired = Boolean(permit.lototoRequired);
    const liveIsolated = lototoRequired
      ? await this.isLototoReadyToResume(permitId, user)
      : true;
    const reisolateRequired =
      openPause.reisolateRequiredOnResume === true || (lototoRequired && !liveIsolated);

    if (reisolateRequired && lototoRequired) {
      if (dto.checklist.lototoReisolated !== true) {
        throw new BadRequestException(
          'Full LOTOTO re-isolation is required before resume (isolations not ready or were touched overnight)',
        );
      }
      await this.lototoExecutionService.assertIsolationReadyToStart(permitId, user);
    }

    const resumeExtras = await this.loadResumeCompositionExtras(
      permitId,
      user,
      dailyRevalidationRequired,
    );
    const template = buildWorkResumeChecklistTemplate({
      dailyRevalidationRequired,
      lototoRequired,
      reisolateRequired,
      ...resumeExtras,
    });
    const missing = missingWorkResumeChecklistKeys(template, dto.checklist);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Incomplete resume checklist; missing: ${missing.join(', ')}`,
      );
    }

    if (dailyRevalidationRequired) {
      await this.assertAuditOnResumeComposition(permitId, user, dto.checklist);
    }

    const today = operationalDateKey(new Date(), multiDay.timezone || 'UTC');
    const pauseDate = String(openPause.operationalDate).slice(0, 10);
    if (multiDay.isMultiDay && pauseDate < today) {
      await this.daySecureService.recordSecureFromOvernightPause(permitId, user, {
        operationalDate: pauseDate,
        summary: openPause.summary,
        checklist: (openPause.checklist ?? {}) as Record<string, unknown>,
      });
      await this.getRevalidationService().recordPassedReopenFromWorkResume(permitId, user, {
        checklist: dto.checklist,
        findings: (dto.notes ?? '').trim(),
      });
      if (dto.checklist.toolboxTalkConfirmed === true) {
        await this.recordToolboxTalkForNewDay(permitId, today, dto.notes, user);
      }
      await this.saveNewDayCrew(permitId, today, multiDay.isMultiDay, dailyRevalidationRequired, org, dto, user);
    }

    const resumedAt = new Date();

    const result = await this.db.transaction(async (tx) => {
      const [resume] = await tx
        .insert(permitWorkResumes)
        .values({
          tenantId,
          permitId,
          executionId: execution.id,
          pauseId: openPause.id,
          checklist: {
            ...dto.checklist,
            mode: template.mode,
          },
          notes: (dto.notes ?? '').trim(),
          resumedBy: user.id,
          resumedAt,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      const [updated] = await tx
        .update(permitExecution)
        .set({
          workState: 'in_progress',
          workResumedAt: resumedAt,
          workResumedBy: user.id,
          updatedBy: user.id,
        })
        .where(eq(permitExecution.id, execution.id))
        .returning();

      await tx.insert(permitStatusHistory).values({
        permitId,
        executionId: execution.id,
        action: 'work_resumed',
        fromStatus: ACTIVE_STATUS,
        toStatus: ACTIVE_STATUS,
        actorId: user.id,
        comment: (dto.notes ?? '').trim() || null,
        metadata: {
          pauseId: openPause.id,
          resumeId: resume.id,
          reisolateRequired,
        },
        createdBy: user.id,
      });

      return { resume, execution: updated };
    });

    await this.auditService.log({
      action: 'permit.work_resumed',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
      metadata: { resumeId: result.resume.id, pauseId: openPause.id },
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.executionCacheService.invalidatePermit(tenantId, permitId);

    this.executionLogService.logEvent({
      action: 'execution.work_resumed',
      permitId,
      tenantId,
      userId: user.id,
      metadata: { resumeId: result.resume.id },
    });

    return {
      resume: result.resume,
      pause: openPause,
      execution: result.execution,
      permit: { ...permit, status: ACTIVE_STATUS },
      workUiState: 'in_progress' as const,
    };
  }

  /** Gate used by Progress / Evidence / Complete. */
  async assertInProgressWork(permitId: string, actionLabel: string): Promise<void> {
    const execution = await this.findExecution(permitId);
    if (!execution) {
      throw new NotFoundException('Permit execution record not found');
    }
    if (execution.suspendedAt) {
      throw new ConflictException(`Cannot ${actionLabel} while the permit is suspended`);
    }
    if (execution.workState === 'paused') {
      throw new ConflictException(
        `Cannot ${actionLabel} while work is paused — resume work first`,
      );
    }
  }

  /** Custody + in-progress gate for Progress / Evidence / Complete writers. */
  async assertWorkWrite(
    permitId: string,
    user: AuthenticatedUser,
    actionLabel: string,
  ): Promise<void> {
    const tenantId = this.requireTenant(user);
    await this.morningBriefingService.assertCustody(permitId, tenantId, user);
    await this.assertInProgressWork(permitId, actionLabel);
    const missingPriorDates = await this.daySecureService.listMissingPriorSecureDates(
      permitId,
      tenantId,
    );
    if (missingPriorDates.length > 0) {
      throw new ConflictException(
        `Pause work to record a late secure for ${missingPriorDates.join(', ')} before you ${actionLabel}.`,
      );
    }
    const detail = await this.permitService.findOne(permitId, user);
    const [org] = await this.loadOrg(tenantId);
    const multiDay = buildMultiDaySummary(detail.permit, org ?? null);
    if (this.isPastSameDayCutoff(multiDay)) {
      throw new ConflictException(
        `The operational day cut-off (${multiDay.operationalDayCutoff}) has passed. Pause and leave the area safe before you ${actionLabel}.`,
      );
    }
  }

  /** Same person who paused can resume. Anyone else needs an accepted handover from that person after the pause. */
  private async hasAcceptedHandoverForResume(
    permitId: string,
    tenantId: string,
    pausedBy: string,
    pausedAt: Date,
    resumingUserId: string,
  ): Promise<boolean> {
    if (resumingUserId === pausedBy) {
      return true;
    }
    const rows = await this.db
      .select({
        status: shiftHandovers.status,
        acceptedAt: shiftHandovers.acceptedAt,
        handedOverAt: shiftHandovers.handedOverAt,
      })
      .from(shiftHandovers)
      .where(
        and(
          eq(shiftHandovers.tenantId, tenantId),
          eq(shiftHandovers.permitId, permitId),
          eq(shiftHandovers.outgoingUserId, pausedBy),
          eq(shiftHandovers.incomingUserId, resumingUserId),
        ),
      );
    const pausedMs = pausedAt.getTime();
    return rows.some((row) => {
      if (normalizeHandoverStatus(row.status) !== 'accepted') {
        return false;
      }
      const at = row.acceptedAt ?? row.handedOverAt;
      return at.getTime() >= pausedMs;
    });
  }

  /** Ask for a roster only when this resume opens a new day, policy requires crew, and today has none. */
  private async crewRosterPrompt(
    permitId: string,
    operationalDate: string,
    isMultiDay: boolean,
    dailyRevalidationRequired: boolean,
    org: { dailyCrewRosterRequired?: boolean | null } | null | undefined,
    user: AuthenticatedUser,
  ): Promise<{
    required: boolean;
    suggested: Array<{ workforceUserId: string; role: 'primary' | 'substitute' }>;
  }> {
    const required = isDailyCrewRequiredForClear({
      isMultiDay,
      dailyRevalidationRequired,
      dailyCrewRosterRequired: org?.dailyCrewRosterRequired !== false,
    });
    if (!required) {
      return { required: false, suggested: [] };
    }
    const existing = await this.morningBriefingService.listDailyCrew(permitId, operationalDate, user);
    if (existing.members.length > 0) {
      return { required: false, suggested: [] };
    }
    return { required: true, suggested: existing.suggestedFromExecutors };
  }

  /** Save today's roster on the first resume of a new day. An existing roster is left as it is. */
  private async saveNewDayCrew(
    permitId: string,
    operationalDate: string,
    isMultiDay: boolean,
    dailyRevalidationRequired: boolean,
    org: { dailyCrewRosterRequired?: boolean | null } | null | undefined,
    dto: ResumeWorkDto,
    user: AuthenticatedUser,
  ): Promise<void> {
    const prompt = await this.crewRosterPrompt(
      permitId,
      operationalDate,
      isMultiDay,
      dailyRevalidationRequired,
      org,
      user,
    );
    if (!prompt.required) {
      return;
    }
    const members = dto.crew ?? [];
    if (members.length < 1) {
      throw new BadRequestException(
        'Record today’s crew roster (at least one worker) before resuming.',
      );
    }
    await this.morningBriefingService.replaceDailyCrew(
      permitId,
      { operationalDate, members },
      user,
    );
  }

  /** One toolbox-talk row for today. A row already stored for this date is left as it is. */
  private async recordToolboxTalkForNewDay(
    permitId: string,
    operationalDate: string,
    notes: string | undefined,
    user: AuthenticatedUser,
  ): Promise<void> {
    const existing = await this.morningBriefingService.getToolboxTalk(
      permitId,
      operationalDate,
      user,
    );
    if (existing.talk) {
      return;
    }
    await this.morningBriefingService.recordToolboxTalk(
      permitId,
      {
        operationalDate,
        topic: 'Toolbox talk completed for this resume',
        attendeeUserIds: [user.id],
        notes: (notes ?? '').trim() || undefined,
      },
      user,
    );
  }

  /** Multi-day, still today, local time at or after the organisation cut-off. */
  private isPastSameDayCutoff(multiDay: {
    isMultiDay: boolean;
    timezone: string;
    operationalDayCutoff: string;
  }): boolean {
    if (!multiDay.isMultiDay) {
      return false;
    }
    return isPastOperationalCutoff(
      new Date(),
      multiDay.timezone || 'UTC',
      multiDay.operationalDayCutoff,
    );
  }

  private async isLototoReadyToResume(
    permitId: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    try {
      await this.lototoExecutionService.assertIsolationReadyToStart(permitId, user);
      return true;
    } catch {
      return false;
    }
  }

  private async loadResumeCompositionExtras(
    permitId: string,
    user: AuthenticatedUser,
    dailyRevalidationRequired: boolean,
  ): Promise<{
    ppeHazardReconfirmRequired?: boolean;
    gasTestingRequired?: boolean;
    simopsBlocked?: boolean;
    simopsBlockReason?: string;
  }> {
    if (!dailyRevalidationRequired) {
      return {};
    }
    try {
      const composition = await this.getRevalidationService().getReopenComposition(permitId, user);
      const simops = composition.modules.find((mod) => mod.key === 'simops');
      const ppe = composition.modules.find((mod) => mod.key === 'ppe_hazard');
      const gas = composition.modules.find((mod) => mod.key === 'gas');
      return {
        ppeHazardReconfirmRequired: Boolean(ppe?.required),
        gasTestingRequired: Boolean(gas?.required),
        simopsBlocked: Boolean(simops?.required),
        simopsBlockReason: simops?.reason,
      };
    } catch {
      // Fail closed: do not silently omit SIMOPS / PPE / gas from the resume template.
      return {
        simopsBlocked: true,
        simopsBlockReason:
          'Unable to load reopen composition for resume — resolve SIMOPS/PPE/gas status and retry',
      };
    }
  }

  private async assertAuditOnResumeComposition(
    permitId: string,
    user: AuthenticatedUser,
    checklist: Record<string, unknown>,
  ): Promise<void> {
    const composition = await this.getRevalidationService().getReopenComposition(permitId, user);
    // The tick is required on every resume. The first resume of a new day writes the talk row after this check.
    // Daily crew is saved on that same resume when the org requires it, not by this composition gate.
    const evaluated = evaluateReopenComposition({
      dailyRevalidationRequired: true,
      gasTestingRequired: composition.modules.some((m) => m.key === 'gas'),
      openIsolationsRemain: composition.openIsolationsRemain,
      unresolvedSimopsCount: composition.modules.some((m) => m.key === 'simops') ? 1 : 0,
      gasItems: composition.gasItems,
      openIsolationCount: composition.openIsolationCount,
      toolboxTalkRequired: false,
      crewRosterRequired: false,
      ppeHazardReconfirmRequired: composition.modules.some((m) => m.key === 'ppe_hazard'),
      talkRecorded: composition.toolboxTalkRecorded,
      crewCount: composition.crewCount,
      requiredHazardKeys: composition.requiredHazardKeys,
      requiredPpeIds: composition.requiredPpeIds,
      checklist: {
        ...checklist,
        lototoIntegrityConfirmed:
          checklist.lototoIntegrityConfirmed === true || checklist.lototoReisolated === true,
        ppeHazardReconfirmedToday: checklist.ppeHazardReconfirmed === true,
        confirmedHazardKeys:
          checklist.ppeHazardReconfirmed === true ? composition.requiredHazardKeys : [],
        confirmedPpeIds:
          checklist.ppeHazardReconfirmed === true ? composition.requiredPpeIds : [],
      },
    });

    // Work resume: site security + LOTOTO + SIMOPS + PPE; gas ack only (readings on Start/reopen).
    const blocking = evaluated.modules.filter((mod) => {
      if (!mod.required || mod.satisfied) {
        return false;
      }
      if (mod.key === 'gas' && checklist.gasConfirmedToday === true) {
        return false;
      }
      return (
        mod.key === 'site_security' ||
        mod.key === 'gas' ||
        mod.key === 'lototo' ||
        mod.key === 'simops' ||
        mod.key === 'ppe_hazard'
      );
    });
    if (blocking.length > 0) {
      const missing = blocking.flatMap((mod) => mod.blockers);
      throw new BadRequestException(
        `Resume blocked by reopen composition: ${missing.join('; ')}`,
      );
    }
  }

  private async listLototoOvernightItems(
    permitId: string,
    tenantId: string,
  ): Promise<LototoOvernightItem[]> {
    const locks = await this.db
      .select({
        id: lockboxCrewLocks.id,
        workerName: lockboxCrewLocks.workerName,
        personalLockNumber: lockboxCrewLocks.personalLockNumber,
      })
      .from(lockboxCrewLocks)
      .where(and(eq(lockboxCrewLocks.permitId, permitId), isNull(lockboxCrewLocks.removedAt)));

    const items: LototoOvernightItem[] = locks.map((lock) => ({
      id: lock.id,
      kind: 'crew_lock' as const,
      label: `${lock.workerName} — lock ${lock.personalLockNumber}`,
    }));

    const points = await this.db
      .select({
        id: isolationCertificatePoints.id,
        pointCode: isolationCertificatePoints.pointCode,
        energyType: isolationCertificatePoints.energyType,
        locationText: isolationCertificatePoints.locationText,
        certificateNumber: isolationCertificates.certificateNumber,
      })
      .from(isolationCertificatePermits)
      .innerJoin(
        isolationCertificates,
        eq(isolationCertificatePermits.certificateId, isolationCertificates.id),
      )
      .innerJoin(
        isolationCertificatePoints,
        eq(isolationCertificatePoints.certificateId, isolationCertificates.id),
      )
      .where(
        and(
          eq(isolationCertificatePermits.permitId, permitId),
          eq(isolationCertificatePermits.tenantId, tenantId),
          ne(isolationCertificatePermits.attachmentStatus, 'detached'),
          inArray(isolationCertificates.status, [...OVERNIGHT_OPEN_ISOLATION_STATUSES]),
          isNull(isolationCertificatePoints.restoredAt),
        ),
      );

    for (const point of points) {
      const where = point.locationText?.trim() ? ` @ ${point.locationText.trim()}` : '';
      items.push({
        id: point.id,
        kind: 'isolation_point',
        label: `${point.certificateNumber} ${point.pointCode} (${point.energyType})${where}`,
      });
    }

    return items;
  }

  private async listWorkHistory(executionId: string) {
    const pauses = await this.db
      .select({
        id: permitWorkPauses.id,
        summary: permitWorkPauses.summary,
        pausedAt: permitWorkPauses.pausedAt,
        pausedBy: permitWorkPauses.pausedBy,
        reisolateRequiredOnResume: permitWorkPauses.reisolateRequiredOnResume,
      })
      .from(permitWorkPauses)
      .where(eq(permitWorkPauses.executionId, executionId))
      .orderBy(desc(permitWorkPauses.pausedAt))
      .limit(20);

    const resumes = await this.db
      .select({
        id: permitWorkResumes.id,
        pauseId: permitWorkResumes.pauseId,
        resumedAt: permitWorkResumes.resumedAt,
        resumedBy: permitWorkResumes.resumedBy,
      })
      .from(permitWorkResumes)
      .where(eq(permitWorkResumes.executionId, executionId))
      .orderBy(desc(permitWorkResumes.resumedAt))
      .limit(20);

    const events: Array<{
      id: string;
      kind: 'paused' | 'resumed';
      at: Date;
      by: string;
      summary?: string;
      pauseId?: string;
      reisolateRequiredOnResume?: boolean;
    }> = [
      ...pauses.map((row) => ({
        id: row.id,
        kind: 'paused' as const,
        at: row.pausedAt,
        by: row.pausedBy,
        summary: row.summary,
        reisolateRequiredOnResume: row.reisolateRequiredOnResume,
      })),
      ...resumes.map((row) => ({
        id: row.id,
        kind: 'resumed' as const,
        at: row.resumedAt,
        by: row.resumedBy,
        pauseId: row.pauseId,
      })),
    ];

    return events
      .filter((event) => event.at instanceof Date && !Number.isNaN(event.at.getTime()))
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((event) => ({
        id: event.id,
        kind: event.kind,
        at: event.at.toISOString(),
        by: event.by,
        summary: event.summary,
        pauseId: event.pauseId,
        reisolateRequiredOnResume: event.reisolateRequiredOnResume,
      }));
  }

  private async buildLototoSnapshot(
    permitId: string,
    tenantId: string,
    lototoRequired: boolean,
    overnightItems?: LototoOvernightItem[],
  ): Promise<Record<string, unknown>> {
    if (!lototoRequired) {
      return { lototoRequired: false, items: [] };
    }

    const items = overnightItems ?? (await this.listLototoOvernightItems(permitId, tenantId));

    return {
      lototoRequired: true,
      capturedAt: new Date().toISOString(),
      items,
      openCrewLockCount: items.filter((item) => item.kind === 'crew_lock').length,
      openIsolationPointCount: items.filter((item) => item.kind === 'isolation_point').length,
    };
  }

  private async findOpenPause(executionId: string) {
    const pauses = await this.db
      .select()
      .from(permitWorkPauses)
      .where(eq(permitWorkPauses.executionId, executionId))
      .orderBy(desc(permitWorkPauses.pausedAt))
      .limit(1);

    const latest = pauses[0];
    if (!latest) {
      return null;
    }

    const [resume] = await this.db
      .select({ id: permitWorkResumes.id })
      .from(permitWorkResumes)
      .where(eq(permitWorkResumes.pauseId, latest.id))
      .limit(1);

    return resume ? null : latest;
  }

  private async findExecution(permitId: string) {
    const [execution] = await this.db
      .select()
      .from(permitExecution)
      .where(eq(permitExecution.permitId, permitId));
    return execution ?? null;
  }

  private async requireExecution(permitId: string) {
    const execution = await this.findExecution(permitId);
    if (!execution) {
      throw new NotFoundException('Permit execution record not found');
    }
    return execution;
  }

  private resolveOvernightPolicy(
    value: string | null | undefined,
  ): OvernightIsolationPolicy {
    return value === 'restore_allowed' ? 'restore_allowed' : 'hold';
  }

  private async loadOrg(tenantId: string) {
    return this.db
      .select()
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId))
      .limit(1);
  }

  private async requireExecutor(permitId: string, user: AuthenticatedUser) {
    if (user.roles.includes('platform-admin') || isTenantPrivileged(user.roles)) {
      return;
    }

    const [executor] = await this.db
      .select()
      .from(permitExecutors)
      .where(
        and(eq(permitExecutors.permitId, permitId), eq(permitExecutors.workforceUserId, user.id)),
      );

    if (!executor) {
      throw new ForbiddenException('You are not assigned as an executor for this permit');
    }
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
