import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  incidentHodDecisions,
  incidentPermits,
  permitExecution,
  permits,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { StatusTransitionService } from '../execution/status-transition.service';
import { IncidentLogService } from './incident-log.service';

const CANCELLABLE_PERMIT_STATUSES = [
  'pending_approval',
  'approved',
  'active',
  'suspended',
] as const;

@Injectable()
export class IncidentSeverityLifecycleService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly statusTransitionService: StatusTransitionService,
    private readonly auditService: AuditService,
    private readonly logService: IncidentLogService,
  ) {}

  /** FR-INC-011: apply structurally different severity paths on submission. */
  async applyOnSubmit(
    incidentId: string,
    tenantId: string,
    actorId: string,
    severityPath: string,
  ): Promise<'open' | 'pending_hod_decision'> {
    const permitIds = await this.getLinkedPermitIds(incidentId, tenantId);

    if (severityPath === 'accident') {
      await this.cancelLinkedPermits(
        permitIds,
        tenantId,
        actorId,
        'Linked accident incident — automatic permit cancellation',
        'incident.accident_auto_cancel',
        incidentId,
      );
      return 'open';
    }

    return 'pending_hod_decision';
  }

  /** HOD continue/stop decision for near-miss severity path. */
  async recordHodDecision(
    incidentId: string,
    tenantId: string,
    actorId: string,
    decision: 'continue' | 'stop',
    comment?: string,
  ): Promise<void> {
    const permitIds = await this.getLinkedPermitIds(incidentId, tenantId);

    await this.db.transaction(async (tx) => {
      await tx.insert(incidentHodDecisions).values({
        tenantId,
        incidentId,
        decision,
        decidedBy: actorId,
        comment: comment ?? null,
        createdBy: actorId,
      });

      if (decision === 'stop') {
        await this.cancelLinkedPermits(
          permitIds,
          tenantId,
          actorId,
          'HOD stop decision on near-miss incident',
          'incident.near_miss_hod_stop',
          incidentId,
          tx,
        );
      }
    });

    await this.auditService.log({
      action: `incident.hod_decision.${decision}`,
      entityType: 'incident',
      entityId: incidentId,
      userId: actorId,
      tenantId,
      metadata: { decision, comment },
    });

    this.logService.logEvent({
      action: `incident.hod_decision.${decision}`,
      incidentId,
      tenantId,
      userId: actorId,
      metadata: { decision },
    });
  }

  private async getLinkedPermitIds(incidentId: string, tenantId: string): Promise<string[]> {
    const rows = await this.db
      .select({ permitId: incidentPermits.permitId })
      .from(incidentPermits)
      .where(
        and(eq(incidentPermits.incidentId, incidentId), eq(incidentPermits.tenantId, tenantId)),
      );

    return rows.map((row) => row.permitId);
  }

  private async cancelLinkedPermits(
    permitIds: string[],
    tenantId: string,
    actorId: string,
    comment: string,
    auditAction: string,
    incidentId: string,
    db: Database = this.db,
  ): Promise<void> {
    if (permitIds.length === 0) {
      return;
    }

    const linkedPermits = await db
      .select()
      .from(permits)
      .where(
        and(eq(permits.tenantId, tenantId), inArray(permits.id, permitIds)),
      );

    for (const permit of linkedPermits) {
      if (
        !CANCELLABLE_PERMIT_STATUSES.includes(
          permit.status as (typeof CANCELLABLE_PERMIT_STATUSES)[number],
        )
      ) {
        continue;
      }

      if (permit.status === 'active' || permit.status === 'suspended') {
        const [execution] = await db
          .select()
          .from(permitExecution)
          .where(eq(permitExecution.permitId, permit.id))
          .limit(1);

        if (execution && !execution.suspendedAt) {
          await db
            .update(permitExecution)
            .set({
              suspendedAt: new Date(),
              suspendedBy: actorId,
              suspensionReason: comment,
              updatedBy: actorId,
            })
            .where(eq(permitExecution.id, execution.id));
        }
      }

      await this.statusTransitionService.transition(
        {
          permitId: permit.id,
          tenantId,
          action: 'cancelled',
          fromStatus: permit.status,
          toStatus: 'cancelled',
          actorId,
          comment,
          metadata: { incidentId, source: auditAction },
        },
        db,
      );

      await this.auditService.log({
        action: auditAction,
        entityType: 'permit',
        entityId: permit.id,
        userId: actorId,
        tenantId,
        metadata: { incidentId, fromStatus: permit.status },
      });
    }
  }
}
