import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  notificationRecipients,
  notifications,
  organisations,
  permitExecutors,
  permitHazards,
  permitPpe,
  permitRenewals,
  permitValidityChecks,
  permits,
  revalidationHistory,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  DEFAULT_TENANT_TIMEZONE,
  evaluateValidityDecision,
  isExpiredOrOutOfRange,
  operationalDateInTimezone,
} from './validity-rules';
import { RevalidationLogService } from './revalidation-log.service';
import { MDP_SYSTEM_ACTOR_ID } from './revalidation.constants';

@Injectable()
export class ValidityTransitionService {
  private readonly logger = new Logger(ValidityTransitionService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly logService: RevalidationLogService,
  ) {}

  async resolveTenantTimezone(tenantId: string): Promise<string> {
    const [org] = await this.db
      .select({ timezone: organisations.timezone })
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId))
      .limit(1);

    return org?.timezone || DEFAULT_TENANT_TIMEZONE;
  }

  /**
   * FR-MDP-009 — run day-transition validity checks for all active permits.
   * Idempotent per permit × operational day (unique index).
   */
  async runDayTransition(now = new Date(), actorId = MDP_SYSTEM_ACTOR_ID) {
    const active = await this.db
      .select()
      .from(permits)
      .where(eq(permits.status, 'active'));

    let checked = 0;
    let skipped = 0;
    let expired = 0;
    let notified = 0;

    for (const permit of active) {
      const result = await this.checkPermit(permit, now, actorId);
      if (result === 'skipped') {
        skipped += 1;
      } else {
        checked += 1;
        if (result === 'expired') expired += 1;
        if (result === 'notified') notified += 1;
      }
    }

    this.logger.log(
      `FR-MDP-009 day-transition: checked=${checked} skipped=${skipped} expired=${expired} notified=${notified}`,
    );

    return { checked, skipped, expired, notified };
  }

  async checkPermit(
    permit: typeof permits.$inferSelect,
    now = new Date(),
    actorId = MDP_SYSTEM_ACTOR_ID,
  ): Promise<'checked' | 'skipped' | 'expired' | 'notified'> {
    const timezone = await this.resolveTenantTimezone(permit.tenantId);
    const operationalDate = operationalDateInTimezone(now, timezone);
    const evaluation = evaluateValidityDecision(
      permit.plannedStartAt,
      permit.plannedEndAt,
      now,
    );

    const existing = await this.db
      .select({ id: permitValidityChecks.id })
      .from(permitValidityChecks)
      .where(
        and(
          eq(permitValidityChecks.tenantId, permit.tenantId),
          eq(permitValidityChecks.permitId, permit.id),
          eq(permitValidityChecks.operationalDate, operationalDate),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return 'skipped';
    }

    const revalidationRequired =
      evaluation.decision === 'ok_gt_48h' || evaluation.decision === 'renew_notify_lte_48h';

    const [row] = await this.db
      .insert(permitValidityChecks)
      .values({
        tenantId: permit.tenantId,
        permitId: permit.id,
        operationalDate,
        timezone,
        decision: evaluation.decision,
        remainingHours:
          evaluation.remainingHours == null ? null : Math.round(evaluation.remainingHours),
        plannedEndAt: permit.plannedEndAt,
        revalidationRequired,
        checkedAt: now,
        createdBy: actorId,
        updatedBy: actorId,
        metadata: {
          plannedStartAt: permit.plannedStartAt?.toISOString() ?? null,
        },
      })
      .returning();

    await this.db.insert(revalidationHistory).values({
      tenantId: permit.tenantId,
      permitId: permit.id,
      eventType: 'validity_checked',
      actorId,
      payload: {
        validityCheckId: row.id,
        decision: evaluation.decision,
        operationalDate,
        timezone,
        remainingHours: evaluation.remainingHours,
        revalidationRequired,
      },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: 'mdp.validity_checked',
      entityType: 'permit',
      entityId: permit.id,
      userId: actorId,
      tenantId: permit.tenantId,
      metadata: {
        decision: evaluation.decision,
        operationalDate,
        timezone,
      },
    });

    this.logService.logEvent({
      action: 'mdp.validity_checked',
      permitId: permit.id,
      tenantId: permit.tenantId,
      userId: actorId,
      metadata: { decision: evaluation.decision, operationalDate },
    });

    if (evaluation.decision === 'renew_notify_lte_48h') {
      await this.notifyIssuerRenew(permit, row.id, operationalDate, actorId);
      await this.db
        .update(permitValidityChecks)
        .set({ notifiedAt: now, updatedBy: actorId })
        .where(eq(permitValidityChecks.id, row.id));
      return 'notified';
    }

    if (isExpiredOrOutOfRange(evaluation.decision)) {
      await this.markExpiredAndCreateRenewal(permit, actorId, evaluation.decision);
      return 'expired';
    }

    return 'checked';
  }

  private async notifyIssuerRenew(
    permit: typeof permits.$inferSelect,
    validityCheckId: string,
    operationalDate: string,
    actorId: string,
  ) {
    const recipientId = permit.submittedBy ?? permit.createdBy;
    if (!recipientId) {
      return;
    }

    const dedupeKey = `permit_expiry:${permit.id}:${operationalDate}`;
    try {
      const [notification] = await this.db
        .insert(notifications)
        .values({
          tenantId: permit.tenantId,
          eventType: 'permit_expiry',
          category: 'reminder',
          priority: 'high',
          title: 'Permit renewal required',
          body: `Permit ${permit.reference ?? permit.id} has ≤48 hours remaining. Please renew before expiry.`,
          entityType: 'permit',
          entityId: permit.id,
          dedupeKey,
          sourceModule: 'mdp',
          createdBy: actorId,
          updatedBy: actorId,
        })
        .onConflictDoNothing()
        .returning();

      if (notification) {
        await this.db.insert(notificationRecipients).values({
          tenantId: permit.tenantId,
          notificationId: notification.id,
          userId: recipientId,
          channel: 'in_app',
          deliveryStatus: 'pending',
          createdBy: actorId,
          updatedBy: actorId,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Could not notify issuer for validity check ${validityCheckId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async markExpiredAndCreateRenewal(
    permit: typeof permits.$inferSelect,
    actorId: string,
    decision: string,
  ) {
    await this.db
      .update(permits)
      .set({ status: 'expired', updatedBy: actorId })
      .where(and(eq(permits.id, permit.id), eq(permits.tenantId, permit.tenantId)));

    await this.db.insert(revalidationHistory).values({
      tenantId: permit.tenantId,
      permitId: permit.id,
      eventType: 'permit_suspended',
      actorId,
      payload: { reason: `validity_${decision}`, status: 'expired' },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: 'mdp.permit_expired',
      entityType: 'permit',
      entityId: permit.id,
      userId: actorId,
      tenantId: permit.tenantId,
      metadata: { decision },
    });

    const open = await this.db
      .select({ id: permitRenewals.id })
      .from(permitRenewals)
      .where(
        and(
          eq(permitRenewals.tenantId, permit.tenantId),
          eq(permitRenewals.sourcePermitId, permit.id),
          inArray(permitRenewals.status, ['draft', 'pending_approval']),
        ),
      )
      .limit(1);

    if (open.length === 0) {
      await this.createRenewalDraft(permit.id, permit.tenantId, actorId);
    }
  }

  /**
   * FR-MDP-009 expired renewal — copy template from original; only updatable fields stay editable.
   */
  async createRenewalDraft(sourcePermitId: string, tenantId: string, actorId: string) {
    const [source] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, sourcePermitId), eq(permits.tenantId, tenantId)))
      .limit(1);

    if (!source) {
      throw new Error('Source permit not found');
    }

    const [renewalPermit] = await this.db
      .insert(permits)
      .values({
        tenantId,
        status: 'draft',
        permitTypeId: source.permitTypeId,
        title: source.title,
        workScope: source.workScope,
        plantId: source.plantId,
        departmentId: source.departmentId,
        locationId: source.locationId,
        workstationId: source.workstationId,
        machineryId: source.machineryId,
        plannedStartAt: source.plannedStartAt,
        plannedEndAt: source.plannedEndAt,
        renewedFromPermitId: source.id,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    const hazards = await this.db
      .select()
      .from(permitHazards)
      .where(eq(permitHazards.permitId, source.id));
    if (hazards.length > 0) {
      await this.db.insert(permitHazards).values(
        hazards.map((row) => ({
          permitId: renewalPermit.id,
          hazardCategoryId: row.hazardCategoryId,
          description: row.description,
          createdBy: actorId,
          updatedBy: actorId,
        })),
      );
    }

    const ppe = await this.db.select().from(permitPpe).where(eq(permitPpe.permitId, source.id));
    if (ppe.length > 0) {
      await this.db.insert(permitPpe).values(
        ppe.map((row) => ({
          permitId: renewalPermit.id,
          ppeCatalogueId: row.ppeCatalogueId,
          quantity: row.quantity,
          createdBy: actorId,
          updatedBy: actorId,
        })),
      );
    }

    const executors = await this.db
      .select()
      .from(permitExecutors)
      .where(eq(permitExecutors.permitId, source.id));
    if (executors.length > 0) {
      await this.db.insert(permitExecutors).values(
        executors.map((row) => ({
          permitId: renewalPermit.id,
          workforceUserId: row.workforceUserId,
          isPrimary: row.isPrimary,
          createdBy: actorId,
          updatedBy: actorId,
        })),
      );
    }

    const [renewal] = await this.db
      .insert(permitRenewals)
      .values({
        tenantId,
        sourcePermitId: source.id,
        renewalPermitId: renewalPermit.id,
        status: 'draft',
        requestedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db.insert(revalidationHistory).values({
      tenantId,
      permitId: source.id,
      eventType: 'renewal_created',
      actorId,
      payload: { renewalId: renewal.id, renewalPermitId: renewalPermit.id },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: 'mdp.renewal_created',
      entityType: 'permit_renewal',
      entityId: renewal.id,
      userId: actorId,
      tenantId,
      metadata: { sourcePermitId: source.id, renewalPermitId: renewalPermit.id },
    });

    return { renewal, renewalPermit };
  }
}
