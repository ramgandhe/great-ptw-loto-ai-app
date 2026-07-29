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
import { CLOSURE_ARCHIVE_READ_ROLES, CLOSED_STATUS } from './closure.constants';

@Injectable()
export class ClosureAttachmentService {
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

    if (!this.userCanAccessArchive(user)) {
      throw new ForbiddenException('Insufficient permissions to access archived attachments');
    }

    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, user.tenantId)));

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    if (permit.status !== CLOSED_STATUS) {
      throw new ForbiddenException('Attachments are only available for closed permits');
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
      this.configService.get<number>('closure.attachmentUrlExpirySeconds') ?? 3600;

    const url = await this.storageService.presignedGetObject(
      attachment.storageKey,
      expiresInSeconds,
    );

    return { url, expiresInSeconds };
  }

  private userCanAccessArchive(user: AuthenticatedUser): boolean {
    return user.roles.some((role) =>
      (CLOSURE_ARCHIVE_READ_ROLES as readonly string[]).includes(role),
    );
  }
}
