import type {
  AppliedLock,
  AppliedTag,
  IsolationVerification,
  SequenceStep,
} from "@/lib/isolation-execution/types";
import { CheckCircle2, Circle, Lock, Tag } from "lucide-react";

type IsolationChecklistProps = {
  sequence: SequenceStep[];
  locks: AppliedLock[];
  tags: AppliedTag[];
  verifications: IsolationVerification[];
};

export function IsolationChecklist({
  sequence,
  locks,
  tags,
  verifications,
}: IsolationChecklistProps) {
  const lockedPointIds = new Set(
    locks.filter((lock) => lock.status === "applied").map((lock) => lock.isolationPointId),
  );
  const taggedPointIds = new Set(
    tags.filter((tag) => tag.status === "applied").map((tag) => tag.isolationPointId),
  );
  const verifiedPointIds = new Set(
    verifications.filter((v) => v.result === "pass").map((v) => v.isolationPointId),
  );

  if (sequence.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No isolation sequence configured for this plan.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {sequence.map((step) => {
        const locked = lockedPointIds.has(step.isolationPointId);
        const tagged = taggedPointIds.has(step.isolationPointId);
        const verified = verifiedPointIds.has(step.isolationPointId);
        const complete =
          locked && tagged && (!step.requiresVerification || verified);

        return (
          <li
            key={step.isolationPointId}
            className="flex items-start gap-3 rounded-lg border border-border p-3"
          >
            {complete ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
            )}
            <div className="flex-1">
              <p className="font-medium">
                Step {step.sequenceOrder}: {step.isolationNumber}
              </p>
              {step.description ? (
                <p className="text-sm text-muted-foreground">{step.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" aria-hidden />
                  {locked ? "Locked" : "Lock pending"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3 w-3" aria-hidden />
                  {tagged ? "Tagged" : "Tag pending"}
                </span>
                {step.requiresVerification ? (
                  <span>{verified ? "Verified" : "Verification pending"}</span>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
