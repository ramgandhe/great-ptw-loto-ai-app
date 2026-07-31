import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { requireTenant } from '../../common/helpers/tenant-context';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  conflictAssessments,
  conflictHistory,
  conflictParticipants,
  conflictResolutions,
  mitigationPlans,
  simopsConflicts,
  type SimopsHistoryAction,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  ApproveConflictDto,
  AssessConflictDto,
  MitigationPlanDto,
  RejectConflictDto,
} from './dto/resolution.dto';
import { SIMOPS_DEFAULT_ESCALATION_TIMEOUT_HOURS } from './simops.constants';
import { SimopsCacheService } from './simops-cache.service';
import { SimopsJobsService } from './simops-jobs.service';
import { SimopsLogService } from './simops-log.service';

const OPEN_STATUSES = ['detected', 'pending_assessment'] as const;
const SIMOPS_SYSTEM_ACTOR = '00000000-0000-4000-8000-000000000171';

@Injectable()
export class ConflictResolutionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cacheService: SimopsCacheService,
    @Inject(forwardRef(() => SimopsJobsService))
    private readonly jobsService: SimopsJobsService,
    private readonly logService: SimopsLogService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async assess(conflictId: string, dto: AssessConflictDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const conflict = await this.requireOpenConflict(conflictId, tenantId);

    const [assessment] = await this.db
      .insert(conflictAssessments)
      .values({
        tenantId,
        conflictId: conflict.id,
        assessedSeverity: dto.assessedSeverity,
        riskSummary: dto.riskSummary,
        findings: dto.findings,
        assessedBy: user.id,
        status: dto.status ?? 'completed',
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.db
      .update(simopsConflicts)
      .set({
        status: 'pending_assessment',
        severity: dto.assessedSeverity,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(simopsConflicts.id, conflict.id));

    await this.appendHistory({
      tenantId,
      conflictId: conflict.id,
      action: 'assessed',
      entityType: 'conflict_assessment',
      entityId: assessment.id,
      actorId: user.id,
      metadata: { assessedSeverity: dto.assessedSeverity },
    });

    await this.cacheService.invalidateConflict(tenantId, conflict.id);
    await this.notifyResolution(
      tenantId,
      conflict.id,
      user.id,
      `SIMOPS conflict assessed (${dto.assessedSeverity})`,
    );

    await this.auditService.log({
      action: 'simops.conflict.assessed',
      entityType: 'conflict_assessment',
      entityId: assessment.id,
      userId: user.id,
      tenantId,
      metadata: { conflictId: conflict.id, assessedSeverity: dto.assessedSeverity },
    });

    return assessment;
  }

  async createMitigation(conflictId: string, dto: MitigationPlanDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const conflict = await this.requireOpenConflict(conflictId, tenantId);

    if (dto.assessmentId) {
      const [assessment] = await this.db
        .select()
        .from(conflictAssessments)
        .where(
          and(
            eq(conflictAssessments.id, dto.assessmentId),
            eq(conflictAssessments.conflictId, conflict.id),
            eq(conflictAssessments.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!assessment) {
        throw new BadRequestException('Assessment not found for this conflict');
      }
    }

    const [plan] = await this.db
      .insert(mitigationPlans)
      .values({
        tenantId,
        conflictId: conflict.id,
        assessmentId: dto.assessmentId,
        title: dto.title,
        description: dto.description,
        measures: dto.measures,
        responsibleUserId: dto.responsibleUserId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        status: dto.status ?? 'active',
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.appendHistory({
      tenantId,
      conflictId: conflict.id,
      action: 'mitigation_created',
      entityType: 'mitigation_plan',
      entityId: plan.id,
      actorId: user.id,
      metadata: { title: plan.title },
    });

    await this.cacheService.invalidateConflict(tenantId, conflict.id);
    await this.notifyResolution(
      tenantId,
      conflict.id,
      user.id,
      `SIMOPS mitigation plan created: ${plan.title}`,
    );

    await this.auditService.log({
      action: 'simops.mitigation.created',
      entityType: 'mitigation_plan',
      entityId: plan.id,
      userId: user.id,
      tenantId,
      metadata: { conflictId: conflict.id },
    });

    return plan;
  }

  async approve(conflictId: string, dto: ApproveConflictDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const conflict = await this.requireOpenConflict(conflictId, tenantId);

    const plans = await this.db
      .select()
      .from(mitigationPlans)
      .where(
        and(
          eq(mitigationPlans.conflictId, conflict.id),
          eq(mitigationPlans.tenantId, tenantId),
          inArray(mitigationPlans.status, ['active', 'completed']),
        ),
      );

    if (plans.length === 0) {
      throw new BadRequestException('Mitigation plan required before approval (BR-SIM-008)');
    }

    let mitigationPlanId = dto.mitigationPlanId;
    if (mitigationPlanId) {
      if (!plans.some((plan) => plan.id === mitigationPlanId)) {
        throw new BadRequestException('Mitigation plan not found for this conflict');
      }
    } else {
      mitigationPlanId = plans[0]!.id;
    }

    const [resolution] = await this.db
      .insert(conflictResolutions)
      .values({
        tenantId,
        conflictId: conflict.id,
        decision: 'approved',
        comments: dto.comments,
        decidedBy: user.id,
        mitigationPlanId,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.db
      .update(simopsConflicts)
      .set({ status: 'resolved', updatedBy: user.id, updatedAt: new Date() })
      .where(eq(simopsConflicts.id, conflict.id));

    await this.db
      .update(conflictParticipants)
      .set({ isFrozen: false, updatedBy: user.id, updatedAt: new Date() })
      .where(eq(conflictParticipants.conflictId, conflict.id));

    await this.appendHistory({
      tenantId,
      conflictId: conflict.id,
      action: 'approved',
      entityType: 'conflict_resolution',
      entityId: resolution.id,
      actorId: user.id,
      metadata: { comments: dto.comments, mitigationPlanId },
    });

    await this.cacheService.invalidateConflict(tenantId, conflict.id);
    await this.notifyResolution(
      tenantId,
      conflict.id,
      user.id,
      'SIMOPS conflict approved — work may proceed with mitigations',
    );

    await this.auditService.log({
      action: 'simops.conflict.approved',
      entityType: 'conflict_resolution',
      entityId: resolution.id,
      userId: user.id,
      tenantId,
      metadata: { conflictId: conflict.id },
    });

    return resolution;
  }

  async reject(conflictId: string, dto: RejectConflictDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const conflict = await this.requireOpenConflict(conflictId, tenantId);

    const [resolution] = await this.db
      .insert(conflictResolutions)
      .values({
        tenantId,
        conflictId: conflict.id,
        decision: 'rejected',
        comments: dto.comments,
        decidedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.db
      .update(simopsConflicts)
      .set({ status: 'rejected', updatedBy: user.id, updatedAt: new Date() })
      .where(eq(simopsConflicts.id, conflict.id));

    await this.db
      .update(conflictParticipants)
      .set({ isFrozen: true, updatedBy: user.id, updatedAt: new Date() })
      .where(eq(conflictParticipants.conflictId, conflict.id));

    await this.appendHistory({
      tenantId,
      conflictId: conflict.id,
      action: 'rejected',
      entityType: 'conflict_resolution',
      entityId: resolution.id,
      actorId: user.id,
      metadata: { comments: dto.comments },
    });

    await this.cacheService.invalidateConflict(tenantId, conflict.id);
    await this.notifyResolution(
      tenantId,
      conflict.id,
      user.id,
      'SIMOPS conflict rejected — affected permits must not proceed',
    );

    await this.auditService.log({
      action: 'simops.conflict.rejected',
      entityType: 'conflict_resolution',
      entityId: resolution.id,
      userId: user.id,
      tenantId,
      metadata: { conflictId: conflict.id },
    });

    return resolution;
  }

  async listHistory(user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const cached = await this.cacheService.getHistoryList<unknown>(tenantId);
    if (cached) {
      return cached;
    }

    const rows = await this.db
      .select()
      .from(conflictHistory)
      .where(eq(conflictHistory.tenantId, tenantId))
      .orderBy(desc(conflictHistory.occurredAt));

    await this.cacheService.setHistoryList(tenantId, rows);
    return rows;
  }

  async getHistory(conflictId: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const cached = await this.cacheService.getHistoryDetail<unknown>(tenantId, conflictId);
    if (cached) {
      return cached;
    }

    const [conflict] = await this.db
      .select()
      .from(simopsConflicts)
      .where(and(eq(simopsConflicts.id, conflictId), eq(simopsConflicts.tenantId, tenantId)))
      .limit(1);

    if (!conflict) {
      throw new NotFoundException('Conflict not found');
    }

    const history = await this.db
      .select()
      .from(conflictHistory)
      .where(
        and(eq(conflictHistory.conflictId, conflictId), eq(conflictHistory.tenantId, tenantId)),
      )
      .orderBy(desc(conflictHistory.occurredAt));

    const assessments = await this.db
      .select()
      .from(conflictAssessments)
      .where(eq(conflictAssessments.conflictId, conflictId));

    const plans = await this.db
      .select()
      .from(mitigationPlans)
      .where(eq(mitigationPlans.conflictId, conflictId));

    const [resolution] = await this.db
      .select()
      .from(conflictResolutions)
      .where(eq(conflictResolutions.conflictId, conflictId))
      .limit(1);

    const detail = { conflict, history, assessments, mitigationPlans: plans, resolution: resolution ?? null };
    await this.cacheService.setHistoryDetail(tenantId, conflictId, detail);
    return detail;
  }

  /** FR-SIM-019 — escalate unresolved high-severity conflicts past timeout. */
  async runEscalationSweep(): Promise<{ escalated: number }> {
    const timeoutHours =
      this.configService.get<number>('simops.escalationTimeoutHoursHigh') ??
      SIMOPS_DEFAULT_ESCALATION_TIMEOUT_HOURS;
    const cutoff = new Date(Date.now() - timeoutHours * 60 * 60 * 1000);

    const stale = await this.db
      .select()
      .from(simopsConflicts)
      .where(
        and(
          eq(simopsConflicts.severity, 'high'),
          inArray(simopsConflicts.status, [...OPEN_STATUSES]),
          lt(simopsConflicts.detectedAt, cutoff),
        ),
      );

    let escalated = 0;
    for (const conflict of stale) {
      const [existing] = await this.db
        .select({ id: conflictResolutions.id })
        .from(conflictResolutions)
        .where(eq(conflictResolutions.conflictId, conflict.id))
        .limit(1);
      if (existing) {
        continue;
      }

      const message = `High-severity SIMOPS conflict unresolved for >${timeoutHours}h`;
      await this.appendHistory({
        tenantId: conflict.tenantId,
        conflictId: conflict.id,
        action: 'escalated',
        entityType: 'simops_conflict',
        entityId: conflict.id,
        actorId: conflict.createdBy ?? SIMOPS_SYSTEM_ACTOR,
        metadata: { timeoutHours },
      });

      await this.jobsService.enqueueEscalation({
        tenantId: conflict.tenantId,
        conflictId: conflict.id,
        severity: conflict.severity,
        unresolvedHours: timeoutHours,
        message,
      });

      await this.jobsService.enqueueNotification({
        tenantId: conflict.tenantId,
        conflictId: conflict.id,
        message,
        kind: 'escalation',
      });

      await this.cacheService.invalidateConflict(conflict.tenantId, conflict.id);
      escalated += 1;
    }

    this.logService.logEvent({
      action: 'simops.escalation.sweep.completed',
      metadata: { escalated, timeoutHours, candidateCount: stale.length },
    });

    return { escalated };
  }

  private async requireOpenConflict(conflictId: string, tenantId: string) {
    const [conflict] = await this.db
      .select()
      .from(simopsConflicts)
      .where(and(eq(simopsConflicts.id, conflictId), eq(simopsConflicts.tenantId, tenantId)))
      .limit(1);

    if (!conflict) {
      throw new NotFoundException('Conflict not found');
    }

    if (!OPEN_STATUSES.includes(conflict.status as (typeof OPEN_STATUSES)[number])) {
      throw new BadRequestException(
        `Conflict status '${conflict.status}' does not allow this action`,
      );
    }

    const [resolution] = await this.db
      .select({ id: conflictResolutions.id })
      .from(conflictResolutions)
      .where(eq(conflictResolutions.conflictId, conflictId))
      .limit(1);

    if (resolution) {
      throw new BadRequestException('Conflict already has a final resolution');
    }

    return conflict;
  }

  private async appendHistory(input: {
    tenantId: string;
    conflictId: string;
    action: SimopsHistoryAction;
    entityType: string;
    entityId?: string;
    actorId: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.db.insert(conflictHistory).values({
      tenantId: input.tenantId,
      conflictId: input.conflictId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId,
      createdBy: input.actorId,
      metadata: input.metadata,
    });
  }

  private async notifyResolution(
    tenantId: string,
    conflictId: string,
    userId: string,
    message: string,
  ) {
    await this.jobsService.enqueueNotification({
      tenantId,
      conflictId,
      recipientUserId: userId,
      message,
      kind: 'resolution',
    });

    this.logService.logEvent({
      action: 'simops.resolution.notified',
      tenantId,
      conflictId,
      userId,
      metadata: { message },
    });
  }
}
