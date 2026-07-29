import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  approvalHistory,
  auditHistory,
  auditLogs,
  permitStatusHistory,
} from '../../database/schema';
import { PermitService } from '../permit/permit.service';

@Injectable()
export class HistoryService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
  ) {}

  async getHistory(permitId: string, user: AuthenticatedUser) {
    await this.permitService.findOne(permitId, user);

    const [approvalRows, statusRows] = await Promise.all([
      this.db
        .select()
        .from(approvalHistory)
        .where(eq(approvalHistory.permitId, permitId))
        .orderBy(asc(approvalHistory.createdAt)),
      this.db
        .select()
        .from(permitStatusHistory)
        .where(eq(permitStatusHistory.permitId, permitId))
        .orderBy(asc(permitStatusHistory.createdAt)),
    ]);

    const entries = [
      ...approvalRows.map((row) => ({
        id: row.id,
        permitId: row.permitId,
        action: row.action,
        actorId: row.actorId,
        comment: row.comment,
        createdAt: row.createdAt.toISOString(),
        metadata: row.metadata ?? null,
      })),
      ...statusRows.map((row) => ({
        id: row.id,
        permitId: row.permitId,
        action: row.action,
        actorId: row.actorId,
        comment: row.comment,
        createdAt: row.createdAt.toISOString(),
        metadata: row.metadata ?? null,
      })),
    ];

    return entries.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  async getAudit(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.permitService.findOne(permitId, user);

    const [historyRows, logRows] = await Promise.all([
      this.db
        .select()
        .from(auditHistory)
        .where(eq(auditHistory.permitId, permitId))
        .orderBy(asc(auditHistory.createdAt)),
      this.db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityId, permitId), eq(auditLogs.tenantId, tenantId)))
        .orderBy(asc(auditLogs.createdAt)),
    ]);

    const entries = [
      ...historyRows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: 'permit',
        entityId: row.permitId,
        userId: row.actorId,
        createdAt: row.createdAt.toISOString(),
        metadata: {
          ...(row.metadata ?? {}),
          ...(row.comment ? { comment: row.comment } : {}),
        },
      })),
      ...logRows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId ?? permitId,
        userId: row.userId ?? '',
        createdAt: row.createdAt.toISOString(),
        metadata: row.metadata ?? null,
      })),
    ];

    return entries.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
