import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  appliedLocks,
  isolationSequences,
  isolationVerifications,
  type IsolationExecutionStatus,
} from '../../database/schema';
import {
  EXECUTION_IN_PROGRESS,
  EXECUTION_ISOLATED,
  LOCK_APPLIED,
  VERIFICATION_PASS,
} from './isolation-execution.constants';

type DbClient = Pick<Database, 'select'>;

/**
 * Centralises the safety-critical workflow rules for isolation execution:
 * legal status transitions, lock application sequence (FR-LTO-008) and the
 * prerequisites for verification (FR-LTO-007) and isolation completion.
 * Keeping this here keeps controllers/services thin and the rules auditable.
 */
@Injectable()
export class StatusValidationService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  assertExecutionEditable(status: string): void {
    if (status !== EXECUTION_IN_PROGRESS) {
      throw new ConflictException(
        `Isolation activities require execution status '${EXECUTION_IN_PROGRESS}', but it is '${status}'`,
      );
    }
  }

  assertTransition(from: string, to: IsolationExecutionStatus): void {
    const allowed: Record<string, IsolationExecutionStatus[]> = {
      in_progress: ['isolated'],
      isolated: ['verified'],
      verified: ['restored'],
      restored: [],
    };

    if (!allowed[from]?.includes(to)) {
      throw new ConflictException(`Invalid state transition: '${from}' -> '${to}'`);
    }
  }

  /**
   * FR-LTO-008 — a lock may only be applied to the next isolation point in the
   * approved sequence: every point with a lower sequence_order must already
   * have an applied lock. Points not present in isolation_sequences have no
   * ordering constraint.
   */
  async assertLockSequence(
    executionId: string,
    planId: string,
    isolationPointId: string,
    db?: DbClient,
  ): Promise<void> {
    const client = db ?? this.db;

    const sequences = await client
      .select()
      .from(isolationSequences)
      .where(eq(isolationSequences.planId, planId))
      .orderBy(asc(isolationSequences.sequenceOrder));

    const target = sequences.find((s) => s.isolationPointId === isolationPointId);

    // No sequence entry for this point => no ordering constraint.
    if (!target) {
      return;
    }

    const predecessors = sequences.filter((s) => s.sequenceOrder < target.sequenceOrder);
    if (predecessors.length === 0) {
      return;
    }

    const locks = await client
      .select()
      .from(appliedLocks)
      .where(
        and(eq(appliedLocks.executionId, executionId), eq(appliedLocks.status, LOCK_APPLIED)),
      );

    const lockedPointIds = new Set(locks.map((l) => l.isolationPointId));

    const missing = predecessors.filter((p) => !lockedPointIds.has(p.isolationPointId));
    if (missing.length > 0) {
      throw new ConflictException(
        'Locks must be applied in the approved isolation sequence order; earlier isolation points are not yet locked',
      );
    }
  }

  /**
   * A point may only be verified once it has an applied lock (FR-LTO-007 —
   * verification of successful energy isolation).
   */
  async assertPointLocked(
    executionId: string,
    isolationPointId: string,
    db?: DbClient,
  ): Promise<void> {
    const client = db ?? this.db;

    const [lock] = await client
      .select()
      .from(appliedLocks)
      .where(
        and(
          eq(appliedLocks.executionId, executionId),
          eq(appliedLocks.isolationPointId, isolationPointId),
          eq(appliedLocks.status, LOCK_APPLIED),
        ),
      );

    if (!lock) {
      throw new ConflictException(
        'Isolation point must have an applied lock before it can be verified',
      );
    }
  }

  /**
   * Isolation is complete only when every sequenced isolation point has an
   * applied lock (FR-LTO-008).
   */
  async assertAllPointsLocked(executionId: string, planId: string): Promise<void> {
    const sequences = await this.db
      .select()
      .from(isolationSequences)
      .where(eq(isolationSequences.planId, planId));

    if (sequences.length === 0) {
      throw new ConflictException(
        'Isolation plan has no configured isolation sequence to execute',
      );
    }

    const locks = await this.db
      .select()
      .from(appliedLocks)
      .where(
        and(eq(appliedLocks.executionId, executionId), eq(appliedLocks.status, LOCK_APPLIED)),
      );
    const lockedPointIds = new Set(locks.map((l) => l.isolationPointId));

    const missing = sequences.filter((s) => !lockedPointIds.has(s.isolationPointId));
    if (missing.length > 0) {
      throw new ConflictException(
        'All isolation points in the sequence must be locked before isolation can be marked complete',
      );
    }
  }

  /**
   * Verification is complete only when every point that requires verification
   * has a passing verification record (FR-LTO-007).
   */
  async assertAllPointsVerified(executionId: string, planId: string): Promise<void> {
    const sequences = await this.db
      .select()
      .from(isolationSequences)
      .where(eq(isolationSequences.planId, planId));

    const requiresVerification = sequences.filter((s) => s.requiresVerification);
    if (requiresVerification.length === 0) {
      return;
    }

    const passes = await this.db
      .select()
      .from(isolationVerifications)
      .where(
        and(
          eq(isolationVerifications.executionId, executionId),
          eq(isolationVerifications.result, VERIFICATION_PASS),
        ),
      );
    const verifiedPointIds = new Set(passes.map((v) => v.isolationPointId));

    const missing = requiresVerification.filter(
      (s) => !verifiedPointIds.has(s.isolationPointId),
    );
    if (missing.length > 0) {
      throw new ConflictException(
        'All isolation points requiring verification must have a passing verification before isolation is verified',
      );
    }
  }

  assertVerifiable(status: string): void {
    if (status !== EXECUTION_IN_PROGRESS && status !== EXECUTION_ISOLATED) {
      throw new ConflictException(
        `Verifications can only be recorded while execution is '${EXECUTION_IN_PROGRESS}' or '${EXECUTION_ISOLATED}', but it is '${status}'`,
      );
    }
  }

  assertReadyForVerification(status: string): void {
    if (status !== EXECUTION_ISOLATED) {
      throw new ConflictException(
        `Verification completion requires execution status '${EXECUTION_ISOLATED}', but it is '${status}'`,
      );
    }
  }
}
