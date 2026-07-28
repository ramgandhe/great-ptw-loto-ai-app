import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permitExecution, permitExecutors, permitProgress } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { PermitCacheService } from '../permit/permit-cache.service';
import { PermitService } from '../permit/permit.service';
import { ACTIVE_STATUS } from './execution.constants';
import { ProgressUpdateDto } from './dto/progress-update.dto';
import { NotificationService } from './notification.service';

@Injectable()
export class ProgressService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
  ) {}

  async addProgress(permitId: string, dto: ProgressUpdateDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== ACTIVE_STATUS) {
      throw new ConflictException('Progress updates are only allowed for active permits');
    }

    await this.requireExecutor(permitId, user);

    const execution = await this.getExecution(permitId);

    const [progress] = await this.db
      .insert(permitProgress)
      .values({
        permitId,
        executionId: execution.id,
        summary: dto.summary,
        recordedBy: user.id,
        metadata: dto.metadata ?? null,
        createdBy: user.id,
      })
      .returning();

    await this.auditService.log({
      action: 'permit.progress.recorded',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
      metadata: { progressId: progress.id },
    });

    await this.notificationService.enqueueExecutionNotification({
      permitId,
      tenantId,
      action: 'progress_recorded',
      actorId: user.id,
      metadata: { progressId: progress.id },
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);

    return progress;
  }

  async listProgress(permitId: string, user: AuthenticatedUser) {
    await this.permitService.findOne(permitId, user);

    return this.db
      .select()
      .from(permitProgress)
      .where(eq(permitProgress.permitId, permitId))
      .orderBy(asc(permitProgress.recordedAt));
  }

  private async getExecution(permitId: string) {
    const [execution] = await this.db
      .select()
      .from(permitExecution)
      .where(eq(permitExecution.permitId, permitId));

    if (!execution) {
      throw new NotFoundException('Permit execution record not found');
    }

    return execution;
  }

  private async requireExecutor(permitId: string, user: AuthenticatedUser) {
    if (user.roles.includes('platform-admin') || user.roles.includes('org-admin')) {
      return;
    }

    const [executor] = await this.db
      .select()
      .from(permitExecutors)
      .where(
        and(eq(permitExecutors.permitId, permitId), eq(permitExecutors.workforceUserId, user.id)),
      );

    if (!executor) {
      throw new ForbiddenException('You are not assigned as an executor for this permit');
    }
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
