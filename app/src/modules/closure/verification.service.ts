import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { KeycloakAdminService } from '../../infrastructure/keycloak/keycloak-admin.service';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  auditHistory,
  permitVerifications,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { PermitCacheService } from '../permit/permit-cache.service';
import { PermitLototoExecutionService } from '../permit/permit-lototo-execution.service';
import { PermitService } from '../permit/permit.service';
import { StatusTransitionService } from '../execution/status-transition.service';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import { NotificationsService as InboxNotificationsService } from '../notifications/notifications.service';
import { CLOSURE_CLOSE_ROLES, EXECUTION_COMPLETED_STATUS, PENDING_CLOSURE_STATUS } from './closure.constants';
import { ClosureCacheService } from './closure-cache.service';
import { ClosureLogService } from './closure-log.service';
import { VerificationDto } from './dto/verification.dto';
import { NotificationService } from './notification.service';

@Injectable()
export class VerificationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly lototoExecutionService: PermitLototoExecutionService,
    private readonly statusTransitionService: StatusTransitionService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
    private readonly closureCacheService: ClosureCacheService,
    private readonly closureLogService: ClosureLogService,
    private readonly notificationService: NotificationService,
    @Optional()
    @Inject(InboxNotificationsService)
    private readonly inbox?: InboxNotificationsService,
    @Optional()
    @Inject(KeycloakAdminService)
    private readonly keycloakAdmin?: KeycloakAdminService,
  ) {}

  async verify(permitId: string, dto: VerificationDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== EXECUTION_COMPLETED_STATUS) {
      throw new ConflictException('Only execution-completed permits can be verified');
    }

    if (
      !isTenantPrivileged(user.roles) &&
      !user.roles.includes('platform-admin') &&
      !(user.roles.includes('permit-receiver') && (permit.createdBy === user.id || permit.submittedBy === user.id))
    ) {
      throw new ForbiddenException('Only the permit issuer can verify execution');
    }

    this.assertChecklistComplete(dto);
    await this.lototoExecutionService.assertRestorationComplete(permitId, user);

    const [existing] = await this.db
      .select()
      .from(permitVerifications)
      .where(eq(permitVerifications.permitId, permitId));

    if (existing) {
      throw new ConflictException('Permit has already been verified');
    }

    const verification = await this.db.transaction(async (tx) => {
      // The issuer may sign closure-stage fields here; the HOD's closure requires them.
      await this.permitService.saveStageAnswers(tx, {
        permitId,
        tenantId,
        user,
        stage: 'closure',
        status: EXECUTION_COMPLETED_STATUS,
        input: dto.stageAnswers,
      });
      const [record] = await tx
        .insert(permitVerifications)
        .values({
          permitId,
          verifiedBy: user.id,
          comment: dto.comment ?? null,
          checklist: { ...dto.checklist },
          createdBy: user.id,
        })
        .returning();

      await this.statusTransitionService.transition(
        {
          permitId,
          tenantId,
          action: 'verified',
          fromStatus: EXECUTION_COMPLETED_STATUS,
          toStatus: PENDING_CLOSURE_STATUS,
          actorId: user.id,
          comment: dto.comment.trim(),
          metadata: { checklist: dto.checklist },
        },
        tx,
      );

      await tx.insert(auditHistory).values({
        permitId,
        action: 'permit.verified',
        actorId: user.id,
        comment: dto.comment ?? null,
        metadata: { checklist: dto.checklist },
        createdBy: user.id,
      });

      return record;
    });

    await this.auditService.log({
      action: 'permit.verified',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
      metadata: { verificationId: verification.id },
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.closureCacheService.invalidatePermit(tenantId, permitId);

    await this.notificationService.enqueueClosureNotification({
      permitId,
      tenantId,
      action: 'verified',
      actorId: user.id,
      metadata: { verificationId: verification.id },
    });
    await this.notifySignOff(tenantId, user.id, permit.title, permitId, verification.id);

    this.closureLogService.logEvent({
      action: 'closure.verified',
      permitId,
      tenantId,
      userId: user.id,
      metadata: { verificationId: verification.id },
    });

    return {
      verification: this.serializeVerification(verification),
      permit: { ...permit, status: PENDING_CLOSURE_STATUS },
    };
  }

  async getVerification(permitId: string, user: AuthenticatedUser) {
    await this.permitService.findOne(permitId, user);
    return this.findByPermit(permitId);
  }

  async findByPermit(permitId: string) {
    const [verification] = await this.db
      .select()
      .from(permitVerifications)
      .where(eq(permitVerifications.permitId, permitId));

    return verification ? this.serializeVerification(verification) : null;
  }

  private assertChecklistComplete(dto: VerificationDto) {
    const { checklist } = dto;
    const complete =
      checklist.workCompleted &&
      checklist.evidenceReviewed &&
      checklist.areaSecured &&
      checklist.hazardsRemoved;

    if (!complete) {
      throw new ConflictException('All verification checklist items must be completed');
    }
  }

  private serializeVerification(verification: typeof permitVerifications.$inferSelect) {
    return {
      id: verification.id,
      permitId: verification.permitId,
      verifiedBy: verification.verifiedBy,
      verifiedAt: verification.verifiedAt.toISOString(),
      comment: verification.comment,
      checklist: verification.checklist,
    };
  }

  private async notifySignOff(
    tenantId: string,
    actorId: string,
    title: string,
    permitId: string,
    verificationId: string,
  ) {
    if (!this.inbox || !this.keycloakAdmin) {
      return;
    }
    try {
      const closeRoles = new Set<string>(CLOSURE_CLOSE_ROLES);
      const people = await this.keycloakAdmin.listUsersForTenant(tenantId);
      const recipients = people
        .filter((person) => person.enabled && person.id !== actorId && person.roles.some((role) => closeRoles.has(role)))
        .map((person) => person.id);
      if (recipients.length === 0) {
        return;
      }
      await this.inbox.generateSystem(tenantId, actorId, {
        eventType: 'task_reminder',
        category: 'workflow',
        title: `Final sign-off: ${title}`,
        body: `Permit "${title}" is ready for final sign-off.`,
        recipientUserIds: recipients,
        entityType: 'permit',
        entityId: permitId,
        dedupeKey: `${tenantId}:permit:${permitId}:pending_closure:${verificationId}`,
        sourceModule: 'closure',
      });
    } catch {
      // The verification is already saved. A missed notice must not undo it.
    }
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
