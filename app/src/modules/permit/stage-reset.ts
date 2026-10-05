import { and, eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { auditLogs, permits } from '../../database/schema';
import { clearStageAnswers, diffFormAnswers, stagesReopenedBy, type PermitFormResponse } from './permit-forms';

/**
 * A permit entering a new approval round (pending_approval) or closure round (execution_completed)
 * loses the answers signed at those stages in an earlier round, so each round's decision-makers sign
 * again. Runs in the transition's transaction; each removed answer is audited, and the revision moves
 * so a page opened before the transition cannot write over it.
 */
export async function resetStageAnswers(
  db: Pick<Database, 'select' | 'update' | 'insert'>,
  params: { permitId: string; tenantId: string; toStatus: string; actorId: string },
): Promise<void> {
  const stages = stagesReopenedBy(params.toStatus);
  if (stages.length === 0) return;
  const [permit] = await db
    .select({ formResponses: permits.formResponses, draftRevision: permits.draftRevision })
    .from(permits)
    .where(and(eq(permits.id, params.permitId), eq(permits.tenantId, params.tenantId)));
  if (!permit) return;
  const before = (permit.formResponses ?? []) as PermitFormResponse[];
  const after = clearStageAnswers(before, stages);
  const changes = diffFormAnswers(before, after);
  if (changes.length === 0) return;
  const revision = permit.draftRevision + 1;
  await db
    .update(permits)
    .set({ formResponses: after, draftRevision: revision })
    .where(and(eq(permits.id, params.permitId), eq(permits.tenantId, params.tenantId)));
  await db.insert(auditLogs).values(
    changes.map((change) => ({
      action: 'permit.form_answer_changed',
      entityType: 'permit',
      entityId: params.permitId,
      userId: params.actorId,
      tenantId: params.tenantId,
      metadata: { revision, reason: `cleared for a new ${params.toStatus === 'pending_approval' ? 'approval' : 'closure'} round`, ...change },
      createdBy: params.actorId,
    })),
  );
}
