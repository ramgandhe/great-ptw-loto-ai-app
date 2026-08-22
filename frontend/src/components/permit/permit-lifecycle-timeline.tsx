import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatApproverRoleLabel } from "@/lib/approval/labels";
import type { LifecyclePhaseState } from "@/lib/permit/lifecycle";

function stepIcon(status: LifecyclePhaseState["status"]) {
  if (status === "completed") return CheckCircle2;
  if (status === "active") return Clock;
  return Circle;
}

export function PermitLifecycleTimeline({ phases }: { phases: LifecyclePhaseState[] }) {
  const completed = phases.filter((phase) => phase.status === "completed").length;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">Permit lifecycle</span>
        <span className="text-muted-foreground">
          {completed} of {phases.length} phases complete
        </span>
      </div>
      <ol className="grid gap-3">
        {phases.map((phase) => {
          const Icon = stepIcon(phase.status);
          const isActive = phase.status === "active";
          const isCompleted = phase.status === "completed";

          return (
            <li
              key={phase.sequence}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm",
                isActive && "border-primary/40 bg-primary/5",
                isCompleted && "border-border bg-muted/30",
                !isActive && !isCompleted && "border-border",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  isCompleted && "text-emerald-600 dark:text-emerald-400",
                  isActive && "text-amber-600 dark:text-amber-400",
                  !isActive && !isCompleted && "text-muted-foreground",
                )}
                aria-hidden
              />
              <div>
                <p className="font-medium">
                  {phase.sequence}. {phase.name}
                </p>
                <p className="text-muted-foreground">
                  {formatApproverRoleLabel(phase.participantRole)}
                  {phase.kind === "approval" || phase.kind === "closure"
                    ? " · approval"
                    : " · data entry"}
                  {" · "}
                  {phase.status.replace(/_/g, " ")}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
