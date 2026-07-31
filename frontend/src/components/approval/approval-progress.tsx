import type { WorkflowAssignmentRow } from "@/lib/approval/types";

export function ApprovalProgressIndicator({ workflow }: { workflow: WorkflowAssignmentRow[] }) {
  const total = workflow.length;
  const completed = workflow.filter((row) => row.assignment.status === "completed").length;
  const active = workflow.find((row) => row.assignment.status === "active");
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">Approval progress</span>
        <span className="text-muted-foreground">
          {completed} of {total} stages complete
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Approval progress"
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      {active ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Current stage: <span className="font-medium text-foreground">{active.step.name}</span>
        </p>
      ) : null}
    </div>
  );
}
