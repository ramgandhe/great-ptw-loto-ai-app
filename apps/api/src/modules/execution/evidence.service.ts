import {
  BadRequestException,
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
  permitEvidence,
  permitExecution,
  permitExecutors,
  permitProgress,
} from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import { PermitCacheService } from '../permit/permit-cache.service';
import { PermitService } from '../permit/permit.service';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import {
  ACTIVE_STATUS,
  ALLOWED_EVIDENCE_CONTENT_TYPES,
  MAX_EVIDENCE_SIZE_BYTES,
} from './execution.constants';
import { UploadEvidenceDto } from './dto/upload-evidence.dto';
import { NotificationService } from './notification.service';

@Injectable()
export class EvidenceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly storageService: StorageService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
  ) {}

  async upload(
    permitId: string,
    file: UploadedFilePayload,
    dto: UploadEvidenceDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const detail = await this.permitService.findOne(permitId, user);
    const { permit } = detail;

    if (permit.status !== ACTIVE_STATUS) {
      throw new ConflictException('Evidence can only be uploaded for active permits');
    }

    await this.requireExecutor(permitId, user);
    this.validateFile(file);

    const execution = await this.getExecution(permitId);

    if (dto.progressId) {
      const [progress] = await this.db
        .select()
        .from(permitProgress)
        .where(
          and(eq(permitProgress.id, dto.progressId), eq(permitProgress.permitId, permitId)),
        );

      if (!progress) {
        throw new NotFoundException('Progress record not found for this permit');
      }
    }

    const bucket = this.storageService.getBucket();
    const storageKey = `${tenantId}/${permitId}/evidence/${randomUUID()}-${file.originalname}`;

    await this.storageService.putObject(
      storageKey,
      file.buffer,
      file.mimetype,
      file.size,
    );

    const [evidence] = await this.db
      .insert(permitEvidence)
      .values({
        permitId,
        executionId: execution.id,
        progressId: dto.progressId ?? null,
        fileName: file.originalname,
        contentType: file.mimetype,
        fileSize: file.size,
        storageBucket: bucket,
        storageKey,
        comment: dto.comment ?? null,
        uploadedBy: user.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.auditService.log({
      action: 'permit.evidence.uploaded',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId,
      metadata: { evidenceId: evidence.id, fileName: file.originalname },
    });

    await this.notificationService.enqueueExecutionNotification({
      permitId,
      tenantId,
      action: 'evidence_uploaded',
      actorId: user.id,
      metadata: { evidenceId: evidence.id },
    });

    await this.permitCacheService.invalidatePermit(tenantId, permitId);

    return evidence;
  }

  async list(permitId: string, user: AuthenticatedUser) {
    await this.permitService.findOne(permitId, user);

    return this.db
      .select()
      .from(permitEvidence)
      .where(eq(permitEvidence.permitId, permitId))
      .orderBy(asc(permitEvidence.createdAt));
  }

  private validateFile(file: UploadedFilePayload): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_EVIDENCE_SIZE_BYTES} bytes`,
      );
    }

    if (
      !ALLOWED_EVIDENCE_CONTENT_TYPES.includes(
        file.mimetype as (typeof ALLOWED_EVIDENCE_CONTENT_TYPES)[number],
      )
    ) {
      throw new BadRequestException('Unsupported file type');
    }
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
