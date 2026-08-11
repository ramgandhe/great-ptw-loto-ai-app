import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  incidentPermits,
  incidentSeverityHistory,
  incidentSeverityLifecycle,
  incidents,
  notificationRecipients,
  notifications,
  permits,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { IncidentCacheService } from './incident-cache.service';
import { IncidentLogService } from './incident-log.service';
import {
  CANCELABLE_PERMIT_STATUSES,
  INCIDENT_SYSTEM_ACTOR_ID,
} from './incidents.constants';

@Injectable()
export class IncidentSeverityLifecycleService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly cacheService: IncidentCacheService,
    private readonly logService: IncidentLogService,
  ) {}

  /**
   * Open the structural severity path when an incident is submitted.
   * Idempotent: existing lifecycle row is returned unchanged.
   */
  async openPathOnSubmit(
    incident: typeof incidents.$inferSelect,
    actorId: string,
  ): Promise<typeof incidentSeverityLifecycle.$inferSelect> {
    const existing = await this.getLifecycle(incident.id, incident.tenantId);
    if (existing) {
      return existing;
    }

    const lifecycleStatus =
      incident.severityPath === 'accident' ? 'auto_terminated' : 'awaiting_hod';

    const [row] = await this.db
      .insert(incidentSeverityLifecycle)
      .values({
        tenantId: incident.tenantId,
        incidentId: incident.id,
        severityPath: incident.severityPath,
        lifecycleStatus,
        appliedAt: incident.severityPath === 'accident' ? new Date() : null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.appendHistory(
      incident.tenantId,
      incident.id,
      'path_opened',
      actorId,
      null,
      { severityPath: incident.severityPath, lifecycleStatus },
    );

    await this.auditService.log({
      action: 'incident.severity.path_opened',
      entityType: 'incident',
      entityId: incident.id,
      userId: actorId,
      tenantId: incident.tenantId,
      metadata: { severityPath: incident.severityPath, lifecycleStatus },
    });

    if (incident.severityPath === 'accident') {
      await this.applyAccidentTermination(incident, INCIDENT_SYSTEM_ACTOR_ID);
    } else {
      await this.notifyHodNearMiss(incident, actorId);
    }

    await this.cacheService.invalidateIncident(incident.tenantId, incident.id);
    return row;
  }

  async decideNearMiss(
    incidentId: string,
    decision: 'continue' | 'stop',
    comments: string | undefined,
    user: AuthenticatedUser,
  ) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    if (user.roles?.includes('platform-admin') && !user.roles.includes('org-admin')) {
      // Negative AC: platform admin must not take operational HOD lifecycle actions.
      throw new ForbiddenException('Platform administrators cannot decide near-miss lifecycle');
    }

    const tenantId = user.tenantId;
    const actorId = user.id;
    if (!actorId) {
      throw new ForbiddenException('Authenticated actor is required');
    }

    const incident = await this.requireIncident(incidentId, tenantId);
    if (incident.severityPath !== 'near_miss') {
      throw new ConflictException(
        'HOD continue/stop applies only to the near-miss severity path',
      );
    }

    const lifecycle = await this.requireLifecycle(incidentId, tenantId);
    if (lifecycle.lifecycleStatus !== 'awaiting_hod') {
      throw new ConflictException('Near-miss HOD decision has already been recorded');
    }

    const now = new Date();
    const lifecycleStatus = decision === 'continue' ? 'continued' : 'stopped';
    const [updated] = await this.db
      .update(incidentSeverityLifecycle)
      .set({
        lifecycleStatus,
        hodDecision: decision,
        hodDecidedBy: actorId,
        hodDecidedAt: now,
        hodDecisionComments: comments ?? null,
        appliedAt: now,
        updatedBy: actorId,
        updatedAt: now,
      })
      .where(
        and(
          eq(incidentSeverityLifecycle.incidentId, incidentId),
          eq(incidentSeverityLifecycle.tenantId, tenantId),
        ),
      )
      .returning();

    const eventType = decision === 'continue' ? 'hod_continue' : 'hod_stop';
    await this.appendHistory(tenantId, incidentId, eventType, actorId, null, {
      comments: comments ?? null,
    });

    await this.auditService.log({
      action: `incident.severity.${eventType}`,
      entityType: 'incident_severity_lifecycle',
      entityId: updated.id,
      userId: actorId,
      tenantId,
      metadata: { incidentId, decision },
    });

    this.logService.logEvent({
      action: `incident.severity.${eventType}`,
      incidentId,
      tenantId,
      userId: actorId,
      metadata: { decision },
    });

    if (decision === 'stop') {
      await this.cancelLinkedPermits(incident, actorId, 'near_miss_hod_stop');
    }

    await this.cacheService.invalidateIncident(tenantId, incidentId);
    return { incident, lifecycle: updated };
  }

  async getLifecycleForIncident(incidentId: string, tenantId: string) {
    return this.getLifecycle(incidentId, tenantId);
  }

  async listHistory(incidentId: string, tenantId: string) {
    return this.db
      .select()
      .from(incidentSeverityHistory)
      .where(
        and(
          eq(incidentSeverityHistory.tenantId, tenantId),
          eq(incidentSeverityHistory.incidentId, incidentId),
        ),
      );
  }

  private async applyAccidentTermination(
    incident: typeof incidents.$inferSelect,
    actorId: string,
  ) {
    const lifecycle = await this.requireLifecycle(incident.id, incident.tenantId);
    if (lifecycle.permitsCancelledAt) {
      return; // idempotent retry
    }

    await this.cancelLinkedPermits(incident, actorId, 'accident_auto_terminate');

    await this.db
      .update(incidentSeverityLifecycle)
      .set({
        lifecycleStatus: 'auto_terminated',
        permitsCancelledAt: new Date(),
        appliedAt: lifecycle.appliedAt ?? new Date(),
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(incidentSeverityLifecycle.id, lifecycle.id));

    await this.appendHistory(
      incident.tenantId,
      incident.id,
      'accident_auto_terminated',
      actorId,
      null,
      { severityPath: 'accident' },
    );

    await this.auditService.log({
      action: 'incident.severity.accident_auto_terminated',
      entityType: 'incident',
      entityId: incident.id,
      userId: actorId,
      tenantId: incident.tenantId,
    });

    this.logService.logEvent({
      action: 'incident.severity.accident_auto_terminated',
      incidentId: incident.id,
      tenantId: incident.tenantId,
      userId: actorId,
    });

    await this.notifyAccident(incident, actorId);
  }

  private async cancelLinkedPermits(
    incident: typeof incidents.$inferSelect,
    actorId: string,
    reason: string,
  ) {
    const links = await this.db
      .select()
      .from(incidentPermits)
      .where(
        and(
          eq(incidentPermits.tenantId, incident.tenantId),
          eq(incidentPermits.incidentId, incident.id),
        ),
      );

    for (const link of links) {
      const [permit] = await this.db
        .select()
        .from(permits)
        .where(
          and(eq(permits.id, link.permitId), eq(permits.tenantId, incident.tenantId)),
        )
        .limit(1);

      if (!permit) {
        continue;
      }
      if (
        !CANCELABLE_PERMIT_STATUSES.includes(
          permit.status as (typeof CANCELABLE_PERMIT_STATUSES)[number],
        )
      ) {
        continue;
      }

      await this.db
        .update(permits)
        .set({ status: 'rejected', updatedBy: actorId, updatedAt: new Date() })
        .where(and(eq(permits.id, permit.id), eq(permits.tenantId, incident.tenantId)));

      await this.appendHistory(
        incident.tenantId,
        incident.id,
        'permit_cancelled',
        actorId,
        permit.id,
        { previousStatus: permit.status, reason },
      );

      await this.auditService.log({
        action: 'incident.severity.permit_cancelled',
        entityType: 'permit',
        entityId: permit.id,
        userId: actorId,
        tenantId: incident.tenantId,
        metadata: { incidentId: incident.id, reason, previousStatus: permit.status },
      });
    }

    await this.db
      .update(incidentSeverityLifecycle)
      .set({
        permitsCancelledAt: new Date(),
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(incidentSeverityLifecycle.incidentId, incident.id),
          eq(incidentSeverityLifecycle.tenantId, incident.tenantId),
        ),
      );
  }

  private async notifyHodNearMiss(
    incident: typeof incidents.$inferSelect,
    actorId: string,
  ) {
    const dedupeKey = `incident_near_miss_hod:${incident.id}`;
    try {
      const [notification] = await this.db
        .insert(notifications)
        .values({
          tenantId: incident.tenantId,
          eventType: 'incident_reported',
          category: 'escalation',
          priority: 'high',
          title: 'Near-miss requires HOD decision',
          body: `${incident.reference}: decide Continue or Stop before work proceeds.`,
          entityType: 'incident',
          entityId: incident.id,
          dedupeKey,
          sourceModule: 'incident',
          createdBy: actorId,
          updatedBy: actorId,
        })
        .onConflictDoNothing()
        .returning();

      if (notification && incident.reportedBy) {
        await this.db.insert(notificationRecipients).values({
          tenantId: incident.tenantId,
          notificationId: notification.id,
          userId: incident.reportedBy,
          channel: 'in_app',
          deliveryStatus: 'pending',
          createdBy: actorId,
          updatedBy: actorId,
        });
      }
    } catch {
      // notification failure must not roll back severity path
    }
  }

  private async notifyAccident(incident: typeof incidents.$inferSelect, actorId: string) {
    const dedupeKey = `incident_accident_terminated:${incident.id}`;
    try {
      await this.db
        .insert(notifications)
        .values({
          tenantId: incident.tenantId,
          eventType: 'incident_reported',
          category: 'escalation',
          priority: 'critical',
          title: 'Accident — task terminated',
          body: `${incident.reference}: linked permits cancelled automatically (FR-INC-011).`,
          entityType: 'incident',
          entityId: incident.id,
          dedupeKey,
          sourceModule: 'incident',
          createdBy: actorId,
          updatedBy: actorId,
        })
        .onConflictDoNothing();
    } catch {
      // best-effort
    }
  }

  private async appendHistory(
    tenantId: string,
    incidentId: string,
    eventType: string,
    actorId: string,
    permitId: string | null,
    payload?: Record<string, unknown>,
  ) {
    await this.db.insert(incidentSeverityHistory).values({
      tenantId,
      incidentId,
      eventType: eventType as never,
      actorId,
      permitId,
      payload: payload ?? null,
      createdBy: actorId,
    });
  }

  private async getLifecycle(incidentId: string, tenantId: string) {
    const [row] = await this.db
      .select()
      .from(incidentSeverityLifecycle)
      .where(
        and(
          eq(incidentSeverityLifecycle.incidentId, incidentId),
          eq(incidentSeverityLifecycle.tenantId, tenantId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async requireLifecycle(incidentId: string, tenantId: string) {
    const row = await this.getLifecycle(incidentId, tenantId);
    if (!row) {
      throw new NotFoundException('Severity lifecycle not found for incident');
    }
    return row;
  }

  private async requireIncident(id: string, tenantId: string) {
    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, id), eq(incidents.tenantId, tenantId)))
      .limit(1);
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }
}
