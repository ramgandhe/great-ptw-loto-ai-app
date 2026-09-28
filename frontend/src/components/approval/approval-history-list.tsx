"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import type { ApprovalHistoryEntry } from "@/lib/approval/types";
import { formatDateTime } from "@/lib/format";
import { loadLookups, type Lookups } from "@/lib/lookups";

/** Every approval decision on a permit, newest first: who, what, when, and the status it moved between. */
export function ApprovalHistoryList({ entries }: { entries: ApprovalHistoryEntry[] }) {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
  }, []);

  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No approval decisions recorded yet.</p>;

  return (
    <ol className="relative grid gap-3 border-l-2 border-border pl-4">
      {[...entries]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((entry) => (
          <li key={entry.id} className="relative text-sm">
            <span aria-hidden className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full border-2 border-card bg-(--accent-primary)" />
            <p className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-semibold first-letter:uppercase">{entry.action.replace(/_/g, " ")}</span>
              <time className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</time>
            </p>
            <p className="text-xs text-muted-foreground">{lookups?.people.get(entry.actorId)?.name ?? "System"}</p>
            {entry.fromStatus && entry.toStatus && entry.fromStatus !== entry.toStatus ? (
              <p className="mt-1 flex flex-wrap items-center gap-1">
                <PermitStatusBadge status={entry.fromStatus} className="py-0" />
                <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                <PermitStatusBadge status={entry.toStatus} className="py-0" />
              </p>
            ) : null}
            {entry.comment ? <p className="mt-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 leading-5">{entry.comment}</p> : null}
          </li>
        ))}
    </ol>
  );
}
