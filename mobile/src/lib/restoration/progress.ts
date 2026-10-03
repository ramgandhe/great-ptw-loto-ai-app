// Same as the web app (frontend/src/lib/restoration/progress.ts).
import type { AppliedLock, AppliedTag, SequenceStep } from "@/lib/isolation-execution/types";
import type { EquipmentRestoration, RestorationDetail } from "./types";

export type RestorationPoint = {
  step: SequenceStep;
  /** Locks and tags still on this point. */
  locks: AppliedLock[];
  tags: AppliedTag[];
  restored: EquipmentRestoration | undefined;
  /** Locks and tags off and the equipment restored. */
  done: boolean;
};

/** What is still on each point, in sequence order, the first point to work on, and the totals outstanding. */
export function restorationProgress(sequence: SequenceStep[], locks: AppliedLock[], tags: AppliedTag[], restoration: RestorationDetail) {
  const removedLocks = new Set(restoration.lockRemovals.map((r) => r.appliedLockId));
  const removedTags = new Set(restoration.tagRemovals.map((r) => r.appliedTagId));
  const points: RestorationPoint[] = [...sequence]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    .map((step) => {
      const onPoint = <T extends { id: string; isolationPointId: string; status: string }>(items: T[], removed: Set<string>) =>
        items.filter((item) => item.isolationPointId === step.isolationPointId && item.status === "applied" && !removed.has(item.id));
      const pointLocks = onPoint(locks, removedLocks);
      const pointTags = onPoint(tags, removedTags);
      const restored = restoration.restorations.find((r) => r.isolationPointId === step.isolationPointId);
      return { step, locks: pointLocks, tags: pointTags, restored, done: Boolean(restored) && pointLocks.length === 0 && pointTags.length === 0 };
    });
  return {
    points,
    current: points.find((p) => !p.done),
    outstanding: {
      locks: points.reduce((n, p) => n + p.locks.length, 0),
      tags: points.reduce((n, p) => n + p.tags.length, 0),
      points: points.filter((p) => !p.restored).length,
    },
  };
}
