import type { EquipmentRestoration } from "@/lib/restoration/types";
import type { SequenceStep } from "@/lib/isolation-execution/types";
import { CheckCircle2, Circle } from "lucide-react";

type RestorationChecklistProps = {
  sequence: SequenceStep[];
  restorations: EquipmentRestoration[];
};

export function RestorationChecklist({ sequence, restorations }: RestorationChecklistProps) {
  const restoredPointIds = new Set(restorations.map((item) => item.isolationPointId));

  if (sequence.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No isolation sequence configured.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {sequence.map((step) => {
        const restored = restoredPointIds.has(step.isolationPointId);
        return (
          <li
            key={step.isolationPointId}
            className="flex items-start gap-3 rounded-lg border border-border p-3"
          >
            {restored ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
            )}
            <div>
              <p className="font-medium">
                Step {step.sequenceOrder}: {step.isolationNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {restored ? "Equipment restored" : "Restoration pending"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
