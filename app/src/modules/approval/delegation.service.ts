import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt, isNull, lte } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { approvalDelegations } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { isDelegationActive } from './escalation-rules';
import { CreateDelegationDto } from './dto/create-delegation.dto';

@Injectable()
export class DelegationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateDelegationDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);

    if (!user.roles.includes(dto.coversRole)) {
      throw new ForbiddenException(
        `You can only delegate roles you hold. Missing role: ${dto.coversRole}`,
      );
    }

    if (dto.delegateId === user.id) {
      throw new BadRequestException('Cannot delegate to yourself');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (!(endsAt > startsAt)) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const [row] = await this.db
      .insert(approvalDelegations)
      .values({
        tenantId,
        delegatorId: user.id,
        delegateId: dto.delegateId,
        coversRole: dto.coversRole,
        startsAt,
        endsAt,
        comment: dto.comment?.trim() || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await this.auditService.log({
      action: 'approval.delegation_created',
      entityType: 'approval_delegation',
      entityId: row.id,
      userId: user.id,
      tenantId,
      metadata: {
        delegateId: dto.delegateId,
        coversRole: dto.coversRole,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      },
    });

    return this.serialize(row);
  }

  async listMine(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const rows = await this.db
      .select()
      .from(approvalDelegations)
      .where(
        and(
          eq(approvalDelegations.tenantId, tenantId),
          eq(approvalDelegations.delegatorId, user.id),
        ),
      )
      .orderBy(asc(approvalDelegations.startsAt));

    return rows.map((row) => this.serialize(row));
  }

  async revoke(id: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const [existing] = await this.db
      .select()
      .from(approvalDelegations)
      .where(
        and(
          eq(approvalDelegations.id, id),
          eq(approvalDelegations.tenantId, tenantId),
          eq(approvalDelegations.delegatorId, user.id),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Delegation not found');
    }

    const [row] = await this.db
      .update(approvalDelegations)
      .set({ revokedAt: new Date(), updatedBy: user.id })
      .where(eq(approvalDelegations.id, id))
      .returning();

    await this.auditService.log({
      action: 'approval.delegation_revoked',
      entityType: 'approval_delegation',
      entityId: id,
      userId: user.id,
      tenantId,
    });

    return this.serialize(row);
  }

  /**
   * FR-PTW-023 — find active delegation allowing delegate to act for coversRole.
   * Returns null if none / expired / revoked.
   */
  async findActiveForDelegate(
    tenantId: string,
    delegateId: string,
    coversRole: string,
    now = new Date(),
  ) {
    const rows = await this.db
      .select()
      .from(approvalDelegations)
      .where(
        and(
          eq(approvalDelegations.tenantId, tenantId),
          eq(approvalDelegations.delegateId, delegateId),
          eq(approvalDelegations.coversRole, coversRole),
          isNull(approvalDelegations.revokedAt),
          lte(approvalDelegations.startsAt, now),
          gt(approvalDelegations.endsAt, now),
        ),
      )
      .orderBy(asc(approvalDelegations.startsAt))
      .limit(5);

    return rows.find((row) => isDelegationActive(row, now)) ?? null;
  }

  private serialize(row: typeof approvalDelegations.$inferSelect) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      delegatorId: row.delegatorId,
      delegateId: row.delegateId,
      coversRole: row.coversRole,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      comment: row.comment,
      active: isDelegationActive(row, new Date()),
    };
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
