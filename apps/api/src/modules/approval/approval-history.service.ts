import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  approvalHistory,
  type ApprovalHistoryAction,
} from '../../database/schema';

export interface ApprovalHistoryEntry {
  permitId: string;
  action: ApprovalHistoryAction;
  fromStatus?: string;
  toStatus?: string;
  actorId: string;
  comment?: string;
  workflowStepId?: string;
  permitApprovalId?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

type DbClient = Pick<Database, 'insert' | 'select'>;

@Injectable()
export class ApprovalHistoryService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async record(entry: ApprovalHistoryEntry, db?: DbClient) {
    const client = db ?? this.db;
    const [history] = await client
      .insert(approvalHistory)
      .values({
        permitId: entry.permitId,
        action: entry.action,
        fromStatus: entry.fromStatus ?? null,
        toStatus: entry.toStatus ?? null,
        actorId: entry.actorId,
        comment: entry.comment ?? null,
        workflowStepId: entry.workflowStepId ?? null,
        permitApprovalId: entry.permitApprovalId ?? null,
        metadata: entry.metadata ?? null,
        createdBy: entry.createdBy ?? entry.actorId,
      })
      .returning();

    return history;
  }

  async findByPermit(permitId: string) {
    return this.db
      .select()
      .from(approvalHistory)
      .where(eq(approvalHistory.permitId, permitId))
      .orderBy(asc(approvalHistory.createdAt));
  }
}
