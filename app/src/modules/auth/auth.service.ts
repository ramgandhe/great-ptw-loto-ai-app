import { BadGatewayException, BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { UserProfile } from '@ptw/shared';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { userProfiles } from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
  ) {}

  async getProfile(user: AuthenticatedUser): Promise<UserProfile> {
    const profile = await this.findProfileRow(user.id);
    return this.toUserProfile(user, profile);
  }

  async updateProfile(dto: UpdateUserProfileDto, user: AuthenticatedUser): Promise<UserProfile> {
    const actorId = optionalUuid(user.id);
    const existing = await this.findProfileRow(user.id);
    const displayName =
      dto.displayName !== undefined ? dto.displayName.trim() || null : existing?.displayName ?? null;

    if (existing) {
      await this.db
        .update(userProfiles)
        .set({
          displayName,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.id, existing.id));
    } else {
      await this.db.insert(userProfiles).values({
        userId: user.id,
        displayName,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }

    return this.getProfile(user);
  }

  async uploadAvatar(file: UploadedFilePayload | undefined, user: AuthenticatedUser): Promise<UserProfile> {
    if (!file) {
      throw new BadRequestException('Profile picture file is required');
    }
    if (!AVATAR_TYPES.includes(file.mimetype as (typeof AVATAR_TYPES)[number])) {
      throw new BadRequestException('Profile picture must be JPEG, PNG, or WebP');
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException('Profile picture must be 2 MB or smaller');
    }

    const existing = await this.findProfileRow(user.id);
    const storageKey = `profiles/${user.id}/avatar-${randomUUID()}`;
    try {
      await this.storageService.putObject(storageKey, file.buffer, file.mimetype, file.size);
    } catch {
      throw new BadGatewayException('Profile picture storage is temporarily unavailable');
    }

    if (existing?.avatarStorageKey) {
      await this.storageService.deleteObject(existing.avatarStorageKey).catch(() => undefined);
    }

    const actorId = optionalUuid(user.id);
    if (existing) {
      await this.db
        .update(userProfiles)
        .set({
          avatarStorageKey: storageKey,
          avatarContentType: file.mimetype,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.id, existing.id));
    } else {
      await this.db.insert(userProfiles).values({
        userId: user.id,
        avatarStorageKey: storageKey,
        avatarContentType: file.mimetype,
        createdBy: actorId,
        updatedBy: actorId,
      });
    }

    return this.getProfile(user);
  }

  logout(): { message: string } {
    return { message: 'Logout acknowledged. Invalidate tokens on the client.' };
  }

  private async findProfileRow(userId: string) {
    const [row] = await this.db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return row ?? null;
  }

  private async toUserProfile(
    user: AuthenticatedUser,
    profile: typeof userProfiles.$inferSelect | null,
  ): Promise<UserProfile> {
    let avatarUrl: string | null = null;
    if (profile?.avatarStorageKey) {
      try {
        avatarUrl = await this.storageService.presignedGetObject(profile.avatarStorageKey, 3600);
      } catch {
        avatarUrl = null;
      }
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: profile?.displayName ?? null,
      avatarUrl,
      roles: user.roles,
      tenantId: user.tenantId,
    };
  }
}
