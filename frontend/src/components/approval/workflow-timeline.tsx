import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatApproverRoleLabel } from "@/lib/approval/labels";
import type { WorkflowAssignmentRow } from "@/lib/approval/types";

function stepIcon(status: string) {
  if (status === "completed") {
    return CheckCircle2;
  }
  if (status === "active") {
    return Clock;
  }
  return Circle;
}

export function WorkflowTimeline({ workflow }: { workflow: WorkflowAssignmentRow[] }) {
  if (workflow.length === 0) {
    return <p className="text-sm text-muted-foreground">No workflow stages configured.</p>;
  }

  return (
    <ol className="grid gap-3">
      {workflow.map(({ assignment, step }) => {
        const Icon = stepIcon(assignment.status);
        const isActive = assignment.status === "active";
        const isCompleted = assignment.status === "completed";

        return (
          <li
            key={assignment.id}
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
                {step.stepSequence}. {step.name}
              </p>
              <p className="text-muted-foreground">
                {formatApproverRoleLabel(step.approverRole)} · {assignment.status.replace(/_/g, " ")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
