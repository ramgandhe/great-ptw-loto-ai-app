import type { PermitExecution, WorkHistoryEvent } from "@/lib/execution/types";
import { formatDateTime } from "@/lib/format";

type StatusEvent = {
  id: string;
  label: string;
  at: string;
  detail?: string | null;
};

function buildEvents(
  execution: PermitExecution | null,
  history?: WorkHistoryEvent[] | null,
): StatusEvent[] {
  if (!execution) {
    return [];
  }

  const events: StatusEvent[] = [
    {
      id: "activated",
      label: "Work activated",
      at: execution.actualStartAt,
    },
  ];

  if (history && history.length > 0) {
    for (const row of history) {
      if (row.kind === "paused") {
        events.push({
          id: `paused-${row.id}`,
          label: "Work paused",
          at: row.at,
          detail: row.summary,
        });
      } else {
        events.push({
          id: `resumed-${row.id}`,
          label: "Work resumed",
          at: row.at,
        });
      }
    }
  } else {
    if (execution.workPausedAt) {
      events.push({
        id: "work-paused",
        label: "Work paused",
        at: execution.workPausedAt,
      });
    }
    if (execution.workResumedAt) {
      events.push({
        id: "work-resumed",
        label: "Work resumed",
        at: execution.workResumedAt,
      });
    }
  }

  if (execution.suspendedAt) {
    events.push({
      id: "suspended",
      label: "Permit suspended",
      at: execution.suspendedAt,
      detail: execution.suspensionReason,
    });
  }

  if (execution.resumedAt) {
    events.push({
      id: "resumed",
      label: "Permit resumed from suspension",
      at: execution.resumedAt,
    });
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function StatusTimeline({
  execution,
  history,
}: {
  execution: PermitExecution | null;
  history?: WorkHistoryEvent[] | null;
}) {
  const events = buildEvents(execution, history);

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No execution activity yet.</p>;
  }

  return (
    <ol className="relative border-l border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="mb-4 last:mb-0">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-border bg-background" />
          <p className="text-sm font-medium">{event.label}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
          {event.detail ? (
            <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
