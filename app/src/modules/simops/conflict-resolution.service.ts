import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  conflictAssessments,
  conflictHistory,
  conflictParticipants,
  conflictResolutions,
  mitigationPlans,
  permits,
  permitSuspensions,
  simopsConflicts,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { RESOLVED_CONFLICT_STATUSES } from './simops.constants';
import {
  ApproveConflictDto,
  AssessConflictDto,
  MitigationPlanDto,
  RejectConflictDto,
} from './dto/simops.dto';

@Injectable()
export class ConflictResolutionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
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

    await this.auditService.log({
      action: 'simops.mitigation_planned',
      entityType: 'simops_conflict',
      entityId: conflict.id,
      tenantId,
      userId: user.id,
    });

    return plan;
  }

  async approve(conflictId: string, dto: ApproveConflictDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const conflict = await this.requireOpenConflict(conflictId, tenantId, ['mitigation_planned']);

    await this.requireAssessmentAndMitigation(conflict.id, tenantId);

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

    await this.recordHistory(tenantId, conflict.id, user.id, 'approved', {
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

    await this.suspendParticipantPermits(conflict.id, tenantId, user.id);

    await this.recordHistory(tenantId, conflict.id, user.id, 'rejected', {
      reason: dto.reason.trim(),
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

  private async suspendParticipantPermits(
    conflictId: string,
    tenantId: string,
    userId: string,
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
      const [updated] = await this.db
        .update(permits)
        .set({ status: 'suspended', updatedBy: userId, updatedAt: new Date() })
        .where(
          and(
            eq(permits.id, participant.permitId),
            eq(permits.tenantId, tenantId),
            inArray(permits.status, ['approved', 'active', 'pending_approval']),
          ),
        )
        .returning({ id: permits.id });

      // Authoritative suspension row so MS-05 continue cannot silently clear SIMOPS holds.
      // Uses source=manual until a dedicated simops_rejection source is added to the CHECK.
      if (updated) {
        await this.db.insert(permitSuspensions).values({
          tenantId,
          permitId: participant.permitId,
          reason: `SIMOPS conflict rejected:${conflictId}`,
          suspendedBy: userId,
          source: 'manual',
          createdBy: userId,
          updatedBy: userId,
        });
      }
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
