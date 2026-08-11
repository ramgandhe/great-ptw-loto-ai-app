import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  auditHistory,
  conflictAlerts,
  conflictAssessments,
  conflictHistory,
  conflictParticipants,
  conflictResolutions,
  equipmentEnergySources,
  hazardCategories,
  hazardInteractionMatrix,
  locationAdjacencies,
  locations,
  lototoPlans,
  mitigationPlans,
  permitHazards,
  permits,
  simopsConflicts,
  simopsTenantSettings,
  type ConflictSeverity,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  ACTIVE_LOTOTO_PLAN_STATUSES,
  ALERT_RECIPIENT_ROLES,
  ANALYSABLE_PERMIT_STATUSES,
  DEFAULT_HIGH_ESCALATION_HOURS,
  FROZEN_PEER_STATUSES,
} from './simops.constants';
import { ConflictSearchDto } from './dto/simops.dto';
import {
  detectConflicts,
  emptyDetectionContext,
  newerPermitId,
  pairKey,
  type DetectionContext,
  type PermitForAnalysis,
} from './conflict-detection.service';

@Injectable()
export class SimopsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async listConflicts(user: AuthenticatedUser, query: ConflictSearchDto = {}) {
    const tenantId = this.requireTenant(user);
    const conditions = [eq(simopsConflicts.tenantId, tenantId)];

    if (query.status) {
      conditions.push(eq(simopsConflicts.status, query.status));
    }

    if (query.severity) {
      conditions.push(eq(simopsConflicts.severity, query.severity));
    }

    const rows = await this.db
      .select()
      .from(simopsConflicts)
      .where(and(...conditions))
      .orderBy(desc(simopsConflicts.detectedAt));

    if (query.permitId) {
      const participantRows = await this.db
        .select({ conflictId: conflictParticipants.conflictId })
        .from(conflictParticipants)
        .where(
          and(
            eq(conflictParticipants.tenantId, tenantId),
            eq(conflictParticipants.permitId, query.permitId),
          ),
        );

      const conflictIds = new Set(participantRows.map((row) => row.conflictId));
      return rows.filter((row) => conflictIds.has(row.id));
    }

    return rows;
  }

  async findConflict(id: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const [conflict] = await this.db
      .select()
      .from(simopsConflicts)
      .where(and(eq(simopsConflicts.id, id), eq(simopsConflicts.tenantId, tenantId)))
      .limit(1);

    if (!conflict) {
      throw new NotFoundException('Conflict not found');
    }

    const participants = await this.db
      .select({
        participant: conflictParticipants,
        permit: permits,
      })
      .from(conflictParticipants)
      .innerJoin(permits, eq(conflictParticipants.permitId, permits.id))
      .where(eq(conflictParticipants.conflictId, conflict.id));

    const alerts = await this.db
      .select()
      .from(conflictAlerts)
      .where(eq(conflictAlerts.conflictId, conflict.id))
      .orderBy(desc(conflictAlerts.createdAt));

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

    return {
      conflict,
      participants: participants.map((row) => ({
        ...row.participant,
        permit: row.permit,
      })),
      alerts,
      assessment: assessment ?? null,
      mitigation: mitigation ?? null,
      resolution: resolution ?? null,
      history,
    };
  }

  async listAlerts(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    return this.db
      .select({
        alert: conflictAlerts,
        conflict: simopsConflicts,
      })
      .from(conflictAlerts)
      .innerJoin(simopsConflicts, eq(conflictAlerts.conflictId, simopsConflicts.id))
      .where(eq(conflictAlerts.tenantId, tenantId))
      .orderBy(desc(conflictAlerts.createdAt));
  }

  /** FR-SIM-016 — automated trigger entrypoint (submit/edit/extension/nightly). */
  async analyseForTenant(tenantId: string, actorId: string, permitId?: string) {
    const analysablePermits = await this.loadAnalysablePermits(tenantId);
    const context = await this.loadDetectionContext(tenantId, analysablePermits);
    const detected = detectConflicts(analysablePermits, context).filter((item) =>
      permitId ? item.permitIds.includes(permitId) : true,
    );

    let created = 0;
    let skipped = 0;

    for (const item of detected) {
      const inserted = await this.persistConflict(tenantId, item, actorId, analysablePermits);
      if (inserted) {
        created += 1;
      } else {
        skipped += 1;
      }
    }

    await this.auditService.log({
      action: 'simops.analyse',
      entityType: 'simops_conflict',
      tenantId,
      userId: actorId,
      metadata: {
        permitId: permitId ?? null,
        analysedPermitCount: analysablePermits.length,
        created,
        skipped,
        trigger: permitId ? 'scoped' : 'full',
      },
    });

    return {
      analysedPermitCount: analysablePermits.length,
      detectedCount: detected.length,
      createdCount: created,
      skippedCount: skipped,
    };
  }

  async analyse(user: AuthenticatedUser, permitId?: string) {
    const tenantId = this.requireTenant(user);
    return this.analyseForTenant(tenantId, user.id, permitId);
  }

  /** FR-SIM-016 nightly — approved but not yet active. */
  async reevaluateUpcomingApproved(actorId = 'system') {
    const rows = await this.db
      .select({ tenantId: permits.tenantId })
      .from(permits)
      .where(eq(permits.status, 'approved'))
      .groupBy(permits.tenantId);

    const results = [];
    for (const row of rows) {
      results.push(await this.analyseForTenant(row.tenantId, actorId));
    }
    return results;
  }

  async releaseHold(conflictId: string, tenantId: string, actorId: string) {
    await this.db
      .update(permits)
      .set({
        simopsHoldAt: null,
        simopsHoldConflictId: null,
        updatedBy: actorId,
      })
      .where(
        and(eq(permits.tenantId, tenantId), eq(permits.simopsHoldConflictId, conflictId)),
      );
  }

  private async loadAnalysablePermits(tenantId: string): Promise<PermitForAnalysis[]> {
    const rows = await this.db
      .select({
        id: permits.id,
        reference: permits.reference,
        title: permits.title,
        permitTypeId: permits.permitTypeId,
        workstationId: permits.workstationId,
        locationId: permits.locationId,
        machineryId: permits.machineryId,
        departmentId: permits.departmentId,
        plannedStartAt: permits.plannedStartAt,
        plannedEndAt: permits.plannedEndAt,
        status: permits.status,
        submittedAt: permits.submittedAt,
        createdAt: permits.createdAt,
      })
      .from(permits)
      .where(
        and(
          eq(permits.tenantId, tenantId),
          inArray(permits.status, [...ANALYSABLE_PERMIT_STATUSES]),
        ),
      );

    if (rows.length === 0) {
      return [];
    }

    const permitIds = rows.map((row) => row.id);
    const hazardRows = await this.db
      .select({
        permitId: permitHazards.permitId,
        code: hazardCategories.code,
      })
      .from(permitHazards)
      .innerJoin(hazardCategories, eq(permitHazards.hazardCategoryId, hazardCategories.id))
      .where(inArray(permitHazards.permitId, permitIds));

    const hazardsByPermit = new Map<string, string[]>();
    for (const row of hazardRows) {
      const list = hazardsByPermit.get(row.permitId) ?? [];
      list.push(row.code);
      hazardsByPermit.set(row.permitId, list);
    }

    return rows.map((row) => ({
      ...row,
      hazardCategoryCodes: hazardsByPermit.get(row.id) ?? [],
    }));
  }

  private async loadDetectionContext(
    tenantId: string,
    analysable: PermitForAnalysis[],
  ): Promise<DetectionContext> {
    const context = emptyDetectionContext();

    const adjacencyRows = await this.db
      .select()
      .from(locationAdjacencies)
      .where(eq(locationAdjacencies.tenantId, tenantId));

    for (const row of adjacencyRows) {
      context.adjacentLocationPairs.add(pairKey(row.locationId, row.adjacentLocationId));
    }

    const locationRows = await this.db
      .select({ id: locations.id, adjacencyZone: locations.adjacencyZone })
      .from(locations)
      .where(and(eq(locations.tenantId, tenantId), isNotNull(locations.adjacencyZone)));

    for (const row of locationRows) {
      if (row.adjacencyZone) {
        context.adjacencyZoneByLocation.set(row.id, row.adjacencyZone);
      }
    }

    const matrixRows = await this.db
      .select()
      .from(hazardInteractionMatrix)
      .where(
        and(eq(hazardInteractionMatrix.tenantId, tenantId), eq(hazardInteractionMatrix.isActive, true)),
      );

    for (const row of matrixRows) {
      context.hazardMatrix.set(
        pairKey(row.hazardCodeA, row.hazardCodeB),
        row.severity as ConflictSeverity,
      );
    }

    if (analysable.length > 0) {
      const permitIds = analysable.map((row) => row.id);
      const energyRows = await this.db
        .select({
          permitId: lototoPlans.permitId,
          machineryId: equipmentEnergySources.machineryId,
          energySourceType: equipmentEnergySources.energySourceType,
        })
        .from(lototoPlans)
        .innerJoin(equipmentEnergySources, eq(equipmentEnergySources.planId, lototoPlans.id))
        .where(
          and(
            eq(lototoPlans.tenantId, tenantId),
            inArray(lototoPlans.permitId, permitIds),
            inArray(lototoPlans.status, [...ACTIVE_LOTOTO_PLAN_STATUSES]),
          ),
        );

      for (const row of energyRows) {
        const set = context.energyKeysByPermit.get(row.permitId) ?? new Set<string>();
        set.add(`${row.machineryId}:${row.energySourceType}`);
        context.energyKeysByPermit.set(row.permitId, set);
      }
    }

    return context;
  }

  private async persistConflict(
    tenantId: string,
    item: ReturnType<typeof detectConflicts>[number],
    userId: string,
    analysable: PermitForAnalysis[],
  ): Promise<boolean> {
    const existing = await this.db
      .select({ id: simopsConflicts.id })
      .from(simopsConflicts)
      .where(
        and(
          eq(simopsConflicts.tenantId, tenantId),
          eq(simopsConflicts.fingerprint, item.fingerprint),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return false;
    }

    const byId = new Map(analysable.map((row) => [row.id, row]));
    const permitA = byId.get(item.permitIds[0]);
    const permitB = byId.get(item.permitIds[1]);
    const newerId =
      permitA && permitB
        ? newerPermitId(permitA, permitB)
        : (item.details.newerPermitId as string | undefined) ?? item.permitIds[0];
    const olderId = item.permitIds.find((id) => id !== newerId) ?? item.permitIds[1];
    const older = byId.get(olderId);
    const newer = byId.get(newerId);

    const crossDept = Boolean(
      permitA?.departmentId &&
        permitB?.departmentId &&
        permitA.departmentId !== permitB.departmentId,
    );

    const shouldFreeze =
      Boolean(older && FROZEN_PEER_STATUSES.includes(older.status as 'approved' | 'active')) &&
      Boolean(newer);

    let escalateAfter: Date | null = null;
    if (crossDept && item.severity === 'high') {
      const hours = await this.resolveEscalationHours(tenantId);
      escalateAfter = new Date(Date.now() + hours * 60 * 60 * 1000);
    }

    const [conflict] = await this.db
      .insert(simopsConflicts)
      .values({
        tenantId,
        status: 'open',
        severity: item.severity,
        conflictType: item.conflictType,
        summary: item.summary,
        details: item.details,
        fingerprint: item.fingerprint,
        frozenPermitId: shouldFreeze ? newerId : null,
        requiresJointAck: crossDept,
        departmentAId: permitA?.departmentId ?? null,
        departmentBId: permitB?.departmentId ?? null,
        escalateAfter,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await this.db.insert(conflictParticipants).values(
      item.permitIds.map((permitId) => ({
        tenantId,
        conflictId: conflict.id,
        permitId,
        createdBy: userId,
        updatedBy: userId,
      })),
    );

    // FR-SIM-017 — freeze only the newer permit.
    if (shouldFreeze) {
      await this.db
        .update(permits)
        .set({
          simopsHoldAt: new Date(),
          simopsHoldConflictId: conflict.id,
          updatedBy: userId,
        })
        .where(and(eq(permits.id, newerId), eq(permits.tenantId, tenantId)));
    }

    await this.db.insert(conflictAlerts).values(
      ALERT_RECIPIENT_ROLES.map((recipientRole) => ({
        tenantId,
        conflictId: conflict.id,
        severity: item.severity,
        message: item.summary,
        recipientRole,
        status: 'pending',
        createdBy: userId,
        updatedBy: userId,
      })),
    );

    // FR-SIM-020 — immutable record linked to both permits' audit histories.
    for (const permitId of item.permitIds) {
      await this.db.insert(auditHistory).values({
        permitId,
        action: 'simops.conflict_detected',
        actorId: userId,
        comment: item.summary,
        metadata: {
          conflictId: conflict.id,
          severity: item.severity,
          conflictType: item.conflictType,
          peerPermitId: item.permitIds.find((id) => id !== permitId),
          frozenPermitId: shouldFreeze ? newerId : null,
        },
        createdBy: userId,
      });
    }

    await this.auditService.log({
      action: 'simops.conflict_detected',
      entityType: 'simops_conflict',
      entityId: conflict.id,
      tenantId,
      userId,
      metadata: {
        severity: item.severity,
        conflictType: item.conflictType,
        permitIds: item.permitIds,
        frozenPermitId: shouldFreeze ? newerId : null,
        requiresJointAck: crossDept,
      },
    });

    await this.db.insert(conflictHistory).values({
      tenantId,
      conflictId: conflict.id,
      action: 'detected',
      actorUserId: userId,
      metadata: {
        severity: item.severity,
        conflictType: item.conflictType,
        frozenPermitId: shouldFreeze ? newerId : null,
        requiresJointAck: crossDept,
      },
      createdBy: userId,
      updatedBy: userId,
    });

    return true;
  }

  private async resolveEscalationHours(tenantId: string): Promise<number> {
    const [settings] = await this.db
      .select()
      .from(simopsTenantSettings)
      .where(eq(simopsTenantSettings.tenantId, tenantId))
      .limit(1);

    return settings?.highEscalationHours ?? DEFAULT_HIGH_ESCALATION_HOURS;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    return user.tenantId;
  }
}
