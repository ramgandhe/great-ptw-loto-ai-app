import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  permits,
  tenantUsers,
  workflowAssignments,
  workflowSteps,
  type NotificationEventType,
} from '../../database/schema';
import type { ApprovalNotificationPayload } from '../approval/notification.service';
import type { LototoNotificationPayload } from '../lototo/notification.service';
import type { ValidityNotificationPayload } from '../revalidation/revalidation-notification.service';
import { KeycloakAdminService } from '../../infrastructure/keycloak/keycloak-admin.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class CanonicalNotificationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
    private readonly keycloakAdmin: KeycloakAdminService,
  ) {}

  async fromApprovalPayload(payload: ApprovalNotificationPayload): Promise<void> {
    const eventType = this.mapApprovalEvent(payload.action);
    if (!eventType) {
      return;
    }

    // Waiting for approval (submitted, or moved to the next stage): tell the people who approve next.
    const awaitingApproval = eventType === 'permit_submitted';
    const recipients = awaitingApproval
      ? await this.resolveNextApprovers(payload.permitId, payload.tenantId, payload.actorId)
      : await this.resolvePermitRecipients(payload.permitId, payload.tenantId, payload.actorId);
    if (recipients.length === 0) {
      return;
    }
    const [permit] = await this.db
      .select({ reference: permits.reference, title: permits.title })
      .from(permits)
      .where(and(eq(permits.id, payload.permitId), eq(permits.tenantId, payload.tenantId)));
    const name = permit ? `${permit.reference ?? 'Permit'}: ${permit.title}` : 'A permit';

    await this.notificationsService.generateSystem(payload.tenantId, payload.actorId, {
      eventType,
      category: 'workflow',
      priority: payload.action === 'safety_veto' ? 'high' : 'medium',
      title: this.approvalTitle(payload.action),
      body: awaitingApproval ? `${name} is waiting for your approval.` : `${name} was ${payload.action.replace('_', ' ')}.`,
      recipientUserIds: recipients,
      entityType: 'permit',
      entityId: payload.permitId,
      // Each submission and each stage is its own message; retries of the same job stay deduplicated.
      dedupeKey: `${payload.tenantId}:permit:${payload.permitId}:${eventType}:${payload.action}:${String(payload.metadata?.workflowStepId ?? payload.metadata?.submittedAt ?? '')}`,
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
      case 'submitted':
      case 'resubmitted':
      case 'stage_advanced':
        return 'permit_submitted';
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
      case 'submitted':
      case 'resubmitted':
      case 'stage_advanced':
        return 'Permit waiting for your approval';
      default:
        return 'Permit workflow update';
    }
  }

  /**
   * People holding the role of the active approval stage. An HOD only hears about their own
   * department (or every department when they have none), matching what their queue shows.
   */
  private async resolveNextApprovers(permitId: string, tenantId: string, actorId: string): Promise<string[]> {
    const active = await this.db
      .select({ role: workflowSteps.approverRole, slot: workflowAssignments.assignmentSlot })
      .from(workflowAssignments)
      .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
      .where(and(eq(workflowAssignments.permitId, permitId), eq(workflowAssignments.status, 'active')));
    const roles = [...new Set(active.map((row) => (row.slot && row.slot !== 'default' ? row.slot : row.role)))];
    if (roles.length === 0) {
      return [];
    }
    const [permit] = await this.db
      .select({ departmentId: permits.departmentId })
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));
    // Roles live in Keycloak (seeded and invited users alike); departments live on tenant_users.
    const [people, departments] = await Promise.all([
      this.keycloakAdmin.listUsersForTenant(tenantId).catch(() => []),
      this.db
        .select({ id: tenantUsers.keycloakUserId, departmentId: tenantUsers.departmentId })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId)),
    ]);
    const departmentOf = new Map(departments.map((row) => [row.id, row.departmentId]));
    return people
      .filter((person) => person.enabled && person.id !== actorId && person.roles.some((role) => roles.includes(role)))
      .filter((person) => {
        const department = departmentOf.get(person.id);
        return !permit?.departmentId || !department || department === permit.departmentId;
      })
      .map((person) => person.id);
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
