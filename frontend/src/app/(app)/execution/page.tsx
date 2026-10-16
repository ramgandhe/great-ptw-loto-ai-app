"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Clock3, HardHat, ShieldAlert } from "lucide-react";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { PermitTypeChip } from "@/components/permit/permit-type-chip";
import { buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { formatRelative, formatWindow } from "@/lib/format";
import { loadLookups, placeOf, type Lookups } from "@/lib/lookups";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { cn } from "@/lib/utils";

const EXECUTION_STATUSES = ["approved", "active", "suspended"] as const;
type WorkFilter = (typeof EXECUTION_STATUSES)[number] | "all";

const FILTERS: { value: WorkFilter; label: string; hint: string }[] = [
  { value: "all", label: "All work", hint: "Every permit ready to start or currently on site." },
  { value: "suspended", label: "Suspended", hint: "Work stopped until the permit is reviewed and revalidated." },
  { value: "active", label: "In progress", hint: "Work currently under way at the site." },
  { value: "approved", label: "Ready to start", hint: "Approved permits. Verify site controls before starting." },
];

export default function ActivePermitsPage() {
  const reduceMotion = useReducedMotion();
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedAt] = useState(() => Date.now());

  useEffect(() => {
    Promise.all(EXECUTION_STATUSES.map((status) => listPermits(status)))
      .then((groups) => setPermits(groups.flat()))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load active work"))
      .finally(() => setIsLoading(false));
    loadLookups().then(setLookups, () => setLookupError("Permit type and location details could not be loaded."));
  }, []);

  const counts = useMemo(
    () => ({
      all: permits.length,
      suspended: permits.filter((permit) => permit.status === "suspended").length,
      active: permits.filter((permit) => permit.status === "active").length,
      approved: permits.filter((permit) => permit.status === "approved").length,
    }),
    [permits],
  );
  const visible = useMemo(
    () => permits
      .filter((permit) => filter === "all" || permit.status === filter)
      .sort((a, b) => {
        const aOverdue = Boolean(a.plannedEndAt && new Date(a.plannedEndAt).getTime() < loadedAt);
        const bOverdue = Boolean(b.plannedEndAt && new Date(b.plannedEndAt).getTime() < loadedAt);
        return Number(b.status === "suspended") - Number(a.status === "suspended") ||
          Number(bOverdue) - Number(aOverdue) ||
          b.updatedAt.localeCompare(a.updatedAt);
      }),
    [permits, filter, loadedAt],
  );
  const selected = visible.find((permit) => permit.id === selectedId) ?? visible[0] ?? null;
  const selectedType = selected ? lookups?.permitTypes.get(selected.permitTypeId) : undefined;
  const selectedOverdue = Boolean(selected?.plannedEndAt && new Date(selected.plannedEndAt).getTime() < loadedAt);

  return (
    <main className="page-in mx-auto flex w-full max-w-370 flex-1 flex-col gap-6 px-4 pb-10 pt-6 sm:px-8 sm:pt-8">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <HardHat className="size-4 text-primary" aria-hidden />
            Site execution / Live work
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Work control</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Check live status and planned windows. Suspended and overdue work stays prominent.
          </p>
        </div>
        <Link href="/permits" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Permit register <ArrowRight aria-hidden />
        </Link>
      </header>

      <section aria-label="Filter live work" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FILTERS.map((item) => {
          const count = counts[item.value];
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => {
                setFilter(item.value);
                setSelectedId(null);
              }}
              className={cn(
                "group min-h-24 rounded-xl border p-3 text-left transition-[transform,background-color,border-color,box-shadow] duration-150 hover:-translate-y-0.5 sm:p-4",
                filter === item.value ? "border-primary bg-primary text-primary-foreground shadow-md" : "border-border bg-card hover:border-primary/50",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold sm:text-sm">{item.label}</span>
                <span className={cn("font-heading text-2xl font-semibold tabular-nums", filter === item.value ? "text-primary-foreground" : "text-primary")}>
                  {isLoading ? "—" : count}
                </span>
              </span>
              <span className={cn("mt-2 block text-[11px] leading-4", filter === item.value ? "text-primary-foreground/75" : "text-muted-foreground")}>{item.hint}</span>
            </button>
          );
        })}
      </section>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {lookupError ? <p role="status" className="text-sm text-amber-800">{lookupError}</p> : null}

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading work permits…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-5 py-12 text-center">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground"><HardHat className="size-5" aria-hidden /></span>
          <p className="font-semibold">No permits in this work view</p>
          <p className="mt-1 text-sm text-muted-foreground">Approved, active and suspended permits will appear here.</p>
        </div>
      ) : (
        <div className="grid min-h-[34rem] overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.5fr)]">
          <section aria-label="Live permit list" className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">{FILTERS.find((item) => item.value === filter)?.label}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Select a job for details</p>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{visible.length} permits</span>
            </div>
            <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto">
              {visible.map((permit, index) => {
                const type = lookups?.permitTypes.get(permit.permitTypeId);
                const overdue = Boolean(permit.plannedEndAt && new Date(permit.plannedEndAt).getTime() < loadedAt);
                const isSelected = selected?.id === permit.id;
                return (
                  <motion.li
                    key={permit.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, delay: Math.min(index, 8) * 0.02 }}
                    className={cn("border-l-[3px]", isSelected ? "border-l-primary bg-primary/5" : "border-l-transparent")}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(permit.id)}
                      className="w-full px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{permit.title}</span>
                          <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{permit.reference ?? "Draft"}</span>
                        </span>
                        <PermitStatusBadge status={permit.status} />
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {type ? <PermitTypeChip name={type.name} color={type.color} className="py-0" /> : null}
                        {overdue ? <span className="inline-flex items-center gap-1 font-semibold text-destructive"><Clock3 className="size-3" aria-hidden />Past end</span> : null}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </section>

          {selected ? (
            <section key={selected.id} aria-labelledby="live-permit-title" className="page-in flex min-w-0 flex-col p-5 sm:p-7 lg:p-9">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Live work record</p>
                  <h2 id="live-permit-title" className="font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{selected.title}</h2>
                  <p className="mt-2 font-mono text-sm text-muted-foreground">{selected.reference ?? "No reference"}</p>
                </div>
                <PermitStatusBadge status={selected.status} />
              </div>

              {selected.status === "suspended" ? (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <div><p className="text-sm font-semibold">Work is suspended</p><p className="mt-1 text-xs leading-5">Do not resume work until the permit is reviewed and revalidated.</p></div>
                </div>
              ) : null}
              {selectedOverdue && selected.status === "active" ? (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">
                  <Clock3 className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <div><p className="text-sm font-semibold">Past planned end time</p><p className="mt-1 text-xs leading-5">Confirm the job is still authorized before proceeding.</p></div>
                </div>
              ) : null}

              <dl className="mt-7 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
                <div className="bg-background p-4"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Work type</dt><dd className="mt-2">{selectedType ? <PermitTypeChip name={selectedType.name} color={selectedType.color} /> : "—"}</dd></div>
                <div className="bg-background p-4"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Work location</dt><dd className="mt-2 text-sm font-medium">{placeOf(selected, lookups) ?? "Place not set"}</dd></div>
                <div className="bg-background p-4"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Planned work window</dt><dd className="mt-2 text-sm font-medium">{formatWindow(selected.plannedStartAt, selected.plannedEndAt)}</dd></div>
                <div className="bg-background p-4"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Last updated</dt><dd className="mt-2 text-sm font-medium">{formatRelative(selected.updatedAt)}</dd></div>
              </dl>

              <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-6">
                <span className="mr-auto text-xs text-muted-foreground">Verify the permit status before any work begins or resumes.</span>
                <Link href={`/execution/${selected.id}`} className={buttonVariants({ size: "lg" })}>
                  {selected.status === "approved" ? "Start permit execution" : selected.status === "suspended" ? "Review permit" : "Open execution"}
                  <ArrowRight aria-hidden />
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
