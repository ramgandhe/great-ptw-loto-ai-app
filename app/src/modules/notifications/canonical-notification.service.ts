import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permits, type NotificationEventType } from '../../database/schema';
import type { ApprovalNotificationPayload } from '../approval/notification.service';
import type { LototoNotificationPayload } from '../lototo/notification.service';
import type { ValidityNotificationPayload } from '../revalidation/revalidation-notification.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class CanonicalNotificationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
  ) {}

  async fromApprovalPayload(payload: ApprovalNotificationPayload): Promise<void> {
    const eventType = this.mapApprovalEvent(payload.action);
    if (!eventType) {
      return;
    }

    const recipients = await this.resolvePermitRecipients(
      payload.permitId,
      payload.tenantId,
      payload.actorId,
    );

    await this.notificationsService.generateSystem(payload.tenantId, payload.actorId, {
      eventType,
      category: 'workflow',
      priority: payload.action === 'safety_veto' ? 'high' : 'medium',
      title: this.approvalTitle(payload.action),
      body: this.approvalBody(payload),
      recipientUserIds: recipients,
      entityType: 'permit',
      entityId: payload.permitId,
      dedupeKey: `${payload.tenantId}:permit:${payload.permitId}:${eventType}:${payload.action}`,
      sourceModule: 'approval',
    });
  }

  async fromValidityPayload(payload: ValidityNotificationPayload): Promise<void> {
    if (!payload.issuerId) {
      return;
    }

    const title =
      payload.validityState === 'expired'
        ? `Permit ${payload.reference ?? payload.permitId} has expired`
        : `Permit ${payload.reference ?? payload.permitId} renewal due`;

    const body =
      payload.validityState === 'expired'
        ? 'The approved validity window has ended. Initiate renewal to continue work.'
        : `Less than 48 hours remain before expiry (${payload.hoursRemaining?.toFixed(1) ?? '?'}h left).`;

    await this.notificationsService.generateSystem(payload.tenantId, payload.issuerId, {
      eventType: 'permit_expiry',
      category: payload.validityState === 'expired' ? 'escalation' : 'reminder',
      priority: payload.validityState === 'expired' ? 'high' : 'medium',
      title,
      body,
      recipientUserIds: [payload.issuerId],
      entityType: 'permit',
      entityId: payload.permitId,
      dedupeKey: `${payload.tenantId}:permit:${payload.permitId}:permit_expiry:${payload.validityState}:${payload.operationalDate}`,
      sourceModule: 'revalidation',
    });
  }

  async fromLototoPayload(payload: LototoNotificationPayload): Promise<void> {
    await this.notificationsService.generateSystem(payload.tenantId, payload.actorId, {
      eventType: 'lototo_verification',
      category: 'workflow',
      priority: 'medium',
      title: `LOTOTO activity: ${payload.action.replace(/_/g, ' ')}`,
      body: `LOTOTO plan requires attention for permit-linked isolation work.`,
      recipientUserIds: [payload.actorId],
      entityType: 'lototo_plan',
      entityId: payload.planId,
      dedupeKey: `${payload.tenantId}:lototo:${payload.planId}:${payload.action}`,
      sourceModule: 'lototo',
    });
  }

  async fromSimopsConflict(params: {
    tenantId: string;
    conflictId: string;
    actorId: string;
    permitIds: string[];
    severity: string;
    summary: string;
  }): Promise<void> {
    const recipients = await this.resolvePermitRecipientsForPermits(
      params.permitIds,
      params.tenantId,
      params.actorId,
    );

    await this.notificationsService.generateSystem(params.tenantId, params.actorId, {
      eventType: 'simops_conflict',
      category: 'escalation',
      priority: params.severity === 'high' ? 'critical' : 'high',
      title: `SIMOPS conflict detected (${params.severity})`,
      body: params.summary,
      recipientUserIds: recipients,
      entityType: 'simops_conflict',
      entityId: params.conflictId,
      dedupeKey: `${params.tenantId}:simops:${params.conflictId}:detected`,
      sourceModule: 'simops',
    });
  }

  async fromBillingRenewal(params: {
    tenantId: string;
    subscriptionId: string;
    adminUserId: string;
    renewAt: Date;
    horizonDays: number;
  }): Promise<void> {
    const renewDate = params.renewAt.toISOString().slice(0, 10);

    await this.notificationsService.generateSystem(params.tenantId, params.adminUserId, {
      eventType: 'task_reminder',
      category: 'reminder',
      priority: 'medium',
      title: 'Subscription renewal due',
      body: `Your organisation subscription renews on ${renewDate} (within ${params.horizonDays} days). Review billing details before renewal.`,
      recipientUserIds: [params.adminUserId],
      entityType: 'tenant_subscription',
      entityId: params.subscriptionId,
      dedupeKey: `${params.tenantId}:billing:${params.subscriptionId}:renewal:${renewDate}`,
      sourceModule: 'billing',
    });
  }

  async fromIncidentReported(params: {
    tenantId: string;
    incidentId: string;
    actorId: string;
    reference: string | null;
    severityPath: string;
  }): Promise<void> {
    await this.notificationsService.generateSystem(params.tenantId, params.actorId, {
      eventType: 'incident_reported',
      category: 'workflow',
      priority: params.severityPath === 'accident' ? 'critical' : 'high',
      title: `Incident reported${params.reference ? `: ${params.reference}` : ''}`,
      body: `A ${params.severityPath.replace(/_/g, ' ')} has been submitted for review.`,
      recipientUserIds: [params.actorId],
      entityType: 'incident',
      entityId: params.incidentId,
      dedupeKey: `${params.tenantId}:incident:${params.incidentId}:reported`,
      sourceModule: 'incidents',
    });
  }

  private mapApprovalEvent(action: string): NotificationEventType | null {
    switch (action) {
      case 'approved':
        return 'permit_approved';
      case 'rejected':
      case 'safety_veto':
        return 'permit_rejected';
      case 'deferred':
        return 'permit_deferred';
      default:
        return null;
    }
  }

  private approvalTitle(action: string): string {
    switch (action) {
      case 'approved':
        return 'Permit approved';
      case 'rejected':
        return 'Permit rejected';
      case 'deferred':
        return 'Permit deferred';
      case 'safety_veto':
        return 'Permit vetoed by Safety Officer';
      default:
        return 'Permit workflow update';
    }
  }

  private approvalBody(payload: ApprovalNotificationPayload): string {
    return `Permit workflow action "${payload.action}" was recorded.`;
  }

  private async resolvePermitRecipients(
    permitId: string,
    tenantId: string,
    actorId: string,
  ): Promise<string[]> {
    const [permit] = await this.db
      .select({ submittedBy: permits.submittedBy })
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));

    const recipients = [actorId];
    if (permit?.submittedBy) {
      recipients.push(permit.submittedBy);
    }
    return [...new Set(recipients)];
  }

  private async resolvePermitRecipientsForPermits(
    permitIds: string[],
    tenantId: string,
    actorId: string,
  ): Promise<string[]> {
    if (permitIds.length === 0) {
      return [actorId];
    }

    const rows = await this.db
      .select({ submittedBy: permits.submittedBy })
      .from(permits)
      .where(and(eq(permits.tenantId, tenantId), inArray(permits.id, permitIds)));

    const recipients = [actorId, ...rows.map((row) => row.submittedBy).filter(Boolean)];
    return [...new Set(recipients)] as string[];
  }
}
