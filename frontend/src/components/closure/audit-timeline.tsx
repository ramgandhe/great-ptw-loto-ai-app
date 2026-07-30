import type { AuditLogEntry } from "@/lib/closure/types";

export function AuditTimeline({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No audit records found.</p>;
  }

  const sorted = entries.slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <ul className="grid gap-2">
      {sorted.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-border px-3 py-2 text-sm">
          <p className="font-medium">{entry.action}</p>
          <p className="text-xs text-muted-foreground">
            {entry.entityType} · {new Date(entry.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
