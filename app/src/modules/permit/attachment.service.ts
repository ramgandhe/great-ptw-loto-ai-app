import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permitAttachments, permits } from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import {
  ALLOWED_ATTACHMENT_CONTENT_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  isEditablePermitStatus,
} from './permit.constants';
import { PermitCacheService } from './permit-cache.service';
import { PermitLogService } from './permit-log.service';
import { UploadedFilePayload } from './uploaded-file.interface';

@Injectable()
export class AttachmentService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly permitCacheService: PermitCacheService,
    private readonly permitLogService: PermitLogService,
  ) {}

  async upload(
    permitId: string,
    file: UploadedFilePayload,
    user: AuthenticatedUser,
  ): Promise<typeof permitAttachments.$inferSelect> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    this.validateFile(file);

    // A quick check first, so a closed permit does not get a file stored at all.
    await this.assertEditable(this.db, permitId, user.tenantId);

    const bucket = this.storageService.getBucket();
    const storageKey = `${user.tenantId}/${permitId}/${randomUUID()}-${file.originalname}`;

    // Storage I/O stays outside the row lock; the metadata insert re-checks the permit under it,
    // so a submit that won the race leaves no attachment behind (and the stored file is removed).
    await this.storageService.putObject(storageKey, file.buffer, file.mimetype, file.size);

    let attachment: typeof permitAttachments.$inferSelect;
    try {
      attachment = await this.db.transaction(async (tx) => {
        await this.assertEditable(tx, permitId, user.tenantId!, true);
        const [created] = await tx
          .insert(permitAttachments)
          .values({
            permitId,
            fileName: file.originalname,
            contentType: file.mimetype,
            fileSize: file.size,
            storageBucket: bucket,
            storageKey,
            uploadedBy: user.id,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning();
        return created;
      });
    } catch (error) {
      await this.storageService.deleteObject(storageKey).catch(() => undefined);
      throw error;
    }

    await this.auditService.log({
      action: 'permit.attachment.uploaded',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId: user.tenantId,
      metadata: { attachmentId: attachment.id, fileName: file.originalname },
    });

    this.permitLogService.logEvent({
      action: 'permit.attachment.uploaded',
      permitId,
      tenantId: user.tenantId,
      userId: user.id,
      metadata: { attachmentId: attachment.id, fileName: file.originalname },
    });

    await this.permitCacheService.invalidatePermit(user.tenantId, permitId);

    return attachment;
  }

  async remove(
    permitId: string,
    attachmentId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    const tenantId = user.tenantId;
    // Metadata goes first, under the permit lock; the stored file is removed only once that commits.
    const attachment = await this.db.transaction(async (tx) => {
      await this.assertEditable(tx, permitId, tenantId, true);
      const [found] = await tx
        .select()
        .from(permitAttachments)
        .where(and(eq(permitAttachments.id, attachmentId), eq(permitAttachments.permitId, permitId)));
      if (!found) {
        throw new NotFoundException('Attachment not found');
      }
      await tx.delete(permitAttachments).where(eq(permitAttachments.id, attachmentId));
      return found;
    });

    // An object left behind costs storage only; the attachment is already gone from the permit.
    await this.storageService.deleteObject(attachment.storageKey).catch(() => undefined);

    await this.auditService.log({
      action: 'permit.attachment.removed',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId: user.tenantId,
      metadata: { attachmentId },
    });

    this.permitLogService.logEvent({
      action: 'permit.attachment.removed',
      permitId,
      tenantId: user.tenantId,
      userId: user.id,
      metadata: { attachmentId },
    });

    await this.permitCacheService.invalidatePermit(user.tenantId, permitId);
  }

  /** The tenant's permit exists and is editable; with `lock`, holds its row for the transaction. */
  private async assertEditable(db: Pick<Database, 'select'>, permitId: string, tenantId: string, lock = false) {
    const query = db
      .select({ status: permits.status })
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));
    const [permit] = lock ? await query.for('update') : await query;
    if (!permit) {
      throw new NotFoundException('Permit not found');
    }
    if (!isEditablePermitStatus(permit.status)) {
      throw new ConflictException('Attachments can only be changed on editable permits');
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
}
