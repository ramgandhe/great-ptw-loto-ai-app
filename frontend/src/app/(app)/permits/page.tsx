"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ListFilter, Plus, Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { PermitTypeChip } from "@/components/permit/permit-type-chip";
import { buttonVariants } from "@/components/ui/button";
import { MultiToggle, SegmentedToggle } from "@/components/ui/toggle-group";
import { ActionLink } from "@/components/work/action-link";
import { WorkQueueUnavailable } from "@/components/work/work-queue-panel";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { PERMIT_CREATE_ROLES } from "@/lib/auth/roles";
import { formatRelative, formatWindow } from "@/lib/format";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";
import { PERMIT_STATUSES, permitStatusColor } from "@/lib/permit/status";
import { QUEUE_VIEWS, inQueueView, queueViewFrom } from "@/lib/permit/queue-views";
import type { PermitRecord } from "@/lib/permit/types";
import { cn } from "@/lib/utils";
import { useWorkQueue } from "@/lib/work-queue-context";

const listParam = (value: string | null) => (value ? value.split(",").filter(Boolean) : []);

function placeOf(permit: PermitRecord, lookups: Lookups | null): string | null {
  return (
    nameOf(lookups?.machinery, permit.machineryId) ??
    nameOf(lookups?.workstations, permit.workstationId) ??
    nameOf(lookups?.locations, permit.locationId)
  );
}

function PermitsBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const { roles } = useAuthProfile();
  const { permits, items, loaded } = useWorkQueue();
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const statuses = listParam(params.get("status"));
  const types = listParam(params.get("type"));

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
  }, []);

  function setParams(next: Record<string, string | string[]>) {
    const p = new URLSearchParams(params.toString());
    p.delete("stage");
    p.delete("scope");
    for (const [key, raw] of Object.entries(next)) {
      const value = Array.isArray(raw) ? raw.join(",") : raw;
      if (value && value !== "all") p.set(key, value);
      else p.delete(key);
    }
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  const actionByPermit = useMemo(() => new Map(items.filter((item) => item.permit).map((item) => [item.permit!.id, item])), [items]);
  const view = queueViewFrom(params, permits.filter((p) => actionByPermit.has(p.id)).length);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return permits;
    return permits.filter((permit) =>
      [permit.reference, permit.title, nameOf(lookups?.permitTypes, permit.permitTypeId), placeOf(permit, lookups)]
        .filter(Boolean)
        .some((text) => text!.toLowerCase().includes(q)),
    );
  }, [permits, query, lookups]);

  // Each count honours the other filters, so every number predicts what a click shows.
  const inView = (p: PermitRecord, key = view) => inQueueView(key, p.status, actionByPermit.has(p.id));
  const inStatus = (p: PermitRecord) => statuses.length === 0 || statuses.includes(p.status);
  const inType = (p: PermitRecord) => types.length === 0 || types.includes(p.permitTypeId);

  const forStatusCounts = searched.filter((p) => inView(p) && inType(p));
  const forTypeCounts = searched.filter((p) => inView(p) && inStatus(p));
  const viewOptions = QUEUE_VIEWS.map((v) => ({
    value: v.key,
    label: v.label,
    count: searched.filter((p) => inView(p, v.key) && inStatus(p) && inType(p)).length,
  }));

  const visible = searched
    .filter((p) => inView(p) && inStatus(p) && inType(p))
    // Anything waiting on this person first, then most recently changed.
    .sort((a, b) => Number(actionByPermit.has(b.id)) - Number(actionByPermit.has(a.id)) || b.updatedAt.localeCompare(a.updatedAt));

  const statusOptions = PERMIT_STATUSES.map((s) => ({
    value: s.key,
    label: s.label,
    color: permitStatusColor(s.key),
    count: forStatusCounts.filter((p) => p.status === s.key).length,
  })).filter((s) => s.count > 0 || statuses.includes(s.value));

  const typeOptions = [...new Set(searched.map((p) => p.permitTypeId))]
    .map((id) => ({
      value: id,
      label: lookups?.permitTypes.get(id)?.name ?? "Permit",
      color: lookups?.permitTypes.get(id)?.color ?? undefined,
      count: forTypeCounts.filter((p) => p.permitTypeId === id).length,
    }))
    .sort((a, b) => b.count - a.count);

  const filterCount = statuses.length + types.length;
  const chips = [
    ...statuses.map((key) => ({ key, label: PERMIT_STATUSES.find((st) => st.key === key)?.label ?? key, remove: () => setParams({ status: statuses.filter((x) => x !== key) }) })),
    ...types.map((key) => ({ key, label: lookups?.permitTypes.get(key)?.name ?? "Permit type", remove: () => setParams({ type: types.filter((x) => x !== key) }) })),
  ];

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pb-8 sm:px-8">
      <PageHeader
        title="Permits"
        description="Every permit you can see. The ones waiting on you come first."
        actions={
          hasAnyRole(roles, PERMIT_CREATE_ROLES) ? (
            <Link href="/permits/new" className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              Create permit
            </Link>
          ) : null
        }
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <SegmentedToggle label="Permit views" className="w-max" value={view} onChange={(v) => setParams({ view: v })} options={viewOptions} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex h-11 w-full items-center sm:w-80">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">Search permits</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setParams({ q: e.target.value });
              }}
              placeholder="Reference, title, type or place"
              className="h-11 w-full rounded-full border border-border bg-card pl-9 pr-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 rounded-full p-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setQuery("");
                  setParams({ q: "" });
                }}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </label>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="permit-filters"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "press flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm",
              filterCount ? "is-selected border-transparent font-semibold" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <ListFilter className="size-4" aria-hidden />
            Filters{filterCount ? ` (${filterCount})` : ""}
          </button>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loaded ? `${visible.length} permit${visible.length === 1 ? "" : "s"}` : null}
          </p>
        </div>
        {chips.length ? (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.remove}
                aria-label={`Remove filter ${chip.label}`}
                className="press flex min-h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm hover:bg-muted"
              >
                {chip.label}
                <X className="size-3.5" aria-hidden />
              </button>
            ))}
            <button type="button" onClick={() => setParams({ status: [], type: [] })} className="min-h-9 px-2 text-sm font-medium text-primary hover:underline">
              Clear
            </button>
          </div>
        ) : null}
        {filtersOpen ? (
          <div id="permit-filters" className="grid gap-3">
            <MultiToggle label="Status" options={statusOptions} selected={statuses} onChange={(next) => setParams({ status: next })} />
            {typeOptions.length > 1 ? (
              <MultiToggle label="Permit type" options={typeOptions} selected={types} onChange={(next) => setParams({ type: next })} />
            ) : null}
          </div>
        ) : null}
      </PageHeader>

      <WorkQueueUnavailable />
      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading permits…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">{query ? `No permits match “${query}”` : view === "needs-me" ? "You are all caught up" : "No permits in this view"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filterCount || query
              ? "Remove a filter above to widen the list."
              : view === "needs-me"
                ? "Nothing is waiting on you. Other permits are under All."
                : "Permits you raise or are assigned will appear here."}
          </p>
        </div>
      ) : (
        <div className="overflow-clip rounded-xl border border-border bg-card">
          <div
            aria-hidden
            className="table-head hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_9.5rem_7rem] gap-4 border-b border-border px-5 py-2.5 text-xs lg:grid"
          >
            <span>Permit</span>
            <span>Type and place</span>
            <span>Planned</span>
            <span>Status</span>
            <span className="text-right">Next step</span>
          </div>
          <ul className="divide-y divide-border">
            {visible.map((permit, i) => {
              const type = lookups?.permitTypes.get(permit.permitTypeId);
              const action = actionByPermit.get(permit.id);
              return (
                <motion.li
                  key={permit.id}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i, 10) * 0.025, ease: [0.23, 1, 0.32, 1] }}
                  className="row-hover relative grid gap-x-4 gap-y-1.5 px-5 py-3.5 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_9.5rem_7rem] lg:items-center"
                >
                  <div className="min-w-0">
                    {/* The whole row opens the permit; the action button stays independently clickable. */}
                    <Link href={`/permits/${permit.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">
                      {permit.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono font-semibold text-foreground">
                        {permit.reference ?? "No reference yet"}
                      </span>
                      <span>Updated {formatRelative(permit.updatedAt)}</span>
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col items-start gap-1 text-sm">
                    <PermitTypeChip name={type?.name} color={type?.color} />
                    <p className="max-w-full truncate text-xs text-muted-foreground">{placeOf(permit, lookups) ?? "Place not set"}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatWindow(permit.plannedStartAt, permit.plannedEndAt)}</p>
                  <div>
                    <PermitStatusBadge status={permit.status} />
                  </div>
                  <div className="relative z-10 lg:text-right">{action ? <ActionLink item={action} /> : null}</div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}

export default function PermitsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading permits…</main>}>
      <PermitsBoard />
    </Suspense>
  );
}
