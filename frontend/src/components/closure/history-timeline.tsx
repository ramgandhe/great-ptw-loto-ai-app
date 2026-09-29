import { Check, Undo2, X } from "lucide-react";
import type { PermitHistoryEntry } from "@/lib/closure/types";
import { formatDateTime } from "@/lib/format";
import { EDGES } from "@/lib/permit/process";
import { cn } from "@/lib/utils";

/** Dot colour by what the step did: completed (forward), sent back, or stopped. */
function toneOf(action: string) {
  const tone = EDGES.find((edge) => edge.actions.includes(action))?.tone;
  if (tone === "stop") return { dot: "bg-(--status-danger)", label: "Stopped", Icon: X };
  if (tone === "back") return { dot: "bg-(--status-warning)", label: "Sent back", Icon: Undo2 };
  return { dot: "bg-(--status-success)", label: "Completed", Icon: Check };
}

export function HistoryTimeline({ entries }: { entries: PermitHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No lifecycle history recorded.</p>;
  }

  const sorted = entries.slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <ol className="relative border-l-2 border-(--status-success)/40 pl-5">
      {sorted.map((entry, index) => {
        const tone = toneOf(entry.action);
        return (
          <li key={entry.id} className="relative mb-4 last:mb-0">
            <span
              aria-hidden
              className={cn(
                "absolute -left-[1.85rem] top-0.5 flex size-5 items-center justify-center rounded-full text-white",
                tone.dot,
                index === 0 && "ring-4 ring-(--status-success)/20",
              )}
            >
              <tone.Icon className="size-3" strokeWidth={3} />
            </span>
            <p className="text-sm font-medium capitalize">
              {entry.action.replace(/[._]/g, " ")}
              <span className="sr-only"> ({tone.label})</span>
              {index === 0 ? <span className="ml-2 text-xs font-normal normal-case text-muted-foreground">Latest</span> : null}
            </p>
            {entry.comment ? (
              <p className="text-sm text-muted-foreground">{entry.comment}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
          </li>
        );
      })}
    </ol>
  );
}
