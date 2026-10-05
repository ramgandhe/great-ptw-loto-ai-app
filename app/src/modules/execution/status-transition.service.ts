import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  permitStatusHistory,
  permits,
  type PermitStatusHistoryAction,
} from '../../database/schema';
import { resetStageAnswers } from '../permit/stage-reset';

export interface StatusTransitionEntry {
  permitId: string;
  tenantId: string;
  executionId?: string;
  action: PermitStatusHistoryAction;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  comment?: string;
  metadata?: Record<string, unknown>;
}

type DbClient = Pick<Database, 'insert' | 'update' | 'select'>;

@Injectable()
export class StatusTransitionService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async transition(entry: StatusTransitionEntry, db?: DbClient) {
    const client = db ?? this.db;

    await client
      .update(permits)
      .set({ status: entry.toStatus, updatedBy: entry.actorId })
      .where(and(eq(permits.id, entry.permitId), eq(permits.tenantId, entry.tenantId)));

    const [history] = await client
      .insert(permitStatusHistory)
      .values({
        permitId: entry.permitId,
        executionId: entry.executionId ?? null,
        action: entry.action,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        actorId: entry.actorId,
        comment: entry.comment ?? null,
        metadata: entry.metadata ?? null,
        createdBy: entry.actorId,
      })
      .returning();

    // A new approval or closure round needs fresh signatures from that round's decision-makers.
    await resetStageAnswers(client, { permitId: entry.permitId, tenantId: entry.tenantId, toStatus: entry.toStatus, actorId: entry.actorId });

    return history;
  }
}
