import type { EvidenceRecord, PermitExecution, ProgressRecord } from "@/lib/execution/types";

type ActivityEntry = {
  id: string;
  type: "status" | "progress" | "evidence";
  label: string;
  at: string;
  detail?: string | null;
};

function buildActivity(
  execution: PermitExecution | null,
  progress: ProgressRecord[],
  evidence: EvidenceRecord[],
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  if (execution) {
    entries.push({
      id: `activated-${execution.id}`,
      type: "status",
      label: "Work activated",
      at: execution.actualStartAt,
    });
    if (execution.suspendedAt) {
      entries.push({
        id: `suspended-${execution.id}`,
        type: "status",
        label: "Work suspended",
        at: execution.suspendedAt,
        detail: execution.suspensionReason,
      });
    }
    if (execution.resumedAt) {
      entries.push({
        id: `resumed-${execution.id}`,
        type: "status",
        label: "Work resumed",
        at: execution.resumedAt,
      });
    }
  }

  for (const item of progress) {
    entries.push({
      id: item.id,
      type: "progress",
      label: "Progress update",
      at: item.recordedAt,
      detail: item.summary,
    });
  }

  for (const item of evidence) {
    entries.push({
      id: item.id,
      type: "evidence",
      label: "Evidence uploaded",
      at: item.createdAt,
      detail: item.fileName,
    });
  }

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

const typeLabels: Record<ActivityEntry["type"], string> = {
  status: "Status",
  progress: "Progress",
  evidence: "Evidence",
};

export function ActivityLog({
  execution,
  progress,
  evidence,
}: {
  execution: PermitExecution | null;
  progress: ProgressRecord[];
  evidence: EvidenceRecord[];
}) {
  const entries = buildActivity(execution, progress, evidence);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded.</p>;
  }

  return (
    <ul className="grid gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <span className="shrink-0 text-xs font-medium uppercase text-muted-foreground">
            {typeLabels[entry.type]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{entry.label}</p>
            {entry.detail ? <p className="text-muted-foreground">{entry.detail}</p> : null}
            <p className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
