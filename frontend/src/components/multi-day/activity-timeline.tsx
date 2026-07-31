import type { DailyActivityEvent, RevalidationHistoryEvent } from "@/lib/multi-day/types";

function formatEventLabel(eventType: string) {
  return eventType.replace(/_/g, " ");
}

export function DailyActivityTimeline({ events }: { events: DailyActivityEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No daily activity recorded yet.</p>;
  }

  return (
    <ol className="relative border-l border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="mb-4 last:mb-0">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-border bg-background" />
          <p className="text-sm font-medium capitalize">{formatEventLabel(event.eventType)}</p>
          <p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}

export function RevalidationHistoryTimeline({ events }: { events: RevalidationHistoryEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No revalidation history yet.</p>;
  }

  return (
    <ol className="relative border-l border-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="mb-4 last:mb-0">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-border bg-background" />
          <p className="text-sm font-medium capitalize">{formatEventLabel(event.eventType)}</p>
          <p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}
