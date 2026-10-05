"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { PermitTypeChip } from "@/components/permit/permit-type-chip";
import { ActionLink } from "@/components/work/action-link";
import { Button } from "@/components/ui/button";
import { permitStatusColor } from "@/lib/permit/status";
import { formatWindow } from "@/lib/format";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";
import { cn } from "@/lib/utils";
import { WORK_ACTIONS, type WorkAction, type WorkItem } from "@/lib/work-queue";
import { useWorkQueue } from "@/lib/work-queue-context";

// Few enough that one busy group (e.g. many clashes) can't push the next group off screen.
const PER_GROUP = 3;

/** Rows with the same title (e.g. several identical clash warnings) read as one line with a count. */
function collapseAlike(rows: WorkItem[]): { item: WorkItem; alike: number }[] {
  const byTitle = new Map<string, { item: WorkItem; alike: number }>();
  for (const item of rows) {
    const seen = byTitle.get(item.title);
    if (seen) seen.alike += 1;
    else byTitle.set(item.title, { item, alike: 1 });
  }
  return [...byTitle.values()];
}

function WorkRow({ item, alike, lookups }: { item: WorkItem; alike: number; lookups: Lookups | null }) {
  const { permit } = item;
  const type = permit ? lookups?.permitTypes.get(permit.permitTypeId) : undefined;
  const place = permit
    ? (nameOf(lookups?.machinery, permit.machineryId) ??
      nameOf(lookups?.workstations, permit.workstationId) ??
      nameOf(lookups?.locations, permit.locationId))
    : null;

  return (
    <li className="row-hover relative flex flex-wrap items-center rounded-r-lg gap-x-4 gap-y-2 py-3 pl-4 pr-1 sm:flex-nowrap">
      {/* The left rule carries the permit's status colour, as on the badge and the process map. */}
      <span
        aria-hidden
        className="absolute inset-y-3 left-0 w-1 rounded-full bg-border"
        style={permit ? { backgroundColor: permitStatusColor(permit.status) } : undefined}
      />
      <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
        <Link href={item.href} className="font-semibold hover:underline">
          {item.title}
        </Link>
        {alike > 1 ? (
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            ×{alike}
          </span>
        ) : null}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {permit ? <PermitStatusBadge status={permit.status} className="px-2 py-0" /> : null}
          {item.reference ? <span className="rounded-md bg-muted px-1.5 font-mono font-semibold text-foreground">{item.reference}</span> : null}
          {type ? <PermitTypeChip name={type.name} color={type.color} className="py-0" /> : null}
          {place ? <span>{place}</span> : null}
          {permit ? <span>{formatWindow(permit.plannedStartAt, permit.plannedEndAt)}</span> : null}
          {item.meta ? <span className="first-letter:uppercase">{item.meta}</span> : null}
        </p>
      </div>
      {item.note ? (
        <span
          className={cn(
            "flex flex-1 items-center gap-1 text-xs sm:flex-none",
            item.urgent ? "font-medium text-(--status-danger)" : "text-muted-foreground",
          )}
        >
          {item.urgent ? <TriangleAlert className="size-3.5" aria-hidden /> : null}
          {item.note}
        </span>
      ) : null}
      <ActionLink item={item} className="ml-auto" />
    </li>
  );
}

/** Shown while part of the queue could not be read, so a gap never looks like an empty queue. */
export function WorkQueueUnavailable() {
  const { failed, retry } = useWorkQueue();
  if (failed.length === 0) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-(--status-warning) bg-(--status-warning-bg) px-5 py-3 text-sm">
      <TriangleAlert className="size-4 text-(--status-warning)" aria-hidden />
      <p className="flex-1">
        Could not check your {failed.join(", ")}. What needs you may be missing from this list.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}

export function WorkQueuePanel({ emptyAction }: { emptyAction?: React.ReactNode }) {
  const { items, loaded, failed } = useWorkQueue();
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [expanded, setExpanded] = useState<Set<WorkAction>>(new Set());

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
  }, []);

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Checking what needs you…</p>;
  }

  if (items.length === 0) {
    if (failed.length) return <WorkQueueUnavailable />;
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-border px-5 py-6">
        <CircleCheck className="size-6 text-(--status-success)" aria-hidden />
        <div className="flex-1">
          <p className="font-medium">Nothing needs you right now</p>
          <p className="text-sm text-muted-foreground">New approvals, hand-offs and returned permits will appear here.</p>
        </div>
        {emptyAction}
      </div>
    );
  }

  const groups = (Object.keys(WORK_ACTIONS) as WorkAction[])
    .map((action) => ({ action, rows: items.filter((item) => item.action === action) }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className="grid gap-3">
    <WorkQueueUnavailable />
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {groups.map(({ action, rows }) => {
        const showAll = expanded.has(action);
        const visible = showAll ? rows.map((item) => ({ item, alike: 1 })) : collapseAlike(rows).slice(0, PER_GROUP);
        return (
          <section key={action} aria-labelledby={`wq-${action}`} className="px-4 py-3 sm:px-5">
            <h3 id={`wq-${action}`} className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden className="h-4 w-1 rounded-full" style={{ backgroundColor: `var(--act-${WORK_ACTIONS[action].kind})` }} />
              {WORK_ACTIONS[action].group}
              <span
                className="chip rounded-full px-2 text-xs font-bold tabular-nums"
                style={{ "--chip": `var(--act-${WORK_ACTIONS[action].kind})` } as React.CSSProperties}
              >
                {rows.length}
              </span>
            </h3>
            <ul className="divide-y divide-border/60">
              {visible.map(({ item, alike }) => (
                <WorkRow key={item.key} item={item} alike={alike} lookups={lookups} />
              ))}
            </ul>
            {showAll || rows.length > visible.length ? (
              <button
                type="button"
                className="mt-1 text-sm font-medium text-primary hover:underline"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (showAll) next.delete(action);
                    else next.add(action);
                    return next;
                  })
                }
              >
                {showAll ? "Show fewer" : `Show all ${rows.length}`}
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
    </div>
  );
}
