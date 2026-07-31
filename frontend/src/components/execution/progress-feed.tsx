import type { ProgressRecord } from "@/lib/execution/types";

export function ProgressFeed({ items }: { items: ProgressRecord[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No progress updates recorded.</p>;
  }

  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border px-3 py-2">
          <p className="text-sm">{item.summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(item.recordedAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
