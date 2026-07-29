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
import { permitEvidence, permits } from '../../database/schema';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { EXECUTION_READ_ROLES } from './execution.constants';

const VIEWABLE_STATUSES = ['active', 'suspended'] as const;

@Injectable()
export class ExecutionEvidenceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async getDownloadUrl(
    permitId: string,
    evidenceId: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    if (!this.userCanViewEvidence(user)) {
      throw new ForbiddenException('Insufficient permissions to view evidence');
    }

    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, user.tenantId)));

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    if (!VIEWABLE_STATUSES.includes(permit.status as (typeof VIEWABLE_STATUSES)[number])) {
      throw new ForbiddenException('Evidence is not available for this permit status');
    }

    const [evidence] = await this.db
      .select()
      .from(permitEvidence)
      .where(and(eq(permitEvidence.id, evidenceId), eq(permitEvidence.permitId, permitId)));

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    const expiresInSeconds =
      this.configService.get<number>('execution.evidenceUrlExpirySeconds') ?? 3600;

    const url = await this.storageService.presignedGetObject(
      evidence.storageKey,
      expiresInSeconds,
    );

    return { url, expiresInSeconds };
  }

  private userCanViewEvidence(user: AuthenticatedUser): boolean {
    return user.roles.some((role) =>
      (EXECUTION_READ_ROLES as readonly string[]).includes(role),
    );
  }
}
