import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  permitDailyProgress,
  permitEvidence,
  permitProgress,
  supervisorCosignatures,
  type CosignSourceEntityType,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { ApprovalHistoryService } from '../approval/approval-history.service';
import { PermitService } from '../permit/permit.service';
import { CreateCosignatureDto } from './dto/create-cosignature.dto';

@Injectable()
export class CosignatureService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly approvalHistoryService: ApprovalHistoryService,
    private readonly auditService: AuditService,
  ) {}

  async cosign(permitId: string, dto: CreateCosignatureDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.permitService.findOne(permitId, user);

    if (!user.roles.includes('supervisor')) {
      throw new ForbiddenException('Only supervisors may co-sign executor evidence');
    }

    await this.assertSourceExists(permitId, dto.sourceEntityType, dto.sourceEntityId);

    const [existing] = await this.db
      .select({ id: supervisorCosignatures.id })
      .from(supervisorCosignatures)
      .where(
        and(
          eq(supervisorCosignatures.tenantId, tenantId),
          eq(supervisorCosignatures.sourceEntityType, dto.sourceEntityType),
          eq(supervisorCosignatures.sourceEntityId, dto.sourceEntityId),
          eq(supervisorCosignatures.supervisorId, user.id),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('Supervisor has already co-signed this entry');
    }

    // Snapshot original executor entry before insert — must remain unchanged (FR-ROL-004).
    const sourceSnapshot = await this.loadSourceSnapshot(
      dto.sourceEntityType,
      dto.sourceEntityId,
    );

    const [row] = await this.db
      .insert(supervisorCosignatures)
      .values({
        tenantId,
        permitId,
        sourceEntityType: dto.sourceEntityType,
        sourceEntityId: dto.sourceEntityId,
        supervisorId: user.id,
        comment: dto.comment?.trim() || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    const afterSnapshot = await this.loadSourceSnapshot(
      dto.sourceEntityType,
      dto.sourceEntityId,
    );

    if (JSON.stringify(sourceSnapshot) !== JSON.stringify(afterSnapshot)) {
      throw new ConflictException('Co-sign must not mutate the executor source entry');
    }

    await this.approvalHistoryService.record({
      permitId,
      action: 'supervisor_cosign',
      actorId: user.id,
      comment: dto.comment,
      metadata: {
        cosignatureId: row.id,
        sourceEntityType: dto.sourceEntityType,
        sourceEntityId: dto.sourceEntityId,
        linkedNotOverwrite: true,
      },
      createdBy: user.id,
    });

    await this.auditService.log({
      action: 'permit.supervisor_cosign',
      entityType: 'supervisor_cosignature',
      entityId: row.id,
      userId: user.id,
      tenantId,
      metadata: {
        permitId,
        sourceEntityType: dto.sourceEntityType,
        sourceEntityId: dto.sourceEntityId,
        linkedNotOverwrite: true,
      },
    });

    return this.serialize(row);
  }

  async listForPermit(permitId: string, user: AuthenticatedUser) {
    await this.permitService.findOne(permitId, user);

    const rows = await this.db
      .select()
      .from(supervisorCosignatures)
      .where(eq(supervisorCosignatures.permitId, permitId))
      .orderBy(asc(supervisorCosignatures.signedAt));

    return rows.map((row) => this.serialize(row));
  }

  private async assertSourceExists(
    permitId: string,
    sourceEntityType: CosignSourceEntityType,
    sourceEntityId: string,
  ) {
    if (sourceEntityType === 'permit_progress') {
      const [row] = await this.db
        .select({ id: permitProgress.id })
        .from(permitProgress)
        .where(and(eq(permitProgress.id, sourceEntityId), eq(permitProgress.permitId, permitId)))
        .limit(1);
      if (!row) {
        throw new NotFoundException('Progress entry not found for this permit');
      }
      return;
    }

    if (sourceEntityType === 'permit_evidence') {
      const [row] = await this.db
        .select({ id: permitEvidence.id })
        .from(permitEvidence)
        .where(and(eq(permitEvidence.id, sourceEntityId), eq(permitEvidence.permitId, permitId)))
        .limit(1);
      if (!row) {
        throw new NotFoundException('Evidence entry not found for this permit');
      }
      return;
    }

    if (sourceEntityType === 'permit_daily_progress') {
      const [row] = await this.db
        .select({ id: permitDailyProgress.id })
        .from(permitDailyProgress)
        .where(
          and(
            eq(permitDailyProgress.id, sourceEntityId),
            eq(permitDailyProgress.permitId, permitId),
          ),
        )
        .limit(1);
      if (!row) {
        throw new NotFoundException('Daily progress entry not found for this permit');
      }
      return;
    }

    // lototo_checklist — validate as opaque UUID belonging to tenant via existence later;
    // accept ID presence for now; dedicated LOTOTO checklist FK can tighten this later.
    if (!sourceEntityId) {
      throw new NotFoundException('Source entity not found');
    }
  }

  private async loadSourceSnapshot(
    sourceEntityType: CosignSourceEntityType,
    sourceEntityId: string,
  ) {
    if (sourceEntityType === 'permit_progress') {
      const [row] = await this.db
        .select()
        .from(permitProgress)
        .where(eq(permitProgress.id, sourceEntityId))
        .limit(1);
      return row ?? null;
    }

    if (sourceEntityType === 'permit_evidence') {
      const [row] = await this.db
        .select()
        .from(permitEvidence)
        .where(eq(permitEvidence.id, sourceEntityId))
        .limit(1);
      return row ?? null;
    }

    if (sourceEntityType === 'permit_daily_progress') {
      const [row] = await this.db
        .select()
        .from(permitDailyProgress)
        .where(eq(permitDailyProgress.id, sourceEntityId))
        .limit(1);
      return row ?? null;
    }

    return { id: sourceEntityId };
  }

  private serialize(row: typeof supervisorCosignatures.$inferSelect) {
    return {
      id: row.id,
      permitId: row.permitId,
      tenantId: row.tenantId,
      sourceEntityType: row.sourceEntityType,
      sourceEntityId: row.sourceEntityId,
      supervisorId: row.supervisorId,
      comment: row.comment,
      signedAt: row.signedAt.toISOString(),
    };
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
