"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ClipboardList, ListFilter, Plus, Search, X } from "lucide-react";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { PermitTypeChip } from "@/components/permit/permit-type-chip";
import { Button, buttonVariants } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { purgePermit } from "@/lib/permit/api";
import { MultiToggle, SegmentedToggle } from "@/components/ui/toggle-group";
import { ActionLink } from "@/components/work/action-link";
import { WorkQueueUnavailable } from "@/components/work/work-queue-panel";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { PERMIT_CREATE_ROLES } from "@/lib/auth/roles";
import { formatRelative, formatWindow } from "@/lib/format";
import { idsUnder, PlaceFilter } from "@/components/place/place-filter";
import { loadLookups, nameOf, placeOf, type Lookups } from "@/lib/lookups";
import type { WorkLocationRecord } from "@/lib/place/api";
import { PERMIT_STATUSES, permitStatusColor } from "@/lib/permit/status";
import { QUEUE_VIEWS, inQueueView, queueViewFrom } from "@/lib/permit/queue-views";
import type { PermitRecord } from "@/lib/permit/types";
import { cn } from "@/lib/utils";
import { useWorkQueue } from "@/lib/work-queue-context";

const listParam = (value: string | null) => (value ? value.split(",").filter(Boolean) : []);

function PermitsBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const { roles } = useAuthProfile();
  const { permits, items, loaded, retry } = useWorkQueue();
  const isOwner = hasAnyRole(roles, ["tenant-owner"]);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPermitId, setSelectedPermitId] = useState<string | null>(null);

  const statuses = listParam(params.get("status"));
  const types = listParam(params.get("type"));
  const siteId = params.get("site") ?? "";
  const locationId = params.get("location") ?? "";
  const [placeRows, setPlaceRows] = useState<WorkLocationRecord[]>([]);

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
  }, []);

  function setParams(next: Record<string, string | string[]>) {
    const p = new URLSearchParams(params.toString());
    p.delete("stage");
    p.delete("scope");
    for (const [key, raw] of Object.entries(next)) {
      const value = Array.isArray(raw) ? raw.join(",") : raw;
      if (value) p.set(key, value);
      else p.delete(key);
    }
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  const actionByPermit = useMemo(() => new Map(items.filter((item) => item.permit).map((item) => [item.permit!.id, item])), [items]);
  const view = queueViewFrom(params, permits.filter((p) => actionByPermit.has(p.id)).length);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    const under = locationId ? idsUnder(locationId, placeRows) : null;
    return permits.filter((permit) => {
      if (siteId && permit.siteId !== siteId && permit.plantId !== siteId) return false;
      if (under && ![permit.workLocationId, permit.locationId, permit.workstationId].some((id) => id && under.has(id))) return false;
      if (!q) return true;
      return [permit.reference, permit.title, nameOf(lookups?.permitTypes, permit.permitTypeId), placeOf(permit, lookups)]
        .filter(Boolean)
        .some((text) => text!.toLowerCase().includes(q));
    });
  }, [permits, query, lookups, siteId, locationId, placeRows]);

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
  const selectedPermit = visible.find((permit) => permit.id === selectedPermitId) ?? visible[0] ?? null;

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

  const filterCount = statuses.length + types.length + (siteId ? 1 : 0) + (locationId ? 1 : 0);
  const chips = [
    ...statuses.map((key) => ({ key, label: PERMIT_STATUSES.find((st) => st.key === key)?.label ?? key, remove: () => setParams({ status: statuses.filter((x) => x !== key) }) })),
    ...types.map((key) => ({ key, label: lookups?.permitTypes.get(key)?.name ?? "Permit type", remove: () => setParams({ type: types.filter((x) => x !== key) }) })),
    ...(siteId ? [{ key: "site", label: placeRows.find((row) => row.siteId === siteId)?.pathText?.split(" › ")[0] ?? "Site", remove: () => setParams({ site: "", location: "" }) }] : []),
    ...(locationId ? [{ key: "location", label: placeRows.find((row) => row.id === locationId)?.pathText || "Work location", remove: () => setParams({ location: "" }) }] : []),
  ];

  async function purgeRow(permit: PermitRecord) {
    const label = permit.reference ?? permit.title;
    if (!(await confirmAction(`Permanently delete ${label}? This removes the permit, its records, and any incidents linked to it.`))) return;
    setPurgingId(permit.id);
    try {
      await purgePermit(permit.id);
      if (selectedPermitId === permit.id) setSelectedPermitId(null);
      toast(`${label} deleted`);
      retry();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete this permit");
    } finally {
      setPurgingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-370 flex-1 flex-col gap-5 px-4 pb-10 pt-6 sm:gap-6 sm:px-8 sm:pt-8">
      <header className="flex flex-col gap-5 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <ClipboardList className="size-4" aria-hidden />
            Work management / Permit control
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-[2.1rem]">Permit register</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review authorization status, work location, and planned activity.
          </p>
        </div>
        {hasAnyRole(roles, PERMIT_CREATE_ROLES) ? (
          <Link href="/permits/new" className={buttonVariants({ size: "lg", className: "h-11" })}>
            <Plus aria-hidden />
            Create permit
          </Link>
        ) : null}
      </header>

      <section aria-label="Permit views and filters" className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-muted/40 px-3 pt-3 sm:px-4">
          <div className="-mx-1 overflow-x-auto px-1">
            <SegmentedToggle label="Permit views" className="w-max" value={view} onChange={(v) => setParams({ view: v })} options={viewOptions} />
          </div>
        </div>
        <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
          <label className="relative flex h-10 w-full items-center sm:max-w-xl sm:flex-1">
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
              className="h-10 w-full rounded-[8px] border border-border bg-background pl-9 pr-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
              "press flex min-h-11 items-center gap-1.5 rounded-md border px-4 text-sm",
              filterCount ? "is-selected border-transparent font-semibold" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <ListFilter className="size-4" aria-hidden />
            {filtersOpen ? "Hide filters" : "Filters"}{filterCount ? ` · ${filterCount}` : ""}
          </button>
          <p className="text-sm font-medium text-muted-foreground sm:ml-auto" aria-live="polite">
            {loaded ? `${visible.length} result${visible.length === 1 ? "" : "s"}` : "Loading results"}
          </p>
        </div>
        {chips.length ? (
          <div className="flex flex-wrap items-center gap-2 px-3 pb-3 sm:px-4">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.remove}
                aria-label={`Remove filter ${chip.label}`}
                className="press flex min-h-9 items-center gap-1 rounded-[6px] border border-border bg-background px-3 text-sm hover:bg-muted"
              >
                {chip.label}
                <X className="size-3.5" aria-hidden />
              </button>
            ))}
            <button type="button" onClick={() => setParams({ status: [], type: [], site: "", location: "" })} className="min-h-9 px-2 text-sm font-medium text-primary hover:underline">
              Clear
            </button>
          </div>
        ) : null}
        {filtersOpen ? (
          <div id="permit-filters" className="mx-3 mb-3 grid gap-4 rounded-md border border-border bg-muted/30 p-4 sm:mx-4">
            <MultiToggle label="Status" options={statusOptions} selected={statuses} onChange={(next) => setParams({ status: next })} />
            {typeOptions.length > 1 ? (
              <MultiToggle label="Permit type" options={typeOptions} selected={types} onChange={(next) => setParams({ type: next })} />
            ) : null}
            <PlaceFilter
              siteId={siteId}
              workLocationId={locationId}
              onLocations={setPlaceRows}
              onChange={(next) => setParams({ site: next.siteId, location: next.workLocationId })}
            />
          </div>
        ) : null}
      </section>

      <WorkQueueUnavailable />
      {!loaded ? (
        <div className="rounded-[10px] border border-border bg-card px-5 py-8 text-sm text-muted-foreground">Loading permits…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border bg-card px-5 py-12 text-center">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full border border-border bg-muted text-muted-foreground">
            <Search className="size-5" aria-hidden />
          </span>
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
        <div className="grid min-h-[34rem] overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.5fr)]">
          <section aria-label="Permit records" className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Work permits</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Select a record to inspect</p>
              </div>
              <span className="rounded-md bg-background px-2 py-1 font-mono text-xs tabular-nums text-muted-foreground">{visible.length}</span>
            </div>
            <ul className="max-h-[34rem] divide-y divide-border overflow-y-auto" aria-label="Permit records">
              {visible.map((permit, i) => {
                const type = lookups?.permitTypes.get(permit.permitTypeId);
                const action = actionByPermit.get(permit.id);
                const selected = selectedPermit?.id === permit.id;
                return (
                  <motion.li
                    key={permit.id}
                    initial={reduce ? false : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, delay: Math.min(i, 8) * 0.018 }}
                    className={cn("relative flex items-stretch", selected && "bg-primary/5")}
                  >
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedPermitId(permit.id)}
                      className={cn(
                        "min-w-0 flex-1 border-l-[3px] px-4 py-3.5 text-left transition-[background-color,border-color] duration-150",
                        selected ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-muted/50",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold leading-5">{permit.title}</span>
                        <PermitStatusBadge status={permit.status} />
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{permit.reference ?? "Draft"}</span>
                        <span aria-hidden>·</span>
                        <span>{type?.name ?? "Permit"}</span>
                      </span>
                      <span className="mt-2 block truncate text-xs text-muted-foreground">{placeOf(permit, lookups) ?? "Place not set"}</span>
                    </button>
                    {action || isOwner ? (
                      <div className="flex items-center gap-2 pr-3">
                        {action ? <ActionLink item={action} /> : null}
                        {isOwner ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={purgingId === permit.id}
                            onClick={() => void purgeRow(permit)}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </motion.li>
                );
              })}
            </ul>
          </section>

          {selectedPermit ? (
            <section
              key={selectedPermit.id}
              aria-labelledby="selected-permit-title"
              className="page-in flex min-w-0 flex-col p-5 sm:p-7 lg:p-9"
            >
              {(() => {
                const type = lookups?.permitTypes.get(selectedPermit.permitTypeId);
                const action = actionByPermit.get(selectedPermit.id);
                return (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selected permit</p>
                        <h2 id="selected-permit-title" className="max-w-2xl font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                          {selectedPermit.title}
                        </h2>
                        <p className="mt-2 font-mono text-sm text-muted-foreground">{selectedPermit.reference ?? "Draft — reference assigned on submission"}</p>
                      </div>
                      <PermitStatusBadge status={selectedPermit.status} />
                    </div>
                    <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                      <div className="bg-background p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Work type</p>
                        <div className="mt-2"><PermitTypeChip name={type?.name} color={type?.color} /></div>
                      </div>
                      <div className="bg-background p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Work location</p>
                        <p className="mt-2 text-sm font-medium">{placeOf(selectedPermit, lookups) ?? "Place not set"}</p>
                      </div>
                      <div className="bg-background p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Planned work window</p>
                        <p className="mt-2 text-sm font-medium">{formatWindow(selectedPermit.plannedStartAt, selectedPermit.plannedEndAt)}</p>
                      </div>
                      <div className="bg-background p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Last updated</p>
                        <p className="mt-2 text-sm font-medium">{formatRelative(selectedPermit.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-6">
                      {action ? <ActionLink item={action} /> : <span className="text-sm text-muted-foreground">No action needed</span>}
                      <Link href={`/permits/${selectedPermit.id}`} className={buttonVariants({ variant: "outline", size: "lg", className: "ml-auto" })}>
                        Open permit workspace
                      </Link>
                    </div>
                  </>
                );
              })()}
            </section>
          ) : null}
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
