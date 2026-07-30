import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  forwardRef,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { generatePermitReference } from '../../database/permit-reference';
import {
  permitAttachments,
  permitDrafts,
  permitExecutors,
  permitHazards,
  permitPpe,
  permits,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { ApprovalHistoryService } from '../approval/approval-history.service';
import { WorkflowEngineService } from '../approval/workflow-engine.service';
import { CreatePermitDto } from './dto/create-permit.dto';
import { UpdatePermitDto } from './dto/update-permit.dto';
import { isEditablePermitStatus, isSubmittablePermitStatus } from './permit.constants';
import { PermitCacheService } from './permit-cache.service';
import { PermitLogService } from './permit-log.service';
import { PermitValidationService } from './permit-validation.service';

export interface PermitDetail {
  permit: typeof permits.$inferSelect;
  draft: typeof permitDrafts.$inferSelect | null;
  hazards: (typeof permitHazards.$inferSelect)[];
  ppe: (typeof permitPpe.$inferSelect)[];
  executors: (typeof permitExecutors.$inferSelect)[];
  attachments: (typeof permitAttachments.$inferSelect)[];
}

@Injectable()
export class PermitService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: PermitValidationService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
    private readonly permitLogService: PermitLogService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngine: WorkflowEngineService,
    @Inject(forwardRef(() => ApprovalHistoryService))
    private readonly approvalHistoryService: ApprovalHistoryService,
  ) {}

  async create(dto: CreatePermitDto, user: AuthenticatedUser): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);

    return this.db.transaction(async (tx) => {
      const [permit] = await tx
        .insert(permits)
        .values({
          tenantId,
          status: 'draft',
          permitTypeId: dto.permitTypeId,
          title: dto.title,
          workScope: dto.workScope,
          plantId: dto.plantId,
          departmentId: dto.departmentId,
          locationId: dto.locationId,
          workstationId: dto.workstationId,
          machineryId: dto.machineryId,
          plannedStartAt: dto.plannedStartAt,
          plannedEndAt: dto.plannedEndAt,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      const [draft] = await tx
        .insert(permitDrafts)
        .values({
          permitId: permit.id,
          currentStep: dto.currentStep ?? 0,
          formSnapshot: dto.formSnapshot,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.insertRelations(tx, permit.id, user.id, dto);

      await this.auditService.log({
        action: 'permit.created',
        entityType: 'permit',
        entityId: permit.id,
        userId: user.id,
        tenantId,
        metadata: { status: 'draft' },
      });

      this.permitLogService.logEvent({
        action: 'permit.created',
        permitId: permit.id,
        tenantId,
        userId: user.id,
        metadata: { status: 'draft' },
      });

      await this.permitCacheService.invalidateTenant(tenantId);

      const detail = await this.loadDetail(tx, permit.id, tenantId);
      return { ...detail, draft };
    });
  }

  async findAll(
    user: AuthenticatedUser,
    status?: string,
  ): Promise<(typeof permits.$inferSelect)[]> {
    const tenantId = this.requireTenant(user);

    const cached = await this.permitCacheService.getPermitList<(typeof permits.$inferSelect)[]>(
      tenantId,
      status,
    );
    if (cached) {
      return cached;
    }

    const conditions = [eq(permits.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(permits.status, status));
    }

    const results = await this.db
      .select()
      .from(permits)
      .where(and(...conditions))
      .orderBy(desc(permits.createdAt));

    await this.permitCacheService.setPermitList(tenantId, status, results);
    return results;
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);

    const cached = await this.permitCacheService.getPermitDetail(tenantId, id);
    if (cached) {
      return cached;
    }

    const detail = await this.loadDetail(this.db, id, tenantId);
    await this.permitCacheService.setPermitDetail(tenantId, id, detail);
    return detail;
  }

  async update(
    id: string,
    dto: UpdatePermitDto,
    user: AuthenticatedUser,
  ): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);
    const existing = await this.loadDetail(this.db, id, tenantId);

    if (!isEditablePermitStatus(existing.permit.status)) {
      throw new ConflictException('Only draft, deferred or rejected permits can be updated');
    }

    return this.db.transaction(async (tx) => {
      const permitUpdates: Partial<typeof permits.$inferInsert> = {
        updatedBy: user.id,
      };

      if (dto.permitTypeId !== undefined) permitUpdates.permitTypeId = dto.permitTypeId;
      if (dto.title !== undefined) permitUpdates.title = dto.title;
      if (dto.workScope !== undefined) permitUpdates.workScope = dto.workScope;
      if (dto.plantId !== undefined) permitUpdates.plantId = dto.plantId;
      if (dto.departmentId !== undefined) permitUpdates.departmentId = dto.departmentId;
      if (dto.locationId !== undefined) permitUpdates.locationId = dto.locationId;
      if (dto.workstationId !== undefined) permitUpdates.workstationId = dto.workstationId;
      if (dto.machineryId !== undefined) permitUpdates.machineryId = dto.machineryId;
      if (dto.plannedStartAt !== undefined) permitUpdates.plannedStartAt = dto.plannedStartAt;
      if (dto.plannedEndAt !== undefined) permitUpdates.plannedEndAt = dto.plannedEndAt;

      if (Object.keys(permitUpdates).length > 1) {
        await tx
          .update(permits)
          .set(permitUpdates)
          .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));
      }

      if (dto.currentStep !== undefined || dto.formSnapshot !== undefined) {
        await tx
          .update(permitDrafts)
          .set({
            ...(dto.currentStep !== undefined ? { currentStep: dto.currentStep } : {}),
            ...(dto.formSnapshot !== undefined ? { formSnapshot: dto.formSnapshot } : {}),
            lastAutosavedAt: new Date(),
            updatedBy: user.id,
          })
          .where(eq(permitDrafts.permitId, id));
      }

      if (dto.hazards !== undefined) {
        await tx.delete(permitHazards).where(eq(permitHazards.permitId, id));
        await this.insertHazards(tx, id, user.id, dto.hazards);
      }

      if (dto.ppe !== undefined) {
        await tx.delete(permitPpe).where(eq(permitPpe.permitId, id));
        await this.insertPpe(tx, id, user.id, dto.ppe);
      }

      if (dto.executors !== undefined) {
        await tx.delete(permitExecutors).where(eq(permitExecutors.permitId, id));
        await this.insertExecutors(tx, id, user.id, dto.executors);
      }

      await this.auditService.log({
        action: 'permit.updated',
        entityType: 'permit',
        entityId: id,
        userId: user.id,
        tenantId,
        metadata: { status: 'draft' },
      });

      this.permitLogService.logEvent({
        action: 'permit.updated',
        permitId: id,
        tenantId,
        userId: user.id,
        metadata: { status: 'draft' },
      });

      await this.permitCacheService.invalidatePermit(tenantId, id);

      return this.loadDetail(tx, id, tenantId);
    });
  }

  async submit(id: string, user: AuthenticatedUser): Promise<PermitDetail> {
    const tenantId = this.requireTenant(user);
    const detail = await this.loadDetail(this.db, id, tenantId);

    if (!isSubmittablePermitStatus(detail.permit.status)) {
      throw new ConflictException('Permit cannot be submitted in its current status');
    }

    this.validationService.validateForSubmit(detail);

    const isResubmit = detail.permit.status === 'deferred' || detail.permit.status === 'rejected';
    const reference =
      detail.permit.reference ?? (await generatePermitReference(this.db, tenantId));
    const submittedAt = new Date();
    const fromStatus = detail.permit.status;

    await this.db.transaction(async (tx) => {
      await tx
        .update(permits)
        .set({
          status: 'pending_approval',
          reference,
          submittedAt,
          submittedBy: user.id,
          updatedBy: user.id,
        })
        .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));

      if (isResubmit) {
        await this.approvalHistoryService.record(
          {
            permitId: id,
            action: 'resubmitted',
            fromStatus,
            toStatus: 'pending_approval',
            actorId: user.id,
            createdBy: user.id,
          },
          tx,
        );
      }

      await this.workflowEngine.initializeAtSubmit(
        id,
        tenantId,
        detail.permit.permitTypeId,
        user.id,
        tx,
      );
    });

    await this.auditService.log({
      action: isResubmit ? 'permit.resubmitted' : 'permit.submitted',
      entityType: 'permit',
      entityId: id,
      userId: user.id,
      tenantId,
      metadata: { reference, status: 'pending_approval', fromStatus },
    });

    this.permitLogService.logEvent({
      action: isResubmit ? 'permit.resubmitted' : 'permit.submitted',
      permitId: id,
      tenantId,
      userId: user.id,
      metadata: { reference, status: 'pending_approval', fromStatus },
    });

    await this.permitCacheService.invalidatePermit(tenantId, id);

    return this.loadDetail(this.db, id, tenantId);
  }

  private async loadDetail(
    db: Pick<Database, 'select' | 'query'>,
    id: string,
    tenantId: string,
  ): Promise<PermitDetail> {
    const [permit] = await db
      .select()
      .from(permits)
      .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    const [draft] = await db
      .select()
      .from(permitDrafts)
      .where(eq(permitDrafts.permitId, id));

    const hazards = await db
      .select()
      .from(permitHazards)
      .where(eq(permitHazards.permitId, id));

    const ppe = await db.select().from(permitPpe).where(eq(permitPpe.permitId, id));

    const executors = await db
      .select()
      .from(permitExecutors)
      .where(eq(permitExecutors.permitId, id));

    const attachments = await db
      .select()
      .from(permitAttachments)
      .where(eq(permitAttachments.permitId, id));

    return { permit, draft: draft ?? null, hazards, ppe, executors, attachments };
  }

  private async insertRelations(
    db: Pick<Database, 'insert'>,
    permitId: string,
    userId: string,
    dto: CreatePermitDto | UpdatePermitDto,
  ): Promise<void> {
    if (dto.hazards?.length) {
      await this.insertHazards(db, permitId, userId, dto.hazards);
    }
    if (dto.ppe?.length) {
      await this.insertPpe(db, permitId, userId, dto.ppe);
    }
    if (dto.executors?.length) {
      await this.insertExecutors(db, permitId, userId, dto.executors);
    }
  }

  private async insertHazards(
    db: Pick<Database, 'insert'>,
    permitId: string,
    userId: string,
    hazards: NonNullable<CreatePermitDto['hazards']>,
  ): Promise<void> {
    await db.insert(permitHazards).values(
      hazards.map((hazard) => ({
        permitId,
        hazardCategoryId: hazard.hazardCategoryId,
        description: hazard.description,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  private async insertPpe(
    db: Pick<Database, 'insert'>,
    permitId: string,
    userId: string,
    ppeItems: NonNullable<CreatePermitDto['ppe']>,
  ): Promise<void> {
    await db.insert(permitPpe).values(
      ppeItems.map((item) => ({
        permitId,
        ppeCatalogueId: item.ppeCatalogueId,
        quantity: item.quantity ?? 1,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  private async insertExecutors(
    db: Pick<Database, 'insert'>,
    permitId: string,
    userId: string,
    executors: NonNullable<CreatePermitDto['executors']>,
  ): Promise<void> {
    await db.insert(permitExecutors).values(
      executors.map((executor) => ({
        permitId,
        workforceUserId: executor.workforceUserId,
        isPrimary: executor.isPrimary ?? false,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
