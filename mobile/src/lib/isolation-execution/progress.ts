// Same as the web app (frontend/src/lib/isolation-execution/progress.ts).
import type { AppliedLock, AppliedTag, IsolationVerification, SequenceStep } from "./types";

export type PointState = {
  step: SequenceStep;
  lock: AppliedLock | undefined;
  tag: AppliedTag | undefined;
  verification: IsolationVerification | undefined;
  /** Locked, tagged and, where required, verified. */
  done: boolean;
  /** Every earlier point is locked, so this one may be locked now (the API's sequence rule). */
  open: boolean;
};

/** Each isolation point's progress in sequence order, and the first point still to finish. */
export function isolationProgress(
  sequence: SequenceStep[],
  locks: AppliedLock[],
  tags: AppliedTag[],
  verifications: IsolationVerification[],
): { points: PointState[]; current: PointState | undefined; left: number } {
  let earlierLocked = true;
  const points = [...sequence]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    .map((step) => {
      const lock = locks.find((l) => l.isolationPointId === step.isolationPointId && l.status === "applied");
      const tag = tags.find((t) => t.isolationPointId === step.isolationPointId && t.status === "applied");
      const verification = verifications.find((v) => v.isolationPointId === step.isolationPointId && v.result === "pass");
      const point = { step, lock, tag, verification, done: Boolean(lock && tag && (!step.requiresVerification || verification)), open: earlierLocked };
      earlierLocked &&= Boolean(lock);
      return point;
    });
  return { points, current: points.find((p) => !p.done), left: points.filter((p) => !p.done).length };
}
