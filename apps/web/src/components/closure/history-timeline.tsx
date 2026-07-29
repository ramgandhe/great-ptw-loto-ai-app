import type { PermitHistoryEntry } from "@/lib/closure/types";

export function HistoryTimeline({ entries }: { entries: PermitHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No lifecycle history recorded.</p>;
  }

  const sorted = entries.slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <ol className="relative border-l border-border pl-4">
      {sorted.map((entry) => (
        <li key={entry.id} className="mb-4 last:mb-0">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-border bg-background" />
          <p className="text-sm font-medium capitalize">{entry.action.replace(/[._]/g, " ")}</p>
          {entry.comment ? (
            <p className="text-sm text-muted-foreground">{entry.comment}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}
