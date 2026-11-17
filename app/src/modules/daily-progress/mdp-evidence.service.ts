import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { and, asc, eq } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  dailyActivityHistory,
  mdpEvidence,
  permitDailyProgress,
  permitDaySecures,
  permitRevalidations,
  permits,
  revalidationHistory,
} from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import { MDP_AUDIT_ACTIONS } from '../revalidation/mdp-audit-events';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import {
  DAILY_PROGRESS_EVIDENCE_PREFIX,
  MDP_READ_ROLES,
  MDP_WRITE_ROLES,
} from './daily-progress.constants';
import { DailyProgressCacheService } from './daily-progress-cache.service';
import { DailyProgressLogService } from './daily-progress-log.service';
import { UploadMdpEvidenceDto } from './dto/mdp-evidence.dto';

const MAX_MDP_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

@Injectable()
export class MdpEvidenceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly cacheService: DailyProgressCacheService,
    private readonly logService: DailyProgressLogService,
  ) {}

  async upload(permitId: string, file: UploadedFilePayload, dto: UploadMdpEvidenceDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    this.assertWriteRole(user);
    await this.requirePermit(permitId, tenantId);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Evidence file is required');
    }
    this.validateFile(file);

    const operationalDate = dto.operationalDate?.slice(0, 10) ?? null;
    let dailyProgressId = dto.dailyProgressId ?? null;
    let daySecureId = dto.daySecureId ?? null;
    let revalidationId = dto.revalidationId ?? null;

    if (dto.kind === 'daily_progress') {
      if (!dailyProgressId) {
        throw new BadRequestException('dailyProgressId is required for daily_progress evidence');
      }
      const [progress] = await this.db
        .select({ id: permitDailyProgress.id, operationalDate: permitDailyProgress.operationalDate })
        .from(permitDailyProgress)
        .where(
          and(
            eq(permitDailyProgress.id, dailyProgressId),
            eq(permitDailyProgress.tenantId, tenantId),
            eq(permitDailyProgress.permitId, permitId),
          ),
        )
        .limit(1);
      if (!progress) {
        throw new NotFoundException('Daily progress record not found');
      }
    }

    if (dto.kind === 'day_secure') {
      if (!daySecureId) {
        throw new BadRequestException('daySecureId is required for day_secure evidence');
      }
      const [secure] = await this.db
        .select({ id: permitDaySecures.id })
        .from(permitDaySecures)
        .where(
          and(
            eq(permitDaySecures.id, daySecureId),
            eq(permitDaySecures.tenantId, tenantId),
            eq(permitDaySecures.permitId, permitId),
          ),
        )
        .limit(1);
      if (!secure) {
        throw new NotFoundException('Day secure record not found');
      }
    }

    if (dto.kind === 'reopen') {
      if (!revalidationId) {
        throw new BadRequestException('revalidationId is required for reopen evidence');
      }
      const [reval] = await this.db
        .select({ id: permitRevalidations.id })
        .from(permitRevalidations)
        .where(
          and(
            eq(permitRevalidations.id, revalidationId),
            eq(permitRevalidations.tenantId, tenantId),
            eq(permitRevalidations.permitId, permitId),
          ),
        )
        .limit(1);
      if (!reval) {
        throw new NotFoundException('Revalidation record not found');
      }
    }

    const prefix =
      this.configService.get<string>('mdp.evidencePrefix') ?? DAILY_PROGRESS_EVIDENCE_PREFIX;
    const bucket = this.storageService.getBucket();
    const storageKey = `${prefix}/${tenantId}/${permitId}/${dto.kind}/${randomUUID()}-${file.originalname}`;

    try {
      await this.storageService.putObject(storageKey, file.buffer, file.mimetype, file.size);
    } catch {
      throw new BadGatewayException('Evidence storage is temporarily unavailable');
    }

    const [row] = await this.db
      .insert(mdpEvidence)
      .values({
        tenantId,
        permitId,
        kind: dto.kind,
        operationalDate,
        dailyProgressId,
        daySecureId,
        revalidationId,
        fileName: file.originalname,
        contentType: file.mimetype,
        fileSize: file.size,
        storageBucket: bucket,
        storageKey,
        comment: dto.comment ?? null,
        uploadedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db.insert(dailyActivityHistory).values({
      tenantId,
      permitId,
      eventType: 'evidence_uploaded',
      actorId,
      payload: {
        evidenceId: row.id,
        kind: dto.kind,
        fileName: file.originalname,
        dailyProgressId,
        daySecureId,
        revalidationId,
        operationalDate,
      },
      createdBy: actorId,
    });

    await this.db.insert(revalidationHistory).values({
      tenantId,
      permitId,
      eventType: 'evidence_uploaded',
      actorId,
      payload: {
        evidenceId: row.id,
        kind: dto.kind,
        fileName: file.originalname,
      },
      createdBy: actorId,
    });

    await this.auditService.log({
      action: MDP_AUDIT_ACTIONS.evidenceUploaded,
      entityType: 'mdp_evidence',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId, kind: dto.kind, fileName: file.originalname },
    });

    this.logService.logEvent({
      action: MDP_AUDIT_ACTIONS.evidenceUploaded,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { evidenceId: row.id, kind: dto.kind },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return row;
  }

  async list(permitId: string, user: AuthenticatedUser, kind?: string) {
    const tenantId = this.requireTenant(user);
    this.assertReadRole(user);
    await this.requirePermit(permitId, tenantId);

    const conditions = [
      eq(mdpEvidence.tenantId, tenantId),
      eq(mdpEvidence.permitId, permitId),
    ];
    if (kind) {
      conditions.push(eq(mdpEvidence.kind, kind));
    }

    return this.db
      .select()
      .from(mdpEvidence)
      .where(and(...conditions))
      .orderBy(asc(mdpEvidence.uploadedAt));
  }

  async getDownloadUrl(permitId: string, evidenceId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    this.assertReadRole(user);
    await this.requirePermit(permitId, tenantId);

    const [evidence] = await this.db
      .select()
      .from(mdpEvidence)
      .where(
        and(
          eq(mdpEvidence.id, evidenceId),
          eq(mdpEvidence.tenantId, tenantId),
          eq(mdpEvidence.permitId, permitId),
        ),
      )
      .limit(1);

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    const expiresInSeconds =
      this.configService.get<number>('mdp.evidenceUrlExpirySeconds') ?? 3600;
    const url = await this.storageService.presignedGetObject(
      evidence.storageKey,
      expiresInSeconds,
    );
    return { url, expiresInSeconds };
  }

  private validateFile(file: UploadedFilePayload): void {
    if (file.size > MAX_MDP_EVIDENCE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_MDP_EVIDENCE_BYTES} bytes`,
      );
    }
    if (!ALLOWED_TYPES.includes(file.mimetype as (typeof ALLOWED_TYPES)[number])) {
      throw new BadRequestException(`Unsupported evidence content type: ${file.mimetype}`);
    }
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }

  private assertWriteRole(user: AuthenticatedUser): void {
    if (!user.roles.some((role) => (MDP_WRITE_ROLES as readonly string[]).includes(role))) {
      throw new ForbiddenException('Insufficient permissions to upload MDP evidence');
    }
  }

  private assertReadRole(user: AuthenticatedUser): void {
    if (!user.roles.some((role) => (MDP_READ_ROLES as readonly string[]).includes(role))) {
      throw new ForbiddenException('Insufficient permissions to view MDP evidence');
    }
  }

  private async requirePermit(permitId: string, tenantId: string) {
    const [permit] = await this.db
      .select({ id: permits.id, status: permits.status })
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)))
      .limit(1);
    if (!permit) {
      throw new NotFoundException('Permit not found');
    }
    return permit;
  }
}
