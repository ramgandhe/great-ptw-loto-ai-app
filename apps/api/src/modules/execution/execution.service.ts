import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  permitEvidence,
  permitExecutions,
  permitExecutors,
  permitProgress,
  permits,
  permitStatusHistory,
} from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import {
  ALLOWED_ATTACHMENT_CONTENT_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '../permit/permit.constants';
import { PermitCacheService } from '../permit/permit-cache.service';
import { PermitLogService } from '../permit/permit-log.service';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import {
  ActivatePermitDto,
  ProgressUpdateDto,
  ResumePermitDto,
  SuspendPermitDto,
  UploadEvidenceDto,
} from './dto/execution.dto';
import { EXECUTION_NOTIFICATION_JOB } from './execution.constants';
import { StatusTransitionService } from './status-transition.service';

type PermitRow = typeof permits.$inferSelect;

@Injectable()
export class ExecutionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly transitionService: StatusTransitionService,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
    private readonly permitLogService: PermitLogService,
  ) {}

  async get(id: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const permit = await this.findPermit(id, tenantId);
    const [execution] = await this.db
      .select()
      .from(permitExecutions)
      .where(
        and(
          eq(permitExecutions.permitId, id),
          eq(permitExecutions.tenantId, tenantId),
        ),
      );
    const progress = await this.db
      .select()
      .from(permitProgress)
      .where(
        and(eq(permitProgress.permitId, id), eq(permitProgress.tenantId, tenantId)),
      )
      .orderBy(desc(permitProgress.recordedAt));
    const evidence = await this.db
      .select()
      .from(permitEvidence)
      .where(
        and(eq(permitEvidence.permitId, id), eq(permitEvidence.tenantId, tenantId)),
      )
      .orderBy(desc(permitEvidence.createdAt));
    const history = await this.db
      .select()
      .from(permitStatusHistory)
      .where(
        and(
          eq(permitStatusHistory.permitId, id),
          eq(permitStatusHistory.tenantId, tenantId),
        ),
      )
      .orderBy(desc(permitStatusHistory.changedAt));

    return { permit, execution: execution ?? null, progress, evidence, history };
  }

  async activate(id: string, dto: ActivatePermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const permit = await this.findPermit(id, tenantId);
    this.transitionService.assertAllowed(permit.status, 'active');
    this.assertNotExpired(permit);
    await this.assertAssignedExecutor(id, user.id);

    if (!dto.readinessConfirmed) {
      throw new BadRequestException('Readiness confirmation is required');
    }

    const activatedAt = new Date();
    await this.db.transaction(async (tx) => {
      await tx.insert(permitExecutions).values({
        tenantId,
        permitId: id,
        activatedAt,
        activatedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      });
      await tx
        .update(permits)
        .set({ status: 'active', updatedBy: user.id })
        .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));
      await tx.insert(permitStatusHistory).values({
        tenantId,
        permitId: id,
        fromStatus: permit.status,
        toStatus: 'active',
        reason: 'Execution readiness confirmed',
        changedBy: user.id,
      });
    });

    await this.afterAction('permit.execution.activated', permit, user, {
      activatedAt: activatedAt.toISOString(),
    });
    return this.get(id, user);
  }

  async addProgress(id: string, dto: ProgressUpdateDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const permit = await this.findPermit(id, tenantId);
    this.assertActive(permit);
    this.assertNotExpired(permit);
    await this.assertAssignedExecutor(id, user.id);

    const [progress] = await this.db
      .insert(permitProgress)
      .values({
        tenantId,
        permitId: id,
        summary: dto.summary.trim(),
        recordedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.afterAction('permit.execution.progress-added', permit, user, {
      progressId: progress.id,
    });
    return progress;
  }

  async uploadEvidence(
    id: string,
    dto: UploadEvidenceDto,
    file: UploadedFilePayload,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const permit = await this.findPermit(id, tenantId);
    this.assertActive(permit);
    this.assertNotExpired(permit);
    await this.assertAssignedExecutor(id, user.id);
    this.validateFile(file);

    if (dto.progressId) {
      const [progress] = await this.db
        .select({ id: permitProgress.id })
        .from(permitProgress)
        .where(
          and(
            eq(permitProgress.id, dto.progressId),
            eq(permitProgress.permitId, id),
            eq(permitProgress.tenantId, tenantId),
          ),
        );
      if (!progress) {
        throw new BadRequestException('Progress update does not belong to this permit');
      }
    }

    const storageKey = `${tenantId}/${id}/execution/${randomUUID()}-${file.originalname}`;
    await this.storageService.putObject(
      storageKey,
      file.buffer,
      file.mimetype,
      file.size,
    );

    const [evidence] = await this.db
      .insert(permitEvidence)
      .values({
        tenantId,
        permitId: id,
        progressId: dto.progressId,
        fileName: file.originalname,
        contentType: file.mimetype,
        fileSize: file.size,
        storageBucket: this.storageService.getBucket(),
        storageKey,
        comment: dto.comment?.trim(),
        uploadedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.afterAction('permit.execution.evidence-uploaded', permit, user, {
      evidenceId: evidence.id,
      fileName: evidence.fileName,
    });
    return evidence;
  }

  async suspend(id: string, dto: SuspendPermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const permit = await this.findPermit(id, tenantId);
    this.transitionService.assertAllowed(permit.status, 'suspended');
    await this.assertExecutorOrSupervisor(id, user);

    const suspendedAt = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(permitExecutions)
        .set({
          suspendedAt,
          suspendedBy: user.id,
          suspensionReason: dto.reason.trim(),
          updatedBy: user.id,
        })
        .where(
          and(
            eq(permitExecutions.permitId, id),
            eq(permitExecutions.tenantId, tenantId),
          ),
        );
      await tx
        .update(permits)
        .set({ status: 'suspended', updatedBy: user.id })
        .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));
      await tx.insert(permitStatusHistory).values({
        tenantId,
        permitId: id,
        fromStatus: permit.status,
        toStatus: 'suspended',
        reason: dto.reason.trim(),
        changedBy: user.id,
      });
    });

    await this.afterAction('permit.execution.suspended', permit, user, {
      reason: dto.reason.trim(),
    });
    return this.get(id, user);
  }

  async resume(id: string, dto: ResumePermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const permit = await this.findPermit(id, tenantId);
    this.transitionService.assertAllowed(permit.status, 'active');
    this.assertNotExpired(permit);
    this.assertSupervisor(user);

    const resumedAt = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(permitExecutions)
        .set({
          resumedAt,
          resumedBy: user.id,
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
          updatedBy: user.id,
        })
        .where(
          and(
            eq(permitExecutions.permitId, id),
            eq(permitExecutions.tenantId, tenantId),
          ),
        );
      await tx
        .update(permits)
        .set({ status: 'active', updatedBy: user.id })
        .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));
      await tx.insert(permitStatusHistory).values({
        tenantId,
        permitId: id,
        fromStatus: permit.status,
        toStatus: 'active',
        reason: dto.reason?.trim() || 'Work authorised to resume',
        changedBy: user.id,
      });
    });

    await this.afterAction('permit.execution.resumed', permit, user, {
      reason: dto.reason?.trim(),
    });
    return this.get(id, user);
  }

  private async findPermit(id: string, tenantId: string): Promise<PermitRow> {
    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, id), eq(permits.tenantId, tenantId)));
    if (!permit) {
      throw new NotFoundException('Permit not found');
    }
    return permit;
  }

  private async assertAssignedExecutor(permitId: string, userId: string): Promise<void> {
    const [executor] = await this.db
      .select({ id: permitExecutors.id })
      .from(permitExecutors)
      .where(
        and(
          eq(permitExecutors.permitId, permitId),
          eq(permitExecutors.workforceUserId, userId),
        ),
      );
    if (!executor) {
      throw new ForbiddenException('Only an assigned executor may perform this action');
    }
  }

  private async assertExecutorOrSupervisor(
    permitId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (this.isSupervisor(user)) {
      return;
    }
    await this.assertAssignedExecutor(permitId, user.id);
  }

  private assertSupervisor(user: AuthenticatedUser): void {
    if (!this.isSupervisor(user)) {
      throw new ForbiddenException('Supervisor authorisation is required');
    }
  }

  private isSupervisor(user: AuthenticatedUser): boolean {
    return user.roles.some((role) =>
      ['supervisor', 'org-admin', 'platform-admin'].includes(role),
    );
  }

  private assertActive(permit: PermitRow): void {
    if (permit.status !== 'active') {
      throw new ConflictException('Execution updates require an active permit');
    }
  }

  private assertNotExpired(permit: PermitRow): void {
    if (permit.plannedEndAt && permit.plannedEndAt.getTime() <= Date.now()) {
      throw new ConflictException('Permit validity has expired');
    }
  }

  private validateFile(file: UploadedFilePayload): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_ATTACHMENT_SIZE_BYTES} bytes`,
      );
    }
    if (
      !ALLOWED_ATTACHMENT_CONTENT_TYPES.includes(
        file.mimetype as (typeof ALLOWED_ATTACHMENT_CONTENT_TYPES)[number],
      )
    ) {
      throw new BadRequestException('Unsupported file type');
    }
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }

  private async afterAction(
    action: string,
    permit: PermitRow,
    user: AuthenticatedUser,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.log({
      action,
      entityType: 'permit',
      entityId: permit.id,
      userId: user.id,
      tenantId: permit.tenantId,
      metadata,
    });
    this.permitLogService.logEvent({
      action,
      permitId: permit.id,
      tenantId: permit.tenantId,
      userId: user.id,
      metadata,
    });
    await this.permitCacheService.invalidatePermit(permit.tenantId, permit.id);
    try {
      await this.queueService.getQueue().add(EXECUTION_NOTIFICATION_JOB, {
        action,
        permitId: permit.id,
        tenantId: permit.tenantId,
        actorId: user.id,
      });
    } catch {
      // The durable database change remains authoritative when Redis is unavailable.
    }
  }
}
