import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  organisations,
  permitDailyCrew,
  permitDaySecures,
  permitExtensions,
  permitMdpOverrides,
  permitOvertimeRequests,
  permitRevalidations,
  permits,
  permitToolboxTalks,
  revalidationHistory,
  safetyChecklistItems,
  safetyChecklists,
} from '../../database/schema';
import { DaySecureService } from '../daily-progress/day-secure.service';
import {
  isDailyCrewRequiredForClear,
  isToolboxTalkRequiredForClear,
  resolveMorningBriefingPolicy,
} from '../daily-progress/morning-briefing';
import { MDP_CHECKLIST_SEEDS } from './mdp-checklist-library';
import { resolveMultiDayTenantSettings } from './multi-day-settings';
import {
  classifyMaxValidity,
  classifyPermitValidity,
  operationalDateKey,
  PERMIT_RENEWAL_THRESHOLD_MS,
} from './permit-validity.service';
import { REVALIDATION_READ_ROLES } from './revalidation.constants';

export type MorningQueueBucket =
  | 'late_secure_required'
  | 'reopen_due'
  | 'secure_due'
  | 'tbt_due'
  | 'crew_due'
  | 'overtime_pending'
  | 'extension_pending'
  | 'validity_ending';

export type MorningQueueItem = {
  permitId: string;
  reference: string | null;
  title: string;
  status: string;
  bucket: MorningQueueBucket;
  operationalDate: string | null;
  href: string;
  detail?: string;
};

@Injectable()
export class MdpOpsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly daySecureService: DaySecureService,
  ) {}

  /** J1: morning operational queues for the tenant. */
  async getMorningQueue(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    this.assertRead(user);

    const [org] = await this.db
      .select({
        timezone: organisations.timezone,
        maxMultiDayValidityDays: organisations.maxMultiDayValidityDays,
        operationalDayCutoff: organisations.operationalDayCutoff,
        dailyToolboxTalkRequired: organisations.dailyToolboxTalkRequired,
        dailyCrewRosterRequired: organisations.dailyCrewRosterRequired,
      })
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId))
      .limit(1);

    const settings = resolveMultiDayTenantSettings(org ?? null);
    const briefingPolicy = resolveMorningBriefingPolicy(org ?? null);
    const timezone = org?.timezone?.trim() || 'UTC';
    const now = new Date();
    const operationalDate = operationalDateKey(now, timezone);

    const active = await this.db
      .select({
        id: permits.id,
        reference: permits.reference,
        title: permits.title,
        status: permits.status,
        plannedStartAt: permits.plannedStartAt,
        plannedEndAt: permits.plannedEndAt,
        dailyRevalidationRequired: permits.dailyRevalidationRequired,
        emergencyOverrideAllowed: permits.emergencyOverrideAllowed,
        submittedBy: permits.submittedBy,
      })
      .from(permits)
      .where(
        and(eq(permits.tenantId, tenantId), inArray(permits.status, ['active', 'suspended'])),
      );

    const lateSecure: MorningQueueItem[] = [];
    const reopenDue: MorningQueueItem[] = [];
    const secureDue: MorningQueueItem[] = [];
    const tbtDue: MorningQueueItem[] = [];
    const crewDue: MorningQueueItem[] = [];
    const validityEnding: MorningQueueItem[] = [];

    const cycles = await this.daySecureService.resolveDayCyclesBatch(active, tenantId);
    const multiDayIds = active
      .filter((permit) => cycles.get(permit.id)?.isMultiDay)
      .map((permit) => permit.id);

    const [talksToday, crewToday] =
      multiDayIds.length === 0
        ? [[], []]
        : await Promise.all([
            this.db
              .select({ permitId: permitToolboxTalks.permitId })
              .from(permitToolboxTalks)
              .where(
                and(
                  eq(permitToolboxTalks.tenantId, tenantId),
                  inArray(permitToolboxTalks.permitId, multiDayIds),
                  eq(permitToolboxTalks.operationalDate, operationalDate),
                ),
              ),
            this.db
              .select({ permitId: permitDailyCrew.permitId })
              .from(permitDailyCrew)
              .where(
                and(
                  eq(permitDailyCrew.tenantId, tenantId),
                  inArray(permitDailyCrew.permitId, multiDayIds),
                  eq(permitDailyCrew.operationalDate, operationalDate),
                ),
              ),
          ]);
    const talkByPermit = new Set(talksToday.map((row) => row.permitId));
    const crewByPermit = new Set(crewToday.map((row) => row.permitId));

    for (const permit of active) {
      const cycle = cycles.get(permit.id);
      if (!cycle) {
        continue;
      }

      if (cycle.isMultiDay) {
        const base = {
          permitId: permit.id,
          reference: permit.reference,
          title: permit.title,
          status: permit.status,
          operationalDate: cycle.currentOperationalDate,
          href: `/permits/${permit.id}?tab=work`,
        };

        if (cycle.dayCycleState === 'late_secure_required') {
          lateSecure.push({
            ...base,
            bucket: 'late_secure_required',
            detail: `Missing prior secure: ${(cycle.missingPriorSecureDates ?? []).join(', ')}`,
            href: base.href,
          });
        } else if (cycle.dayCycleState === 'reopen_due') {
          reopenDue.push({
            ...base,
            bucket: 'reopen_due',
            href: base.href,
          });
        } else if (cycle.dayCycleState === 'secure_due') {
          secureDue.push({
            ...base,
            bucket: 'secure_due',
            href: base.href,
          });
        }

        const auditOn = permit.dailyRevalidationRequired !== false;
        if (
          isToolboxTalkRequiredForClear({
            isMultiDay: true,
            dailyRevalidationRequired: auditOn,
            dailyToolboxTalkRequired: briefingPolicy.dailyToolboxTalkRequired,
          }) &&
          !talkByPermit.has(permit.id) &&
          (cycle.dayCycleState === 'reopen_due' || cycle.dayCycleState === 'cleared')
        ) {
          tbtDue.push({
            ...base,
            bucket: 'tbt_due',
            href: base.href,
            detail: 'Toolbox talk not recorded for today',
          });
        }
        if (
          isDailyCrewRequiredForClear({
            isMultiDay: true,
            dailyRevalidationRequired: auditOn,
            dailyCrewRosterRequired: briefingPolicy.dailyCrewRosterRequired,
          }) &&
          !crewByPermit.has(permit.id) &&
          (cycle.dayCycleState === 'reopen_due' || cycle.dayCycleState === 'cleared')
        ) {
          crewDue.push({
            ...base,
            bucket: 'crew_due',
            href: base.href,
            detail: 'Daily crew roster empty for today',
          });
        }
      }

      const validity = classifyPermitValidity(permit.plannedEndAt, now);
      const maxState = classifyMaxValidity({
        plannedStartAt: permit.plannedStartAt,
        plannedEndAt: permit.plannedEndAt,
        now,
        timezone,
        maxMultiDayValidityDays: settings.maxMultiDayValidityDays,
      });

      if (validity === 'renewal_due' || maxState === 'max_validity_due') {
        validityEnding.push({
          permitId: permit.id,
          reference: permit.reference,
          title: permit.title,
          status: permit.status,
          bucket: 'validity_ending',
          operationalDate,
          href: `/permits/${permit.id}?tab=work`,
          detail:
            maxState === 'max_validity_due'
              ? `Tenant max ${settings.maxMultiDayValidityDays} days — renew`
              : `Less than ${PERMIT_RENEWAL_THRESHOLD_MS / 3_600_000}h remain`,
        });
      }
    }

    const [extensions, overtime] = await Promise.all([
      this.db
        .select({
          id: permitExtensions.id,
          permitId: permitExtensions.permitId,
          requestedEndAt: permitExtensions.requestedEndAt,
          requestedAt: permitExtensions.requestedAt,
        })
        .from(permitExtensions)
        .where(
          and(eq(permitExtensions.tenantId, tenantId), eq(permitExtensions.status, 'pending')),
        )
        .orderBy(desc(permitExtensions.requestedAt)),
      this.db
        .select({
          id: permitOvertimeRequests.id,
          permitId: permitOvertimeRequests.permitId,
          requestedUntil: permitOvertimeRequests.requestedUntil,
          operationalDate: permitOvertimeRequests.operationalDate,
          requestedAt: permitOvertimeRequests.requestedAt,
        })
        .from(permitOvertimeRequests)
        .where(
          and(
            eq(permitOvertimeRequests.tenantId, tenantId),
            eq(permitOvertimeRequests.status, 'pending'),
          ),
        )
        .orderBy(desc(permitOvertimeRequests.requestedAt)),
    ]);

    const permitIds = [
      ...new Set([...extensions.map((e) => e.permitId), ...overtime.map((o) => o.permitId)]),
    ];
    const permitMeta =
      permitIds.length === 0
        ? []
        : await this.db
            .select({
              id: permits.id,
              reference: permits.reference,
              title: permits.title,
              status: permits.status,
            })
            .from(permits)
            .where(and(eq(permits.tenantId, tenantId), inArray(permits.id, permitIds)));
    const metaById = new Map(permitMeta.map((p) => [p.id, p]));

    const extensionPending: MorningQueueItem[] = extensions.map((row) => {
      const meta = metaById.get(row.permitId);
      return {
        permitId: row.permitId,
        reference: meta?.reference ?? null,
        title: meta?.title ?? 'Permit',
        status: meta?.status ?? 'active',
        bucket: 'extension_pending' as const,
        operationalDate,
        href: `/permits/${row.permitId}?tab=work`,
        detail: `Extension to ${row.requestedEndAt.toISOString()}`,
      };
    });

    const overtimePending: MorningQueueItem[] = overtime.map((row) => {
      const meta = metaById.get(row.permitId);
      return {
        permitId: row.permitId,
        reference: meta?.reference ?? null,
        title: meta?.title ?? 'Permit',
        status: meta?.status ?? 'active',
        bucket: 'overtime_pending' as const,
        operationalDate: row.operationalDate,
        href: `/permits/${row.permitId}?tab=work`,
        detail: `Overtime until ${row.requestedUntil.toISOString()}`,
      };
    });

    return {
      operationalDate,
      timezone,
      cutoff: settings.operationalDayCutoff,
      maxMultiDayValidityDays: settings.maxMultiDayValidityDays,
      buckets: {
        late_secure_required: lateSecure,
        reopen_due: reopenDue,
        secure_due: secureDue,
        tbt_due: tbtDue,
        crew_due: crewDue,
        overtime_pending: overtimePending,
        extension_pending: extensionPending,
        validity_ending: validityEnding,
      },
      counts: {
        late_secure_required: lateSecure.length,
        reopen_due: reopenDue.length,
        secure_due: secureDue.length,
        tbt_due: tbtDue.length,
        crew_due: crewDue.length,
        overtime_pending: overtimePending.length,
        extension_pending: extensionPending.length,
        validity_ending: validityEnding.length,
      },
    };
  }

  /** J2: expose + seed default MDP checklist library into safety_checklists. */
  async getChecklistLibrary(user: AuthenticatedUser, seed = true) {
    const tenantId = this.requireTenant(user);
    this.assertRead(user);

    if (seed) {
      await this.seedChecklistLibrary(tenantId, user.id);
    }

    const codes = MDP_CHECKLIST_SEEDS.map((s) => s.code);
    const checklists = await this.db
      .select()
      .from(safetyChecklists)
      .where(
        and(
          eq(safetyChecklists.tenantId, tenantId),
          inArray(safetyChecklists.code, codes),
        ),
      );

    const result = [];
    for (const checklist of checklists) {
      const items = await this.db
        .select()
        .from(safetyChecklistItems)
        .where(eq(safetyChecklistItems.checklistId, checklist.id))
        .orderBy(asc(safetyChecklistItems.sequence));
      result.push({ checklist, items });
    }

    return {
      seeds: MDP_CHECKLIST_SEEDS,
      tenantChecklists: result,
    };
  }

  async seedChecklistLibrary(tenantId: string, actorId: string) {
    for (const seed of MDP_CHECKLIST_SEEDS) {
      const [existing] = await this.db
        .select({ id: safetyChecklists.id })
        .from(safetyChecklists)
        .where(
          and(eq(safetyChecklists.tenantId, tenantId), eq(safetyChecklists.code, seed.code)),
        )
        .limit(1);

      if (existing) {
        continue;
      }

      await this.db.transaction(async (tx) => {
        const [checklist] = await tx
          .insert(safetyChecklists)
          .values({
            tenantId,
            code: seed.code,
            name: seed.name,
            description: seed.description,
            status: 'published',
            isActive: true,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();

        if (seed.items.length > 0) {
          await tx.insert(safetyChecklistItems).values(
            seed.items.map((item, index) => ({
              checklistId: checklist.id,
              sequence: index + 1,
              description: item.description,
              isMandatory: item.isMandatory,
              createdBy: actorId,
            })),
          );
        }
      });
    }
  }

  /** J6: simple MDP operational KPIs for the tenant. */
  async getAnalyticsKpis(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    this.assertRead(user);

    const [org] = await this.db
      .select({ timezone: organisations.timezone })
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId))
      .limit(1);
    const timezone = org?.timezone?.trim() || 'UTC';
    const operationalDate = operationalDateKey(new Date(), timezone);

    const activeMultiDay = await this.getMorningQueue(user);

    const [overrideCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(permitMdpOverrides)
      .where(eq(permitMdpOverrides.tenantId, tenantId));

    const [lateSecureCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(permitDaySecures)
      .where(
        and(eq(permitDaySecures.tenantId, tenantId), eq(permitDaySecures.late, true)),
      );

    const [clearedToday] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(permitRevalidations)
      .where(
        and(
          eq(permitRevalidations.tenantId, tenantId),
          eq(permitRevalidations.operationalDate, operationalDate),
          eq(permitRevalidations.outcome, 'passed'),
        ),
      );

    const [extensionsApproved] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(permitExtensions)
      .where(
        and(eq(permitExtensions.tenantId, tenantId), eq(permitExtensions.status, 'approved')),
      );

    const [renewalsInitiated] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(revalidationHistory)
      .where(
        and(
          eq(revalidationHistory.tenantId, tenantId),
          eq(revalidationHistory.eventType, 'renewal_initiated'),
        ),
      );

    const reopenDue = activeMultiDay.counts.reopen_due;
    const cleared = clearedToday?.count ?? 0;
    const reopenDenom = cleared + reopenDue;

    return {
      operationalDate,
      timezone,
      kpis: {
        clearedBeforeWorkToday: cleared,
        reopenDueToday: reopenDue,
        clearedShareToday: reopenDenom === 0 ? null : cleared / reopenDenom,
        lateSecureTotal: lateSecureCount?.count ?? 0,
        lateSecureOutstandingToday: activeMultiDay.counts.late_secure_required,
        overrideTotal: overrideCount?.count ?? 0,
        extensionsApproved: extensionsApproved?.count ?? 0,
        renewalsInitiated: renewalsInitiated?.count ?? 0,
        overtimePending: activeMultiDay.counts.overtime_pending,
        validityEnding: activeMultiDay.counts.validity_ending,
      },
      queueCounts: activeMultiDay.counts,
    };
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }

  private assertRead(user: AuthenticatedUser): void {
    if (!user.roles.some((role) => (REVALIDATION_READ_ROLES as readonly string[]).includes(role))) {
      throw new ForbiddenException('Insufficient permissions for MDP ops');
    }
  }
}
