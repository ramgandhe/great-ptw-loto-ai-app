"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatWindow } from "@/lib/format";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";
import { cn } from "@/lib/utils";
import { WORK_ACTIONS, type WorkAction, type WorkItem } from "@/lib/work-queue";
import { useWorkQueue } from "@/lib/work-queue-context";

const PER_GROUP = 5;

function WorkRow({ item, lookups }: { item: WorkItem; lookups: Lookups | null }) {
  const { permit } = item;
  const type = permit ? lookups?.permitTypes.get(permit.permitTypeId) : undefined;
  const place = permit
    ? (nameOf(lookups?.machinery, permit.machineryId) ??
      nameOf(lookups?.workstations, permit.workstationId) ??
      nameOf(lookups?.locations, permit.locationId))
    : null;

  return (
    <li className="relative flex flex-wrap items-center gap-x-4 gap-y-2 py-3 pl-4 pr-1 sm:flex-nowrap">
      {/* The left rule carries the permit type's own colour, as on the permit board. */}
      <span
        aria-hidden
        className="absolute inset-y-3 left-0 w-1 rounded-full bg-border"
        style={type?.color ? { backgroundColor: type.color } : undefined}
      />
      <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
        <Link href={item.href} className="font-medium hover:underline">
          {item.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {item.reference ? <span className="font-mono">{item.reference}</span> : null}
          {type ? <span>{type.name}</span> : null}
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
      <Link
        href={item.href}
        className={cn(buttonVariants({ variant: item.urgent ? "default" : "outline", size: "sm" }), "ml-auto shrink-0")}
      >
        {item.label}
      </Link>
    </li>
  );
}

export function WorkQueuePanel({ emptyAction }: { emptyAction?: React.ReactNode }) {
  const { items, loaded } = useWorkQueue();
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [expanded, setExpanded] = useState<Set<WorkAction>>(new Set());

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
  }, []);

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Checking what needs you…</p>;
  }

  if (items.length === 0) {
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
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {groups.map(({ action, rows }) => {
        const showAll = expanded.has(action);
        const visible = showAll ? rows : rows.slice(0, PER_GROUP);
        return (
          <section key={action} aria-labelledby={`wq-${action}`} className="px-4 py-3 sm:px-5">
            <h3 id={`wq-${action}`} className="flex items-baseline gap-2 text-sm font-semibold">
              {WORK_ACTIONS[action].group}
              <span className="font-normal text-muted-foreground">{rows.length}</span>
            </h3>
            <ul className="divide-y divide-border/60">
              {visible.map((item) => (
                <WorkRow key={item.key} item={item} lookups={lookups} />
              ))}
            </ul>
            {rows.length > PER_GROUP ? (
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
  );
}
