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
  permitArchive,
  permitClosures,
  permitVerifications,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { PermitCacheService } from '../permit/permit-cache.service';
import { PermitService } from '../permit/permit.service';
import { StatusTransitionService } from '../execution/status-transition.service';
import { ACTIVE_STATUS, CLOSED_STATUS } from './closure.constants';
import { ClosureCacheService } from './closure-cache.service';
import { ClosureLogService } from './closure-log.service';
import { ClosePermitDto } from './dto/close-permit.dto';
import { NotificationService } from './notification.service';

@Injectable()
export class ClosureService {
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

  async close(permitId: string, dto: ClosePermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== ACTIVE_STATUS) {
      throw new ConflictException('Only active permits can be closed');
    }

    const [verification] = await this.db
      .select()
      .from(permitVerifications)
      .where(eq(permitVerifications.permitId, permitId));

    if (!verification) {
      throw new ConflictException('Permit must be verified before closure');
    }

    const [existingClosure] = await this.db
      .select()
      .from(permitClosures)
      .where(eq(permitClosures.permitId, permitId));

    if (existingClosure) {
      throw new ConflictException('Permit is already closed');
    }

    const actualEndAt = dto.actualEndAt ? new Date(dto.actualEndAt) : new Date();

    const closure = await this.db.transaction(async (tx) => {
      const [record] = await tx
        .insert(permitClosures)
        .values({
          permitId,
          closedBy: user.id,
          actualEndAt,
          comment: dto.comment ?? null,
          createdBy: user.id,
        })
        .returning();

      await this.statusTransitionService.transition(
        {
          permitId,
          tenantId,
          action: 'closed',
          fromStatus: ACTIVE_STATUS,
          toStatus: CLOSED_STATUS,
          actorId: user.id,
          comment: dto.comment,
          metadata: { actualEndAt: actualEndAt.toISOString() },
        },
        tx,
      );

      await tx.insert(permitArchive).values({
        tenantId,
        permitId,
        title: permit.title,
        reference: permit.reference,
        closedAt: record.closedAt,
        closedBy: user.id,
      });

      await tx.insert(auditHistory).values({
        permitId,
        action: 'permit.closed',
        actorId: user.id,
        comment: dto.comment ?? null,
        metadata: {
          closureId: record.id,
          actualEndAt: actualEndAt.toISOString(),
        },
        createdBy: user.id,
      });

      return record;
    });

    await this.auditService.log({
      action: 'permit.closed',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
      metadata: { closureId: closure.id, actualEndAt: actualEndAt.toISOString() },
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);
    await this.closureCacheService.invalidatePermit(tenantId, permitId);

    await this.notificationService.enqueueClosureNotification({
      permitId,
      tenantId,
      action: 'closed',
      actorId: user.id,
      metadata: { closureId: closure.id },
    });

    this.closureLogService.logEvent({
      action: 'closure.closed',
      permitId,
      tenantId,
      userId: user.id,
      metadata: { closureId: closure.id },
    });

    return {
      closure: this.serializeClosure(closure),
      permit: { ...permit, status: CLOSED_STATUS },
    };
  }

  async findByPermit(permitId: string) {
    const [closure] = await this.db
      .select()
      .from(permitClosures)
      .where(eq(permitClosures.permitId, permitId));

    return closure ? this.serializeClosure(closure) : null;
  }

  private serializeClosure(closure: typeof permitClosures.$inferSelect) {
    return {
      id: closure.id,
      permitId: closure.permitId,
      closedBy: closure.closedBy,
      closedAt: closure.closedAt.toISOString(),
      actualEndAt: closure.actualEndAt.toISOString(),
      comment: closure.comment,
    };
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
