import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  conflictAlerts,
  conflictAssessments,
  conflictHistory,
  conflictParticipants,
  conflictResolutions,
  mitigationPlans,
  permits,
  simopsConflicts,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { ANALYSABLE_PERMIT_STATUSES, ALERT_RECIPIENT_ROLES } from './simops.constants';
import { ConflictSearchDto } from './dto/simops.dto';
import {
  detectConflicts,
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

  async analyse(user: AuthenticatedUser, permitId?: string) {
    const tenantId = this.requireTenant(user);
    const analysablePermits = await this.loadAnalysablePermits(tenantId, permitId);
    const detected = detectConflicts(analysablePermits);

    let created = 0;
    let skipped = 0;

    for (const item of detected) {
      const inserted = await this.persistConflict(tenantId, item, user.id);
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
      userId: user.id,
      metadata: {
        permitId: permitId ?? null,
        analysedPermitCount: analysablePermits.length,
        created,
        skipped,
      },
    });

    return {
      analysedPermitCount: analysablePermits.length,
      detectedCount: detected.length,
      createdCount: created,
      skippedCount: skipped,
    };
  }

  private async loadAnalysablePermits(
    tenantId: string,
    permitId?: string,
  ): Promise<PermitForAnalysis[]> {
    const conditions = [
      eq(permits.tenantId, tenantId),
      inArray(permits.status, [...ANALYSABLE_PERMIT_STATUSES]),
    ];

    if (permitId) {
      conditions.push(eq(permits.id, permitId));
    }

    const rows = await this.db
      .select({
        id: permits.id,
        reference: permits.reference,
        title: permits.title,
        permitTypeId: permits.permitTypeId,
        workstationId: permits.workstationId,
        locationId: permits.locationId,
        machineryId: permits.machineryId,
        plannedStartAt: permits.plannedStartAt,
        plannedEndAt: permits.plannedEndAt,
        status: permits.status,
      })
      .from(permits)
      .where(and(...conditions));

    return rows;
  }

  private async persistConflict(
    tenantId: string,
    item: ReturnType<typeof detectConflicts>[number],
    userId: string,
  ): Promise<boolean> {
    const existing = await this.db
      .select({ id: simopsConflicts.id })
      .from(simopsConflicts)
      .where(
        and(
          eq(simopsConflicts.tenantId, tenantId),
          eq(simopsConflicts.fingerprint, item.fingerprint),
          eq(simopsConflicts.status, 'open'),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return false;
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
      },
      createdBy: userId,
      updatedBy: userId,
    });

    return true;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    return user.tenantId;
  }
}
