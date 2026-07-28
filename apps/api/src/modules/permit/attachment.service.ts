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
} from './permit.constants';
import { UploadedFilePayload } from './uploaded-file.interface';

@Injectable()
export class AttachmentService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
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

    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, user.tenantId)));

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    if (permit.status !== 'draft') {
      throw new ConflictException('Attachments can only be added to draft permits');
    }

    const bucket = this.storageService.getBucket();
    const storageKey = `${user.tenantId}/${permitId}/${randomUUID()}-${file.originalname}`;

    await this.storageService.putObject(
      storageKey,
      file.buffer,
      file.mimetype,
      file.size,
    );

    const [attachment] = await this.db
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

    await this.auditService.log({
      action: 'permit.attachment.uploaded',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId: user.tenantId,
      metadata: { attachmentId: attachment.id, fileName: file.originalname },
    });

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

    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, user.tenantId)));

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    if (permit.status !== 'draft') {
      throw new ConflictException('Attachments can only be removed from draft permits');
    }

    const [attachment] = await this.db
      .select()
      .from(permitAttachments)
      .where(
        and(eq(permitAttachments.id, attachmentId), eq(permitAttachments.permitId, permitId)),
      );

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    try {
      await this.storageService.deleteObject(attachment.storageKey);
    } catch {
      // Object may already be absent; continue with metadata removal.
    }

    await this.db.delete(permitAttachments).where(eq(permitAttachments.id, attachmentId));

    await this.auditService.log({
      action: 'permit.attachment.removed',
      entityType: 'permit',
      entityId: permitId,
      userId: user.id,
      tenantId: user.tenantId,
      metadata: { attachmentId },
    });
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
