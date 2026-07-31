import type { LototoHistoryEntry } from "@/lib/restoration/types";

export function RestorationTimeline({ entries }: { entries: LototoHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No history recorded yet.</p>;
  }

  return (
    <ol className="space-y-3 border-l border-border pl-4">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
          <p className="text-sm font-medium">{entry.action.replace(/\./g, " · ")}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(entry.occurredAt).toLocaleString()} · {entry.entityType}
          </p>
        </li>
      ))}
    </ol>
  );
}
