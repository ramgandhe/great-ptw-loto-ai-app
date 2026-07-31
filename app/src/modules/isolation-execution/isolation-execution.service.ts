import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, asc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  appliedLocks,
  appliedTags,
  isolationEvidence,
  isolationExecution,
  isolationPoints,
  isolationSequences,
  isolationVerifications,
  lototoPlans,
} from '../../database/schema';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import { CaptureEvidenceDto } from './dto/capture-evidence.dto';
import { EvidenceUploadUrlDto } from './dto/evidence-upload-url.dto';
import { IsolationCacheService } from './isolation-cache.service';
import { IsolationLogService } from './isolation-log.service';
import {
  EXECUTION_IN_PROGRESS,
  EXECUTION_ISOLATED,
  EXECUTION_VERIFIED,
  PLAN_IN_EXECUTION,
  PLAN_READY,
} from './isolation-execution.constants';
import { StatusValidationService } from './status-validation.service';

@Injectable()
export class IsolationExecutionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly statusValidation: StatusValidationService,
    private readonly auditService: AuditService,
    private readonly cacheService: IsolationCacheService,
    private readonly logService: IsolationLogService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async start(planId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const plan = await this.getPlan(planId, tenantId);

    if (plan.status !== PLAN_READY) {
      throw new ConflictException(
        `Isolation execution can only start for a plan in '${PLAN_READY}' status, but it is '${plan.status}'`,
      );
    }

    const [existing] = await this.db
      .select()
      .from(isolationExecution)
      .where(eq(isolationExecution.planId, planId));

    if (existing) {
      throw new ConflictException('An isolation execution already exists for this plan');
    }

    const execution = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(isolationExecution)
        .values({
          tenantId,
          planId,
          status: EXECUTION_IN_PROGRESS,
          startedBy: user.id,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await tx
        .update(lototoPlans)
        .set({ status: PLAN_IN_EXECUTION, updatedBy: user.id })
        .where(and(eq(lototoPlans.id, planId), eq(lototoPlans.tenantId, tenantId)));

      return created;
    });

    await this.auditService.log({
      action: 'isolation.execution.started',
      entityType: 'isolation_execution',
      entityId: execution.id,
      userId: user.id,
      tenantId,
      metadata: { planId },
    });
    this.logService.logEvent({
      action: 'isolation.execution.started',
      executionId: execution.id,
      planId,
      tenantId,
      userId: user.id,
    });
    await this.cacheService.invalidate(tenantId, execution.id, planId);

    return execution;
  }

  async getForPlan(planId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.getPlan(planId, tenantId);

    const cached = await this.cacheService.getDetailByPlan<
      Awaited<ReturnType<IsolationExecutionService['assembleDetail']>>
    >(tenantId, planId);
    if (cached) {
      return cached;
    }

    const [execution] = await this.db
      .select()
      .from(isolationExecution)
      .where(
        and(eq(isolationExecution.planId, planId), eq(isolationExecution.tenantId, tenantId)),
      );

    if (!execution) {
      throw new NotFoundException('Isolation execution not found for this plan');
    }

    const detail = await this.assembleDetail(execution);
    await this.cacheService.setDetailByPlan(tenantId, planId, detail);
    await this.cacheService.setDetailByExecution(tenantId, execution.id, detail);
    return detail;
  }

  async getDetail(executionId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const cached = await this.cacheService.getDetailByExecution<
      Awaited<ReturnType<IsolationExecutionService['assembleDetail']>>
    >(tenantId, executionId);
    if (cached) {
      return cached;
    }

    const execution = await this.getExecutionEntity(executionId, user);
    const detail = await this.assembleDetail(execution);
    await this.cacheService.setDetailByExecution(tenantId, executionId, detail);
    await this.cacheService.setDetailByPlan(tenantId, execution.planId, detail);
    return detail;
  }

  async markIsolated(executionId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const execution = await this.getExecutionEntity(executionId, user);

    this.statusValidation.assertExecutionEditable(execution.status);
    await this.statusValidation.assertAllPointsLocked(execution.id, execution.planId);
    this.statusValidation.assertTransition(execution.status, EXECUTION_ISOLATED);

    const isolatedAt = new Date();
    const [updated] = await this.db
      .update(isolationExecution)
      .set({ status: EXECUTION_ISOLATED, isolatedAt, updatedBy: user.id })
      .where(
        and(eq(isolationExecution.id, executionId), eq(isolationExecution.tenantId, tenantId)),
      )
      .returning();

    await this.auditService.log({
      action: 'isolation.execution.isolated',
      entityType: 'isolation_execution',
      entityId: executionId,
      userId: user.id,
      tenantId,
      metadata: { planId: execution.planId },
    });
    this.logService.logEvent({
      action: 'isolation.execution.isolated',
      executionId,
      planId: execution.planId,
      tenantId,
      userId: user.id,
    });
    await this.cacheService.invalidate(tenantId, executionId, execution.planId);

    return updated;
  }

  async markVerified(executionId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const execution = await this.getExecutionEntity(executionId, user);

    this.statusValidation.assertReadyForVerification(execution.status);
    await this.statusValidation.assertAllPointsVerified(execution.id, execution.planId);
    this.statusValidation.assertTransition(execution.status, EXECUTION_VERIFIED);

    const verifiedAt = new Date();
    const [updated] = await this.db
      .update(isolationExecution)
      .set({ status: EXECUTION_VERIFIED, verifiedAt, updatedBy: user.id })
      .where(
        and(eq(isolationExecution.id, executionId), eq(isolationExecution.tenantId, tenantId)),
      )
      .returning();

    await this.auditService.log({
      action: 'isolation.execution.verified',
      entityType: 'isolation_execution',
      entityId: executionId,
      userId: user.id,
      tenantId,
      metadata: { planId: execution.planId },
    });
    this.logService.logEvent({
      action: 'isolation.execution.verified',
      executionId,
      planId: execution.planId,
      tenantId,
      userId: user.id,
    });
    await this.cacheService.invalidate(tenantId, executionId, execution.planId);

    return updated;
  }

  async captureEvidence(
    executionId: string,
    dto: CaptureEvidenceDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const execution = await this.getExecutionEntity(executionId, user);

    if (dto.isolationPointId) {
      await this.assertPointBelongsToPlan(dto.isolationPointId, execution.planId);
    }

    if (dto.verificationId) {
      const [verification] = await this.db
        .select()
        .from(isolationVerifications)
        .where(
          and(
            eq(isolationVerifications.id, dto.verificationId),
            eq(isolationVerifications.executionId, executionId),
          ),
        );
      if (!verification) {
        throw new NotFoundException('Verification not found for this execution');
      }
    }

    const [evidence] = await this.db
      .insert(isolationEvidence)
      .values({
        tenantId,
        executionId,
        isolationPointId: dto.isolationPointId ?? null,
        verificationId: dto.verificationId ?? null,
        fileName: dto.fileName,
        contentType: dto.contentType,
        fileSize: dto.fileSize,
        storageBucket: 'ptw-documents',
        storageKey: dto.storageKey,
        checksum: dto.checksum ?? null,
        capturedBy: user.id,
        createdBy: user.id,
      })
      .returning();

    await this.auditService.log({
      action: 'isolation.evidence.captured',
      entityType: 'isolation_evidence',
      entityId: evidence.id,
      userId: user.id,
      tenantId,
      metadata: { executionId },
    });
    this.logService.logEvent({
      action: 'isolation.evidence.captured',
      executionId,
      planId: execution.planId,
      tenantId,
      userId: user.id,
      metadata: { evidenceId: evidence.id },
    });
    await this.cacheService.invalidate(tenantId, executionId, execution.planId);

    return evidence;
  }

  /**
   * MinIO wiring for evidence storage: issues a presigned PUT URL so clients
   * upload the binary directly to object storage, then POST the metadata via
   * captureEvidence. Keeps large binaries out of the API/DB.
   */
  async evidenceUploadUrl(
    executionId: string,
    dto: EvidenceUploadUrlDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const execution = await this.getExecutionEntity(executionId, user);
    const storageKey = `${tenantId}/${execution.planId}/isolation/${executionId}/${randomUUID()}-${dto.fileName}`;
    const expiry = this.configService.get<number>('isolation.evidenceUrlExpirySeconds') ?? 3600;
    const uploadUrl = await this.storageService.presignedPutObject(storageKey, expiry);

    return {
      storageBucket: this.storageService.getBucket(),
      storageKey,
      uploadUrl,
      expiresInSeconds: expiry,
    };
  }

  async evidenceDownloadUrl(executionId: string, evidenceId: string, user: AuthenticatedUser) {
    await this.getExecutionEntity(executionId, user);
    const [evidence] = await this.db
      .select()
      .from(isolationEvidence)
      .where(
        and(
          eq(isolationEvidence.id, evidenceId),
          eq(isolationEvidence.executionId, executionId),
        ),
      );
    if (!evidence) {
      throw new NotFoundException('Evidence not found for this execution');
    }

    const expiry = this.configService.get<number>('isolation.evidenceUrlExpirySeconds') ?? 3600;
    const downloadUrl = await this.storageService.presignedGetObject(evidence.storageKey, expiry);
    return { evidenceId, downloadUrl, expiresInSeconds: expiry };
  }

  /**
   * Tenant-scoped execution loader shared by the lock/tag/verification services.
   * Returns NotFound (never a cross-tenant record) when the execution does not
   * belong to the caller's tenant, preventing cross-tenant data leakage.
   */
  async getExecutionEntity(executionId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const [execution] = await this.db
      .select()
      .from(isolationExecution)
      .where(
        and(eq(isolationExecution.id, executionId), eq(isolationExecution.tenantId, tenantId)),
      );

    if (!execution) {
      throw new NotFoundException('Isolation execution not found');
    }

    return execution;
  }

  async assertPointBelongsToPlan(isolationPointId: string, planId: string) {
    const [point] = await this.db
      .select()
      .from(isolationPoints)
      .where(
        and(eq(isolationPoints.id, isolationPointId), eq(isolationPoints.planId, planId)),
      );

    if (!point) {
      throw new NotFoundException('Isolation point does not belong to this execution plan');
    }

    return point;
  }

  private async assembleDetail(execution: typeof isolationExecution.$inferSelect) {
    const [plan, locks, tags, verifications, evidence, sequence] = await Promise.all([
      this.db
        .select()
        .from(lototoPlans)
        .where(eq(lototoPlans.id, execution.planId))
        .then((rows) => rows[0] ?? null),
      this.db
        .select()
        .from(appliedLocks)
        .where(eq(appliedLocks.executionId, execution.id))
        .orderBy(asc(appliedLocks.appliedAt)),
      this.db
        .select()
        .from(appliedTags)
        .where(eq(appliedTags.executionId, execution.id))
        .orderBy(asc(appliedTags.appliedAt)),
      this.db
        .select()
        .from(isolationVerifications)
        .where(eq(isolationVerifications.executionId, execution.id))
        .orderBy(asc(isolationVerifications.verifiedAt)),
      this.db
        .select()
        .from(isolationEvidence)
        .where(eq(isolationEvidence.executionId, execution.id))
        .orderBy(asc(isolationEvidence.capturedAt)),
      this.db
        .select({
          sequenceOrder: isolationSequences.sequenceOrder,
          requiresVerification: isolationSequences.requiresVerification,
          isolationPointId: isolationSequences.isolationPointId,
          isolationNumber: isolationPoints.isolationNumber,
          description: isolationPoints.description,
        })
        .from(isolationSequences)
        .innerJoin(
          isolationPoints,
          eq(isolationSequences.isolationPointId, isolationPoints.id),
        )
        .where(eq(isolationSequences.planId, execution.planId))
        .orderBy(asc(isolationSequences.sequenceOrder)),
    ]);

    return { execution, plan, sequence, locks, tags, verifications, evidence };
  }

  private async getPlan(planId: string, tenantId: string) {
    const [plan] = await this.db
      .select()
      .from(lototoPlans)
      .where(and(eq(lototoPlans.id, planId), eq(lototoPlans.tenantId, tenantId)));

    if (!plan) {
      throw new NotFoundException('LOTOTO plan not found');
    }

    return plan;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
