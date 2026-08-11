import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  auditHistory,
  conflictAlerts,
  conflictAssessments,
  conflictHistory,
  conflictParticipants,
  conflictResolutions,
  mitigationPlans,
  permits,
  permitSuspensions,
  simopsConflicts,
  simopsTenantSettings,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  DEFAULT_HIGH_ESCALATION_HOURS,
  RESOLVED_CONFLICT_STATUSES,
  SIMOPS_LOW_ACK_ROLES,
} from './simops.constants';
import {
  ApproveConflictDto,
  AssessConflictDto,
  MitigationPlanDto,
  RejectConflictDto,
} from './dto/simops.dto';
import { SimopsService } from './simops.service';

@Injectable()
export class ConflictResolutionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly simopsService: SimopsService,
  ) {}

  async assess(conflictId: string, dto: AssessConflictDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const conflict = await this.requireOpenConflict(conflictId, tenantId, ['open']);

    const [assessment] = await this.db
      .insert(conflictAssessments)
      .values({
        tenantId,
        conflictId: conflict.id,
        assessedSeverity: dto.assessedSeverity,
        riskSummary: dto.riskSummary.trim(),
        assessedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.db
      .update(simopsConflicts)
      .set({ status: 'assessed', updatedBy: user.id, updatedAt: new Date() })
      .where(eq(simopsConflicts.id, conflict.id));

    await this.recordHistory(tenantId, conflict.id, user.id, 'assessed', {
      assessedSeverity: dto.assessedSeverity,
    });

    await this.auditBothPermits(conflict.id, tenantId, user.id, 'simops.conflict_assessed', {
      assessedSeverity: dto.assessedSeverity,
    });

    await this.auditService.log({
      action: 'simops.conflict_assessed',
      entityType: 'simops_conflict',
      entityId: conflict.id,
      tenantId,
      userId: user.id,
    });

    return assessment;
  }

  async createMitigation(conflictId: string, dto: MitigationPlanDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const conflict = await this.requireOpenConflict(conflictId, tenantId, ['assessed']);

    const [assessment] = await this.db
      .select()
      .from(conflictAssessments)
      .where(
        and(
          eq(conflictAssessments.conflictId, conflict.id),
          eq(conflictAssessments.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!assessment) {
      throw new BadRequestException('Conflict must be assessed before mitigation planning');
    }

    const [plan] = await this.db
      .insert(mitigationPlans)
      .values({
        tenantId,
        conflictId: conflict.id,
        assessmentId: assessment.id,
        planSummary: dto.planSummary.trim(),
        actions: dto.actions,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .onConflictDoUpdate({
        target: mitigationPlans.conflictId,
        set: {
          planSummary: dto.planSummary.trim(),
          actions: dto.actions,
          updatedBy: user.id,
          updatedAt: new Date(),
        },
      })
      .returning();

    await this.db
      .update(simopsConflicts)
      .set({ status: 'mitigation_planned', updatedBy: user.id, updatedAt: new Date() })
      .where(eq(simopsConflicts.id, conflict.id));

    await this.recordHistory(tenantId, conflict.id, user.id, 'mitigation_planned', {
      actionCount: dto.actions.length,
    });

    await this.auditBothPermits(conflict.id, tenantId, user.id, 'simops.mitigation_planned', {
      actionCount: dto.actions.length,
    });

    await this.auditService.log({
      action: 'simops.mitigation_planned',
      entityType: 'simops_conflict',
      entityId: conflict.id,
      tenantId,
      userId: user.id,
    });

    return plan;
  }

  /** FR-SIM-015 — Low-severity conflicts may be auto-acknowledged by Job Issuer. */
  async acknowledgeLow(conflictId: string, comments: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    if (!user.roles.some((role) => (SIMOPS_LOW_ACK_ROLES as readonly string[]).includes(role))) {
      throw new ForbiddenException('Not authorized to acknowledge low-severity conflicts');
    }

    const conflict = await this.requireOpenConflict(conflictId, tenantId, ['open']);
    if (conflict.severity !== 'low') {
      throw new BadRequestException('Only low-severity conflicts can be auto-acknowledged');
    }

    const [resolution] = await this.db
      .insert(conflictResolutions)
      .values({
        tenantId,
        conflictId: conflict.id,
        outcome: 'approved',
        comments: comments.trim() || 'Low-severity conflict acknowledged by Job Issuer',
        resolvedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.db
      .update(simopsConflicts)
      .set({ status: 'approved', updatedBy: user.id, updatedAt: new Date() })
      .where(eq(simopsConflicts.id, conflict.id));

    await this.simopsService.releaseHold(conflict.id, tenantId, user.id);
    await this.recordHistory(tenantId, conflict.id, user.id, 'low_acknowledged', {});
    await this.auditBothPermits(conflict.id, tenantId, user.id, 'simops.conflict_approved', {
      lowAutoAck: true,
    });

    return resolution;
  }

  /** FR-SIM-018 — cross-department joint acknowledgment. */
  async acknowledgeDepartment(conflictId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const conflict = await this.requireOpenConflict(conflictId, tenantId, [
      'open',
      'assessed',
      'mitigation_planned',
    ]);

    if (!conflict.requiresJointAck) {
      throw new BadRequestException('Conflict does not require joint acknowledgment');
    }

    const patch: Record<string, unknown> = { updatedBy: user.id, updatedAt: new Date() };
    if (!conflict.ackUserA) {
      patch.ackUserA = user.id;
      patch.ackAtA = new Date();
    } else if (!conflict.ackUserB && conflict.ackUserA !== user.id) {
      patch.ackUserB = user.id;
      patch.ackAtB = new Date();
    } else if (conflict.ackUserA === user.id || conflict.ackUserB === user.id) {
      throw new BadRequestException('Department acknowledgment already recorded for this actor');
    } else {
      throw new BadRequestException('Both department acknowledgments are already recorded');
    }

    const [updated] = await this.db
      .update(simopsConflicts)
      .set(patch)
      .where(eq(simopsConflicts.id, conflict.id))
      .returning();

    await this.recordHistory(tenantId, conflict.id, user.id, 'department_acknowledged', {
      ackUserA: updated.ackUserA,
      ackUserB: updated.ackUserB,
    });

    return updated;
  }

  async approve(conflictId: string, dto: ApproveConflictDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const conflict = await this.requireOpenConflict(conflictId, tenantId, ['mitigation_planned']);

    await this.requireAssessmentAndMitigation(conflict.id, tenantId);

    if (conflict.requiresJointAck && (!conflict.ackUserA || !conflict.ackUserB)) {
      throw new BadRequestException(
        'Cross-department conflicts require joint acknowledgment from both departments before approval',
      );
    }

    const [resolution] = await this.db
      .insert(conflictResolutions)
      .values({
        tenantId,
        conflictId: conflict.id,
        outcome: 'approved',
        comments: dto.comments.trim(),
        resolvedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.db
      .update(simopsConflicts)
      .set({ status: 'approved', updatedBy: user.id, updatedAt: new Date() })
      .where(eq(simopsConflicts.id, conflict.id));

    await this.simopsService.releaseHold(conflict.id, tenantId, user.id);

    await this.recordHistory(tenantId, conflict.id, user.id, 'approved', {
      comments: dto.comments.trim(),
    });

    await this.auditBothPermits(conflict.id, tenantId, user.id, 'simops.conflict_approved', {
      comments: dto.comments.trim(),
    });

    await this.auditService.log({
      action: 'simops.conflict_approved',
      entityType: 'simops_conflict',
      entityId: conflict.id,
      tenantId,
      userId: user.id,
    });

    return resolution;
  }

  async reject(conflictId: string, dto: RejectConflictDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const conflict = await this.requireOpenConflict(conflictId, tenantId, [
      'open',
      'assessed',
      'mitigation_planned',
    ]);

    const [resolution] = await this.db
      .insert(conflictResolutions)
      .values({
        tenantId,
        conflictId: conflict.id,
        outcome: 'rejected',
        comments: dto.reason.trim(),
        resolvedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.db
      .update(simopsConflicts)
      .set({ status: 'rejected', updatedBy: user.id, updatedAt: new Date() })
      .where(eq(simopsConflicts.id, conflict.id));

    await this.suspendFrozenPermit(conflict.id, tenantId, user.id, conflict.frozenPermitId);

    await this.recordHistory(tenantId, conflict.id, user.id, 'rejected', {
      reason: dto.reason.trim(),
    });

    await this.auditBothPermits(conflict.id, tenantId, user.id, 'simops.conflict_rejected', {
      reason: dto.reason.trim(),
      frozenPermitId: conflict.frozenPermitId,
    });

    await this.auditService.log({
      action: 'simops.conflict_rejected',
      entityType: 'simops_conflict',
      entityId: conflict.id,
      tenantId,
      userId: user.id,
    });

    return resolution;
  }

  /** FR-SIM-019 — escalate overdue cross-department High conflicts. */
  async escalateOverdue(actorId = 'system') {
    const now = new Date();
    const due = await this.db
      .select()
      .from(simopsConflicts)
      .where(
        and(
          inArray(simopsConflicts.status, ['open', 'assessed', 'mitigation_planned']),
          eq(simopsConflicts.requiresJointAck, true),
          isNull(simopsConflicts.escalatedAt),
          lt(simopsConflicts.escalateAfter, now),
        ),
      );

    let escalated = 0;
    for (const conflict of due) {
      const [settings] = await this.db
        .select()
        .from(simopsTenantSettings)
        .where(eq(simopsTenantSettings.tenantId, conflict.tenantId))
        .limit(1);
      const arbiterRole = settings?.conflictArbiterRole ?? 'org-admin';

      await this.db
        .update(simopsConflicts)
        .set({
          escalatedAt: now,
          escalatedToRole: arbiterRole,
          updatedBy: actorId,
          updatedAt: now,
        })
        .where(eq(simopsConflicts.id, conflict.id));

      await this.db.insert(conflictAlerts).values({
        tenantId: conflict.tenantId,
        conflictId: conflict.id,
        severity: conflict.severity,
        message: `Cross-department SIMOPS conflict escalated to ${arbiterRole}`,
        recipientRole: arbiterRole,
        status: 'pending',
        createdBy: actorId,
        updatedBy: actorId,
      });

      await this.recordHistory(conflict.tenantId, conflict.id, actorId, 'escalated', {
        escalatedToRole: arbiterRole,
        defaultHours: settings?.highEscalationHours ?? DEFAULT_HIGH_ESCALATION_HOURS,
      });

      await this.auditBothPermits(
        conflict.id,
        conflict.tenantId,
        actorId,
        'simops.conflict_escalated',
        { escalatedToRole: arbiterRole },
      );

      escalated += 1;
    }

    return { escalated };
  }

  async listHistory(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    return this.db
      .select({
        conflict: simopsConflicts,
        resolution: conflictResolutions,
      })
      .from(simopsConflicts)
      .innerJoin(conflictResolutions, eq(conflictResolutions.conflictId, simopsConflicts.id))
      .where(
        and(
          eq(simopsConflicts.tenantId, tenantId),
          inArray(simopsConflicts.status, [...RESOLVED_CONFLICT_STATUSES]),
        ),
      )
      .orderBy(desc(conflictResolutions.resolvedAt));
  }

  async getHistoryRecord(conflictId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.loadResolutionDetail(conflictId, tenantId);

    if (!detail.conflict) {
      throw new NotFoundException('Conflict not found');
    }

    if (!RESOLVED_CONFLICT_STATUSES.includes(detail.conflict.status as 'approved' | 'rejected')) {
      throw new BadRequestException('Conflict is not resolved');
    }

    return detail;
  }

  async loadResolutionDetail(conflictId: string, tenantId: string) {
    const [conflict] = await this.db
      .select()
      .from(simopsConflicts)
      .where(and(eq(simopsConflicts.id, conflictId), eq(simopsConflicts.tenantId, tenantId)))
      .limit(1);

    if (!conflict) {
      return { conflict: null };
    }

    const [assessment] = await this.db
      .select()
      .from(conflictAssessments)
      .where(eq(conflictAssessments.conflictId, conflict.id))
      .limit(1);

    const [mitigation] = await this.db
      .select()
      .from(mitigationPlans)
      .where(eq(mitigationPlans.conflictId, conflict.id))
      .limit(1);

    const [resolution] = await this.db
      .select()
      .from(conflictResolutions)
      .where(eq(conflictResolutions.conflictId, conflict.id))
      .limit(1);

    const history = await this.db
      .select()
      .from(conflictHistory)
      .where(eq(conflictHistory.conflictId, conflict.id))
      .orderBy(desc(conflictHistory.createdAt));

    const participants = await this.db
      .select({
        participant: conflictParticipants,
        permit: permits,
      })
      .from(conflictParticipants)
      .innerJoin(permits, eq(conflictParticipants.permitId, permits.id))
      .where(eq(conflictParticipants.conflictId, conflict.id));

    return {
      conflict,
      assessment: assessment ?? null,
      mitigation: mitigation ?? null,
      resolution: resolution ?? null,
      history,
      participants: participants.map((row) => ({
        ...row.participant,
        permit: row.permit,
      })),
    };
  }

  private async requireAssessmentAndMitigation(conflictId: string, tenantId: string) {
    const [assessment] = await this.db
      .select({ id: conflictAssessments.id })
      .from(conflictAssessments)
      .where(
        and(
          eq(conflictAssessments.conflictId, conflictId),
          eq(conflictAssessments.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!assessment) {
      throw new BadRequestException('Conflict must be assessed before approval');
    }

    const [mitigation] = await this.db
      .select({ id: mitigationPlans.id })
      .from(mitigationPlans)
      .where(
        and(eq(mitigationPlans.conflictId, conflictId), eq(mitigationPlans.tenantId, tenantId)),
      )
      .limit(1);

    if (!mitigation) {
      throw new BadRequestException('Mitigation plan is required before approval');
    }
  }

  private async requireOpenConflict(
    conflictId: string,
    tenantId: string,
    allowedStatuses: string[],
  ) {
    const [conflict] = await this.db
      .select()
      .from(simopsConflicts)
      .where(and(eq(simopsConflicts.id, conflictId), eq(simopsConflicts.tenantId, tenantId)))
      .limit(1);

    if (!conflict) {
      throw new NotFoundException('Conflict not found');
    }

    if (RESOLVED_CONFLICT_STATUSES.includes(conflict.status as 'approved' | 'rejected')) {
      throw new BadRequestException('Conflict is already resolved');
    }

    if (!allowedStatuses.includes(conflict.status)) {
      throw new BadRequestException(
        `Conflict must be in one of [${allowedStatuses.join(', ')}] status`,
      );
    }

    return conflict;
  }

  private async suspendFrozenPermit(
    conflictId: string,
    tenantId: string,
    userId: string,
    frozenPermitId: string | null,
  ) {
    if (!frozenPermitId) {
      return;
    }

    const [updated] = await this.db
      .update(permits)
      .set({
        status: 'suspended',
        simopsHoldAt: null,
        simopsHoldConflictId: null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(permits.id, frozenPermitId),
          eq(permits.tenantId, tenantId),
          inArray(permits.status, ['approved', 'active', 'pending_approval']),
        ),
      )
      .returning({ id: permits.id });

    if (updated) {
      await this.db.insert(permitSuspensions).values({
        tenantId,
        permitId: frozenPermitId,
        reason: `SIMOPS conflict rejected:${conflictId}`,
        suspendedBy: userId,
        source: 'manual',
        createdBy: userId,
        updatedBy: userId,
      });
    }
  }

  private async auditBothPermits(
    conflictId: string,
    tenantId: string,
    actorId: string,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    const participants = await this.db
      .select({ permitId: conflictParticipants.permitId })
      .from(conflictParticipants)
      .where(
        and(
          eq(conflictParticipants.conflictId, conflictId),
          eq(conflictParticipants.tenantId, tenantId),
        ),
      );

    for (const participant of participants) {
      await this.db.insert(auditHistory).values({
        permitId: participant.permitId,
        action,
        actorId,
        metadata: { conflictId, ...metadata },
        createdBy: actorId,
      });
    }
  }

  private async recordHistory(
    tenantId: string,
    conflictId: string,
    actorUserId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.db.insert(conflictHistory).values({
      tenantId,
      conflictId,
      action,
      actorUserId,
      metadata: metadata ?? null,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    return user.tenantId;
  }
}
