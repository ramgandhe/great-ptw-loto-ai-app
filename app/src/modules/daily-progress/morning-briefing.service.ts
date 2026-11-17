import {
  BadRequestException,
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
  organisations,
  permitDailyCrew,
  permitExecutors,
  permitToolboxTalks,
  permits,
  shiftHandovers,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { MDP_AUDIT_ACTIONS } from '../revalidation/mdp-audit-events';
import { buildMultiDaySummary } from '../revalidation/multi-day-summary';
import { operationalDateKey } from '../revalidation/permit-validity.service';
import { DailyProgressCacheService } from './daily-progress-cache.service';
import { DailyProgressLogService } from './daily-progress-log.service';
import { canMutateUnderCustody, resolveActiveCustodyHolder } from './mdp-custody';
import { resolveMorningBriefingPolicy } from './morning-briefing';
import { RecordToolboxTalkDto, ReplaceDailyCrewDto } from './dto/morning-briefing.dto';

const WRITABLE = new Set(['active']);
const READABLE = new Set(['active', 'suspended']);

@Injectable()
export class MorningBriefingService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly cacheService: DailyProgressCacheService,
    private readonly logService: DailyProgressLogService,
  ) {}

  async getToolboxTalk(
    permitId: string,
    operationalDate: string | undefined,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    await this.requirePermit(permitId, tenantId, 'read');
    const day = await this.resolveOperationalDate(tenantId, operationalDate);
    const [row] = await this.db
      .select()
      .from(permitToolboxTalks)
      .where(
        and(
          eq(permitToolboxTalks.tenantId, tenantId),
          eq(permitToolboxTalks.permitId, permitId),
          eq(permitToolboxTalks.operationalDate, day),
        ),
      )
      .limit(1);
    return { operationalDate: day, talk: row ?? null };
  }

  async recordToolboxTalk(
    permitId: string,
    dto: RecordToolboxTalkDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    await this.requirePermit(permitId, tenantId, 'write');
    await this.assertCustody(permitId, tenantId, user);

    const day = dto.operationalDate.slice(0, 10);
    const attendees = [...new Set(dto.attendeeUserIds ?? [])];

    const [existing] = await this.db
      .select({ id: permitToolboxTalks.id })
      .from(permitToolboxTalks)
      .where(
        and(
          eq(permitToolboxTalks.tenantId, tenantId),
          eq(permitToolboxTalks.permitId, permitId),
          eq(permitToolboxTalks.operationalDate, day),
        ),
      )
      .limit(1);

    let row: typeof permitToolboxTalks.$inferSelect;
    if (existing) {
      const [updated] = await this.db
        .update(permitToolboxTalks)
        .set({
          topic: dto.topic.trim(),
          attendeeUserIds: attendees,
          notes: dto.notes?.trim() ?? '',
          conductedBy: actorId,
          conductedAt: new Date(),
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(permitToolboxTalks.id, existing.id))
        .returning();
      row = updated;
    } else {
      const [created] = await this.db
        .insert(permitToolboxTalks)
        .values({
          tenantId,
          permitId,
          operationalDate: day,
          topic: dto.topic.trim(),
          conductedBy: actorId,
          attendeeUserIds: attendees,
          notes: dto.notes?.trim() ?? '',
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
      row = created;
    }

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType: 'toolbox_talk_recorded',
      actorId,
      payload: { operationalDate: day, talkId: row.id, attendeeCount: attendees.length },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.toolboxTalkRecorded,
      entityType: 'permit_toolbox_talk',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId, operationalDate: day },
    });

    this.logService.logEvent({
      action: MDP_AUDIT_ACTIONS.toolboxTalkRecorded,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { operationalDate: day },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return row;
  }

  async listDailyCrew(
    permitId: string,
    operationalDate: string | undefined,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const permit = await this.requirePermit(permitId, tenantId, 'read');
    const day = await this.resolveOperationalDate(tenantId, operationalDate);
    const members = await this.db
      .select()
      .from(permitDailyCrew)
      .where(
        and(
          eq(permitDailyCrew.tenantId, tenantId),
          eq(permitDailyCrew.permitId, permit.id),
          eq(permitDailyCrew.operationalDate, day),
        ),
      )
      .orderBy(desc(permitDailyCrew.createdAt));

    const executors = await this.db
      .select({
        workforceUserId: permitExecutors.workforceUserId,
        isPrimary: permitExecutors.isPrimary,
      })
      .from(permitExecutors)
      .where(eq(permitExecutors.permitId, permit.id));

    return {
      operationalDate: day,
      members,
      suggestedFromExecutors: executors.map((row) => ({
        workforceUserId: row.workforceUserId,
        role: row.isPrimary ? ('primary' as const) : ('substitute' as const),
      })),
    };
  }

  async replaceDailyCrew(permitId: string, dto: ReplaceDailyCrewDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    await this.requirePermit(permitId, tenantId, 'write');
    await this.assertCustody(permitId, tenantId, user);

    const day = dto.operationalDate.slice(0, 10);
    const seen = new Set<string>();
    for (const member of dto.members) {
      if (seen.has(member.workforceUserId)) {
        throw new BadRequestException('Duplicate workforce user on today’s crew roster');
      }
      seen.add(member.workforceUserId);
      if (member.role === 'substitute' && member.substituteForUserId === member.workforceUserId) {
        throw new BadRequestException('Substitute cannot replace themselves');
      }
    }

    await this.db
      .delete(permitDailyCrew)
      .where(
        and(
          eq(permitDailyCrew.tenantId, tenantId),
          eq(permitDailyCrew.permitId, permitId),
          eq(permitDailyCrew.operationalDate, day),
        ),
      );

    if (dto.members.length > 0) {
      await this.db.insert(permitDailyCrew).values(
        dto.members.map((member) => ({
          tenantId,
          permitId,
          operationalDate: day,
          workforceUserId: member.workforceUserId,
          role: member.role,
          substituteForUserId: member.substituteForUserId ?? null,
          notes: member.notes?.trim() ?? '',
          createdBy: actorId,
          updatedBy: actorId,
        })),
      );
    }

    const members = await this.db
      .select()
      .from(permitDailyCrew)
      .where(
        and(
          eq(permitDailyCrew.tenantId, tenantId),
          eq(permitDailyCrew.permitId, permitId),
          eq(permitDailyCrew.operationalDate, day),
        ),
      );

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType: 'daily_crew_updated',
      actorId,
      payload: { operationalDate: day, memberCount: members.length },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.dailyCrewUpdated,
      entityType: 'permit_daily_crew',
      entityId: permitId,
      userId: actorId,
      tenantId,
      metadata: { permitId, operationalDate: day, memberCount: members.length },
    });

    this.logService.logEvent({
      action: MDP_AUDIT_ACTIONS.dailyCrewUpdated,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { operationalDate: day, memberCount: members.length },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return { operationalDate: day, members };
  }

  async loadBriefingSnapshot(permitId: string, tenantId: string, operationalDate: string) {
    const [[talk], crew, [org]] = await Promise.all([
      this.db
        .select()
        .from(permitToolboxTalks)
        .where(
          and(
            eq(permitToolboxTalks.tenantId, tenantId),
            eq(permitToolboxTalks.permitId, permitId),
            eq(permitToolboxTalks.operationalDate, operationalDate),
          ),
        )
        .limit(1),
      this.db
        .select()
        .from(permitDailyCrew)
        .where(
          and(
            eq(permitDailyCrew.tenantId, tenantId),
            eq(permitDailyCrew.permitId, permitId),
            eq(permitDailyCrew.operationalDate, operationalDate),
          ),
        ),
      this.db
        .select({
          dailyToolboxTalkRequired: organisations.dailyToolboxTalkRequired,
          dailyCrewRosterRequired: organisations.dailyCrewRosterRequired,
          dailyPpeHazardReconfirm: organisations.dailyPpeHazardReconfirm,
          hardMdpCustodyEnforced: organisations.hardMdpCustodyEnforced,
          timezone: organisations.timezone,
          maxMultiDayValidityDays: organisations.maxMultiDayValidityDays,
          operationalDayCutoff: organisations.operationalDayCutoff,
        })
        .from(organisations)
        .where(eq(organisations.tenantId, tenantId))
        .limit(1),
    ]);

    const policy = resolveMorningBriefingPolicy(org ?? null);
    return {
      talk: talk ?? null,
      crew,
      policy,
      hardMdpCustodyEnforced: org?.hardMdpCustodyEnforced !== false,
    };
  }

  async assertCustody(permitId: string, tenantId: string, user: AuthenticatedUser) {
    const [org] = await this.db
      .select({ hardMdpCustodyEnforced: organisations.hardMdpCustodyEnforced })
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId))
      .limit(1);

    if (org?.hardMdpCustodyEnforced === false) {
      return;
    }

    const handovers = await this.db
      .select({
        status: shiftHandovers.status,
        outgoingUserId: shiftHandovers.outgoingUserId,
        incomingUserId: shiftHandovers.incomingUserId,
        handedOverAt: shiftHandovers.handedOverAt,
      })
      .from(shiftHandovers)
      .where(and(eq(shiftHandovers.tenantId, tenantId), eq(shiftHandovers.permitId, permitId)))
      .orderBy(desc(shiftHandovers.handedOverAt))
      .limit(20);

    const custodyHeldBy = resolveActiveCustodyHolder(handovers);
    const actorId = requireActorId(user);
    if (
      !canMutateUnderCustody({
        actorId,
        roles: user.roles,
        custodyHeldBy,
        hardCustodyEnforced: true,
      })
    ) {
      throw new ForbiddenException(
        'Only the current custody holder (or a supervisor) may perform this multi-day action',
      );
    }
  }

  private async resolveOperationalDate(tenantId: string, requested?: string) {
    if (requested?.trim()) {
      return requested.slice(0, 10);
    }
    const [org] = await this.db
      .select({ timezone: organisations.timezone })
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId))
      .limit(1);
    return operationalDateKey(new Date(), org?.timezone?.trim() || 'UTC');
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
    const allowed = mode === 'write' ? WRITABLE : READABLE;
    if (!allowed.has(permit.status)) {
      throw new ConflictException(
        mode === 'write'
          ? 'Morning briefing can only be recorded for active permits'
          : 'Permit is not available for morning briefing viewing',
      );
    }
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
      throw new BadRequestException('Morning briefing applies only to multi-day permits');
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
