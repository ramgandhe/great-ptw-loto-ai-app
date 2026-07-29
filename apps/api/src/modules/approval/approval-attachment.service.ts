import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permitAttachments, permits } from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { APPROVAL_READ_ROLES } from './approval.constants';

const REVIEWABLE_STATUSES = ['pending_approval', 'approved', 'rejected', 'deferred'] as const;

@Injectable()
export class ApprovalAttachmentService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async getDownloadUrl(
    permitId: string,
    attachmentId: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    if (!this.userCanReviewAttachments(user)) {
      throw new ForbiddenException('Insufficient permissions to review attachments');
    }

    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, user.tenantId)));

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    if (!REVIEWABLE_STATUSES.includes(permit.status as (typeof REVIEWABLE_STATUSES)[number])) {
      throw new ForbiddenException('Attachments are not available for this permit status');
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

    const expiresInSeconds =
      this.configService.get<number>('approval.attachmentUrlExpirySeconds') ?? 3600;

    const url = await this.storageService.presignedGetObject(
      attachment.storageKey,
      expiresInSeconds,
    );

    return { url, expiresInSeconds };
  }

  private userCanReviewAttachments(user: AuthenticatedUser): boolean {
    return user.roles.some((role) =>
      (APPROVAL_READ_ROLES as readonly string[]).includes(role),
    );
  }
}
