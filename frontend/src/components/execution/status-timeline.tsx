import type { PermitExecution } from "@/lib/execution/types";

type StatusEvent = {
  id: string;
  label: string;
  at: string;
  detail?: string | null;
};

function buildEvents(execution: PermitExecution | null): StatusEvent[] {
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

  if (execution.suspendedAt) {
    events.push({
      id: "suspended",
      label: "Work suspended",
      at: execution.suspendedAt,
      detail: execution.suspensionReason,
    });
  }

  if (execution.resumedAt) {
    events.push({
      id: "resumed",
      label: "Work resumed",
      at: execution.resumedAt,
    });
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function StatusTimeline({ execution }: { execution: PermitExecution | null }) {
  const events = buildEvents(execution);

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No execution activity yet.</p>;
  }

  return (
    <ol className="relative border-l border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="mb-4 last:mb-0">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-border bg-background" />
          <p className="text-sm font-medium">{event.label}</p>
          <p className="text-xs text-muted-foreground">{new Date(event.at).toLocaleString()}</p>
          {event.detail ? (
            <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
