import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { appliedLocks } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { ApplyLockDto } from './dto/apply-lock.dto';
import { IsolationExecutionService } from './isolation-execution.service';
import { LOCK_APPLIED, LOCK_REMOVED } from './isolation-execution.constants';
import { StatusValidationService } from './status-validation.service';

@Injectable()
export class LockService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly executionService: IsolationExecutionService,
    private readonly statusValidation: StatusValidationService,
    private readonly auditService: AuditService,
  ) {}

  async apply(executionId: string, dto: ApplyLockDto, user: AuthenticatedUser) {
    const execution = await this.executionService.getExecutionEntity(executionId, user);
    this.statusValidation.assertExecutionEditable(execution.status);
    await this.executionService.assertPointBelongsToPlan(dto.isolationPointId, execution.planId);
    await this.statusValidation.assertLockSequence(
      execution.id,
      execution.planId,
      dto.isolationPointId,
    );

    const [existing] = await this.db
      .select()
      .from(appliedLocks)
      .where(
        and(
          eq(appliedLocks.executionId, executionId),
          eq(appliedLocks.isolationPointId, dto.isolationPointId),
          eq(appliedLocks.lockTag, dto.lockTag),
        ),
      );
    if (existing) {
      throw new ConflictException('A lock with this tag already exists for the isolation point');
    }

    const [lock] = await this.db
      .insert(appliedLocks)
      .values({
        tenantId: execution.tenantId,
        executionId,
        isolationPointId: dto.isolationPointId,
        lockTag: dto.lockTag,
        lockMethod: dto.lockMethod,
        status: LOCK_APPLIED,
        appliedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.auditService.log({
      action: 'isolation.lock.applied',
      entityType: 'applied_lock',
      entityId: lock.id,
      userId: user.id,
      tenantId: execution.tenantId,
      metadata: { executionId, isolationPointId: dto.isolationPointId, lockMethod: dto.lockMethod },
    });

    return lock;
  }

  async remove(lockId: string, user: AuthenticatedUser) {
    const lock = await this.getLock(lockId, user);

    if (lock.status === LOCK_REMOVED) {
      throw new ConflictException('Lock has already been removed');
    }

    const removedAt = new Date();
    const [updated] = await this.db
      .update(appliedLocks)
      .set({ status: LOCK_REMOVED, removedBy: user.id, removedAt, updatedBy: user.id })
      .where(eq(appliedLocks.id, lockId))
      .returning();

    await this.auditService.log({
      action: 'isolation.lock.removed',
      entityType: 'applied_lock',
      entityId: lockId,
      userId: user.id,
      tenantId: lock.tenantId,
      metadata: { executionId: lock.executionId },
    });

    return updated;
  }

  async list(executionId: string, user: AuthenticatedUser) {
    await this.executionService.getExecutionEntity(executionId, user);
    return this.db.select().from(appliedLocks).where(eq(appliedLocks.executionId, executionId));
  }

  private async getLock(lockId: string, user: AuthenticatedUser) {
    const [lock] = await this.db.select().from(appliedLocks).where(eq(appliedLocks.id, lockId));
    if (!lock) {
      throw new NotFoundException('Lock not found');
    }
    // Enforce tenant scoping via the parent execution.
    await this.executionService.getExecutionEntity(lock.executionId, user);
    return lock;
  }
}
