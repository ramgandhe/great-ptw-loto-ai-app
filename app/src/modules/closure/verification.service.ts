import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  auditHistory,
  permitVerifications,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { PermitCacheService } from '../permit/permit-cache.service';
import { PermitService } from '../permit/permit.service';
import { StatusTransitionService } from '../execution/status-transition.service';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import { EXECUTION_COMPLETED_STATUS, PENDING_CLOSURE_STATUS } from './closure.constants';
import { ClosureCacheService } from './closure-cache.service';
import { ClosureLogService } from './closure-log.service';
import { VerificationDto } from './dto/verification.dto';
import { NotificationService } from './notification.service';

@Injectable()
export class VerificationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly statusTransitionService: StatusTransitionService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
    private readonly closureCacheService: ClosureCacheService,
    private readonly closureLogService: ClosureLogService,
    private readonly notificationService: NotificationService,
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
      !(user.roles.includes('job-issuer') && (permit.createdBy === user.id || permit.submittedBy === user.id))
    ) {
      throw new ForbiddenException('Only the permit issuer can verify execution');
    }

    this.assertChecklistComplete(dto);

    const [existing] = await this.db
      .select()
      .from(permitVerifications)
      .where(eq(permitVerifications.permitId, permitId));

    if (existing) {
      throw new ConflictException('Permit has already been verified');
    }

    const verification = await this.db.transaction(async (tx) => {
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

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
