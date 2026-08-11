import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  permitStatusHistory,
  permits,
  type PermitStatusHistoryAction,
} from '../../database/schema';
import { PermitLifecycleService } from '../permit/permit-lifecycle.service';

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

type DbClient = Pick<Database, 'insert' | 'update'>;

@Injectable()
export class StatusTransitionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitLifecycleService: PermitLifecycleService,
  ) {}

  async transition(entry: StatusTransitionEntry, db?: DbClient) {
    const client = db ?? this.db;

    this.permitLifecycleService.assertTransition(entry.fromStatus, entry.toStatus);

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

    return history;
  }
}
