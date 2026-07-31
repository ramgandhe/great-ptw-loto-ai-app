import { createHash } from 'crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { requireTenant } from '../../common/helpers/tenant-context';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  conflictAlerts,
  conflictParticipants,
  permitTypes,
  permits,
  simopsConflicts,
  type SimopsConflictSeverity,
  type SimopsConflictType,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { AlertSearchDto, ConflictAnalysisDto, ConflictSearchDto } from './dto/conflict.dto';
import { SIMOPS_ACTIVE_PERMIT_STATUSES } from './simops.constants';
import { SimopsCacheService } from './simops-cache.service';
import { SimopsJobsService } from './simops-jobs.service';
import { SimopsLogService } from './simops-log.service';
import { RiskCalculationService } from './risk-calculation.service';

/** Actor used by the scheduled conflict-detection sweep (no interactive user). */
const SIMOPS_SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000166';

type AnalysePermit = {
  id: string;
  tenantId: string;
  status: string;
  permitTypeId: string;
  permitTypeCode: string | null;
  locationId: string | null;
  workstationId: string | null;
  machineryId: string | null;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  createdAt: Date;
  submittedBy: string | null;
};

@Injectable()
export class ConflictDetectionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly riskCalculation: RiskCalculationService,
    private readonly cacheService: SimopsCacheService,
    private readonly jobsService: SimopsJobsService,
    private readonly logService: SimopsLogService,
    private readonly auditService: AuditService,
  ) {}

  async listConflicts(user: AuthenticatedUser, query: ConflictSearchDto) {
    const tenantId = requireTenant(user);
    const cached = await this.cacheService.getConflictList<unknown>(tenantId);
    if (cached && !query.status && !query.severity && !query.permitId) {
      return cached;
    }

    const rows = await this.db
      .select()
      .from(simopsConflicts)
      .where(
        and(
          eq(simopsConflicts.tenantId, tenantId),
          query.status ? eq(simopsConflicts.status, query.status) : undefined,
          query.severity ? eq(simopsConflicts.severity, query.severity) : undefined,
        ),
      )
      .orderBy(desc(simopsConflicts.detectedAt));

    let filtered = rows;
    if (query.permitId) {
      const participantRows = await this.db
        .select({ conflictId: conflictParticipants.conflictId })
        .from(conflictParticipants)
        .where(eq(conflictParticipants.permitId, query.permitId));
      const ids = new Set(participantRows.map((row) => row.conflictId));
      filtered = rows.filter((row) => ids.has(row.id));
    }

    if (!query.status && !query.severity && !query.permitId) {
      await this.cacheService.setConflictList(tenantId, filtered);
    }

    return filtered;
  }

  async getConflict(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const cached = await this.cacheService.getConflictDetail<unknown>(tenantId, id);
    if (cached) {
      return cached;
    }

    const [conflict] = await this.db
      .select()
      .from(simopsConflicts)
      .where(and(eq(simopsConflicts.id, id), eq(simopsConflicts.tenantId, tenantId)))
      .limit(1);

    if (!conflict) {
      throw new NotFoundException('Conflict not found');
    }

    const participants = await this.db
      .select()
      .from(conflictParticipants)
      .where(eq(conflictParticipants.conflictId, id));

    const alerts = await this.db
      .select()
      .from(conflictAlerts)
      .where(eq(conflictAlerts.conflictId, id));

    const detail = { conflict, participants, alerts };
    await this.cacheService.setConflictDetail(tenantId, id, detail);
    return detail;
  }

  async listAlerts(user: AuthenticatedUser, query: AlertSearchDto) {
    const tenantId = requireTenant(user);
    return this.db
      .select()
      .from(conflictAlerts)
      .where(
        and(
          eq(conflictAlerts.tenantId, tenantId),
          query.deliveryStatus
            ? eq(conflictAlerts.deliveryStatus, query.deliveryStatus)
            : undefined,
        ),
      )
      .orderBy(desc(conflictAlerts.createdAt));
  }

  /** Continuous detection entry point for the BullMQ sweep (BR-SIM-001). */
  async analyseForTenant(tenantId: string) {
    const systemUser: AuthenticatedUser = {
      id: SIMOPS_SYSTEM_USER_ID,
      username: 'simops-scheduler',
      tenantId,
      roles: ['platform-admin'],
    };
    return this.analyse(systemUser, {});
  }

  async analyse(user: AuthenticatedUser, dto: ConflictAnalysisDto = {}) {
    const tenantId = requireTenant(user);
    const candidates = await this.loadCandidatePermits(tenantId);

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const left = candidates[i]!;
        const right = candidates[j]!;
        if (dto.permitId && left.id !== dto.permitId && right.id !== dto.permitId) {
          continue;
        }
        const detection = this.evaluatePair(left, right);
        if (!detection) {
          continue;
        }

        const result = await this.persistConflict(user, tenantId, left, right, detection);
        if (result === 'created') {
          created += 1;
        } else {
          skipped += 1;
        }
      }
    }

    await this.cacheService.invalidateTenant(tenantId);

    this.logService.logEvent({
      action: 'simops.analyse.completed',
      tenantId,
      userId: user.id,
      metadata: { created, skipped, candidateCount: candidates.length, permitId: dto.permitId },
    });

    await this.auditService.log({
      action: 'simops.analyse',
      entityType: 'simops_conflict',
      userId: user.id,
      tenantId,
      metadata: { created, skipped, candidateCount: candidates.length },
    });

    return { created, skipped, candidateCount: candidates.length };
  }

  private async loadCandidatePermits(tenantId: string): Promise<AnalysePermit[]> {
    return this.db
      .select({
        id: permits.id,
        tenantId: permits.tenantId,
        status: permits.status,
        permitTypeId: permits.permitTypeId,
        permitTypeCode: permitTypes.code,
        locationId: permits.locationId,
        workstationId: permits.workstationId,
        machineryId: permits.machineryId,
        plannedStartAt: permits.plannedStartAt,
        plannedEndAt: permits.plannedEndAt,
        createdAt: permits.createdAt,
        submittedBy: permits.submittedBy,
      })
      .from(permits)
      .leftJoin(permitTypes, eq(permits.permitTypeId, permitTypes.id))
      .where(
        and(
          eq(permits.tenantId, tenantId),
          inArray(permits.status, [...SIMOPS_ACTIVE_PERMIT_STATUSES]),
        ),
      );
  }

  private schedulesOverlap(a: AnalysePermit, b: AnalysePermit): boolean {
    if (!a.plannedStartAt || !a.plannedEndAt || !b.plannedStartAt || !b.plannedEndAt) {
      return false;
    }
    return a.plannedStartAt < b.plannedEndAt && b.plannedStartAt < a.plannedEndAt;
  }

  private evaluatePair(a: AnalysePermit, b: AnalysePermit): {
    types: SimopsConflictType[];
    severity: SimopsConflictSeverity;
    overlapStartAt: Date | null;
    overlapEndAt: Date | null;
  } | null {
    if (!this.schedulesOverlap(a, b)) {
      return null;
    }

    const types = new Set<SimopsConflictType>(['schedule']);
    const severities: SimopsConflictSeverity[] = ['low'];

    const sameWorkstation = Boolean(a.workstationId && a.workstationId === b.workstationId);
    const sameMachinery = Boolean(a.machineryId && a.machineryId === b.machineryId);
    const sameLocation = Boolean(a.locationId && a.locationId === b.locationId);

    if (sameMachinery) {
      types.add('equipment');
      severities.push('high');
    }
    if (sameWorkstation) {
      types.add('location');
      severities.push('medium');
    } else if (sameLocation && !sameWorkstation && !sameMachinery) {
      // Department/plant-level location alone is not enough (FR-SIM-011); ignore.
    }

    const typeSeverity = this.riskCalculation.permitTypeInteractionSeverity(
      a.permitTypeCode,
      b.permitTypeCode,
    );
    if (typeSeverity) {
      types.add('permit_type');
      severities.push(typeSeverity);
    }

    // Require at least one spatial/equipment/type signal beyond bare schedule.
    if (![...types].some((type) => type !== 'schedule')) {
      return null;
    }

    const overlapStartAt =
      a.plannedStartAt && b.plannedStartAt
        ? new Date(Math.max(a.plannedStartAt.getTime(), b.plannedStartAt.getTime()))
        : null;
    const overlapEndAt =
      a.plannedEndAt && b.plannedEndAt
        ? new Date(Math.min(a.plannedEndAt.getTime(), b.plannedEndAt.getTime()))
        : null;

    return {
      types: [...types],
      severity: this.riskCalculation.maxSeverity(...severities),
      overlapStartAt,
      overlapEndAt,
    };
  }

  private fingerprint(
    tenantId: string,
    permitIds: string[],
    types: SimopsConflictType[],
  ): string {
    const payload = [
      tenantId,
      ...[...permitIds].sort(),
      ...[...types].sort(),
    ].join('|');
    return createHash('sha256').update(payload).digest('hex').slice(0, 64);
  }

  private async persistConflict(
    user: AuthenticatedUser,
    tenantId: string,
    left: AnalysePermit,
    right: AnalysePermit,
    detection: {
      types: SimopsConflictType[];
      severity: SimopsConflictSeverity;
      overlapStartAt: Date | null;
      overlapEndAt: Date | null;
    },
  ): Promise<'created' | 'skipped'> {
    const [older, newer] =
      left.createdAt.getTime() <= right.createdAt.getTime() ? [left, right] : [right, left];
    const fingerprint = this.fingerprint(
      tenantId,
      [left.id, right.id],
      detection.types,
    );

    const existing = await this.db
      .select({ id: simopsConflicts.id })
      .from(simopsConflicts)
      .where(
        and(eq(simopsConflicts.tenantId, tenantId), eq(simopsConflicts.fingerprint, fingerprint)),
      )
      .limit(1);

    if (existing.length > 0) {
      return 'skipped';
    }

    const primaryConflictType = this.riskCalculation.primaryType(detection.types);

    const [conflict] = await this.db
      .insert(simopsConflicts)
      .values({
        tenantId,
        status: 'pending_assessment',
        severity: detection.severity,
        primaryConflictType,
        conflictTypes: detection.types,
        fingerprint,
        overlapStartAt: detection.overlapStartAt,
        overlapEndAt: detection.overlapEndAt,
        locationId: newer.locationId ?? older.locationId,
        workstationId: newer.workstationId ?? older.workstationId,
        machineryId: newer.machineryId ?? older.machineryId,
        details: {
          permitIds: [older.id, newer.id],
          permitTypeCodes: [older.permitTypeCode, newer.permitTypeCode],
        },
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.db.insert(conflictParticipants).values([
      {
        conflictId: conflict.id,
        permitId: older.id,
        participantRole: 'older',
        isFrozen: false,
        createdBy: user.id,
      },
      {
        conflictId: conflict.id,
        permitId: newer.id,
        participantRole: 'newer',
        isFrozen: true,
        createdBy: user.id,
      },
    ]);

    const recipients = [
      { userId: older.submittedBy, role: 'job-issuer' },
      { userId: newer.submittedBy, role: 'job-issuer' },
      { userId: user.id, role: 'supervisor' },
    ].filter((row, index, all) => {
      if (!row.userId) {
        return index === all.length - 1;
      }
      return all.findIndex((candidate) => candidate.userId === row.userId) === index;
    });

    for (const recipient of recipients) {
      const message = `SIMOPS ${detection.severity} conflict detected (${primaryConflictType})`;
      await this.db.insert(conflictAlerts).values({
        conflictId: conflict.id,
        tenantId,
        recipientUserId: recipient.userId,
        recipientRole: recipient.role,
        channel: 'in_app',
        deliveryStatus: 'sent',
        message,
        sentAt: new Date(),
        createdBy: user.id,
      });

      await this.jobsService.enqueueNotification({
        tenantId,
        conflictId: conflict.id,
        permitId: newer.id,
        recipientUserId: recipient.userId ?? undefined,
        message,
      });
    }

    this.logService.logEvent({
      action: 'simops.conflict.detected',
      tenantId,
      conflictId: conflict.id,
      metadata: {
        severity: detection.severity,
        types: detection.types,
        permitIds: [older.id, newer.id],
      },
    });

    await this.auditService.log({
      action: 'simops.conflict.created',
      entityType: 'simops_conflict',
      entityId: conflict.id,
      userId: user.id,
      tenantId,
      metadata: { fingerprint, severity: detection.severity },
    });

    return 'created';
  }
}
