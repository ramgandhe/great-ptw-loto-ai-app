import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { lototoHistory } from '../../database/schema';
import { IsolationExecutionService } from '../isolation-execution/isolation-execution.service';

export interface HistoryEntry {
  tenantId: string;
  planId?: string | null;
  executionId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId: string;
  metadata?: Record<string, unknown>;
}

type DbClient = Pick<Database, 'insert'>;

/**
 * FR-LTO-013 / FR-LTO-014 — records and queries the append-only history of
 * every LOTOTO activity. `record` accepts an optional transaction client so
 * history entries are written atomically with the action that produced them.
 */
@Injectable()
export class HistoryService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly executionService: IsolationExecutionService,
  ) {}

  async record(entry: HistoryEntry, db?: DbClient) {
    const client = db ?? this.db;
    const [row] = await client
      .insert(lototoHistory)
      .values({
        tenantId: entry.tenantId,
        planId: entry.planId ?? null,
        executionId: entry.executionId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        actorId: entry.actorId,
        metadata: entry.metadata ?? null,
        createdBy: entry.actorId,
      })
      .returning();
    return row;
  }

  async listForExecution(executionId: string, user: AuthenticatedUser) {
    await this.executionService.getExecutionEntity(executionId, user);
    return this.db
      .select()
      .from(lototoHistory)
      .where(eq(lototoHistory.executionId, executionId))
      .orderBy(desc(lototoHistory.occurredAt));
  }

  async listForPlan(planId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    return this.db
      .select()
      .from(lototoHistory)
      .where(and(eq(lototoHistory.planId, planId), eq(lototoHistory.tenantId, tenantId)))
      .orderBy(desc(lototoHistory.occurredAt));
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
