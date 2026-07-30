import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  equipmentRestorations,
  lockRemovals,
  restorationVerifications,
  tagRemovals,
  type isolationExecution,
} from '../../database/schema';
import { HistoryService } from './history.service';

/**
 * FR-LTO-014 — compiles the complete execution history when a LOTOTO activity
 * is restored, writing an immutable summary entry into lototo_history.
 */
@Injectable()
export class ArchiveService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly historyService: HistoryService,
  ) {}

  async archiveExecution(
    execution: typeof isolationExecution.$inferSelect,
    user: AuthenticatedUser,
  ) {
    const [restorations, locks, tags, verifications] = await Promise.all([
      this.db.select().from(equipmentRestorations).where(eq(equipmentRestorations.executionId, execution.id)),
      this.db.select().from(lockRemovals).where(eq(lockRemovals.executionId, execution.id)),
      this.db.select().from(tagRemovals).where(eq(tagRemovals.executionId, execution.id)),
      this.db.select().from(restorationVerifications).where(eq(restorationVerifications.executionId, execution.id)),
    ]);

    const summary = {
      restorations: restorations.length,
      lockRemovals: locks.length,
      tagRemovals: tags.length,
      restorationVerifications: verifications.length,
    };

    await this.historyService.record({
      tenantId: execution.tenantId,
      planId: execution.planId,
      executionId: execution.id,
      action: 'execution.archived',
      entityType: 'isolation_execution',
      entityId: execution.id,
      actorId: user.id,
      metadata: summary,
    });

    return summary;
  }
}
