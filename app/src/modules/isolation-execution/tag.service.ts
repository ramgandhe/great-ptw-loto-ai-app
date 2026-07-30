import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { appliedTags } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { ApplyTagDto } from './dto/apply-tag.dto';
import { IsolationExecutionService } from './isolation-execution.service';
import { LOCK_APPLIED, LOCK_REMOVED } from './isolation-execution.constants';
import { StatusValidationService } from './status-validation.service';

@Injectable()
export class TagService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly executionService: IsolationExecutionService,
    private readonly statusValidation: StatusValidationService,
    private readonly auditService: AuditService,
  ) {}

  async apply(executionId: string, dto: ApplyTagDto, user: AuthenticatedUser) {
    const execution = await this.executionService.getExecutionEntity(executionId, user);
    this.statusValidation.assertExecutionEditable(execution.status);
    await this.executionService.assertPointBelongsToPlan(dto.isolationPointId, execution.planId);

    const [existing] = await this.db
      .select()
      .from(appliedTags)
      .where(
        and(
          eq(appliedTags.executionId, executionId),
          eq(appliedTags.isolationPointId, dto.isolationPointId),
          eq(appliedTags.tagNumber, dto.tagNumber),
        ),
      );
    if (existing) {
      throw new ConflictException('A tag with this number already exists for the isolation point');
    }

    const [tag] = await this.db
      .insert(appliedTags)
      .values({
        tenantId: execution.tenantId,
        executionId,
        isolationPointId: dto.isolationPointId,
        tagNumber: dto.tagNumber,
        tagType: dto.tagType,
        reason: dto.reason ?? null,
        status: LOCK_APPLIED,
        appliedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.auditService.log({
      action: 'isolation.tag.applied',
      entityType: 'applied_tag',
      entityId: tag.id,
      userId: user.id,
      tenantId: execution.tenantId,
      metadata: { executionId, isolationPointId: dto.isolationPointId, tagType: dto.tagType },
    });

    return tag;
  }

  async remove(tagId: string, user: AuthenticatedUser) {
    const tag = await this.getTag(tagId, user);

    if (tag.status === LOCK_REMOVED) {
      throw new ConflictException('Tag has already been removed');
    }

    const removedAt = new Date();
    const [updated] = await this.db
      .update(appliedTags)
      .set({ status: LOCK_REMOVED, removedBy: user.id, removedAt, updatedBy: user.id })
      .where(eq(appliedTags.id, tagId))
      .returning();

    await this.auditService.log({
      action: 'isolation.tag.removed',
      entityType: 'applied_tag',
      entityId: tagId,
      userId: user.id,
      tenantId: tag.tenantId,
      metadata: { executionId: tag.executionId },
    });

    return updated;
  }

  async list(executionId: string, user: AuthenticatedUser) {
    await this.executionService.getExecutionEntity(executionId, user);
    return this.db.select().from(appliedTags).where(eq(appliedTags.executionId, executionId));
  }

  private async getTag(tagId: string, user: AuthenticatedUser) {
    const [tag] = await this.db.select().from(appliedTags).where(eq(appliedTags.id, tagId));
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    await this.executionService.getExecutionEntity(tag.executionId, user);
    return tag;
  }
}
