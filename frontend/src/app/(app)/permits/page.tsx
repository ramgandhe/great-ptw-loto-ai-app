"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { PERMIT_CREATE_ROLES } from "@/lib/auth/roles";
import { formatRelative, formatWindow } from "@/lib/format";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";
import type { PermitRecord } from "@/lib/permit/types";
import { cn } from "@/lib/utils";
import { useWorkQueue } from "@/lib/work-queue-context";

/** Lifecycle stages people think in, rather than one chip per database status. */
const STAGES = [
  { key: "all", label: "All", statuses: [] as string[] },
  { key: "draft", label: "Drafts", statuses: ["draft"] },
  { key: "review", label: "In review", statuses: ["pending_approval", "deferred", "rejected"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "live", label: "In progress", statuses: ["active", "suspended"] },
  { key: "closing", label: "Closing", statuses: ["execution_completed", "pending_closure"] },
  { key: "done", label: "Finished", statuses: ["closed", "cancelled", "expired"] },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

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
  const { roles } = useAuthProfile();
  const { permits, items, loaded } = useWorkQueue();
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const stage = (params.get("stage") as StageKey | null) ?? "all";

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
  }, []);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  const actionByPermit = useMemo(() => new Map(items.filter((item) => item.permit).map((item) => [item.permit!.id, item])), [items]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return permits;
    return permits.filter((permit) =>
      [
        permit.reference,
        permit.title,
        nameOf(lookups?.permitTypes, permit.permitTypeId),
        placeOf(permit, lookups),
        nameOf(lookups?.locations, permit.locationId),
      ]
        .filter(Boolean)
        .some((text) => text!.toLowerCase().includes(q)),
    );
  }, [permits, query, lookups]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const s of STAGES) {
      result[s.key] = s.key === "all" ? searched.length : searched.filter((p) => (s.statuses as readonly string[]).includes(p.status)).length;
    }
    return result;
  }, [searched]);

  const visible = useMemo(() => {
    const selected = STAGES.find((s) => s.key === stage) ?? STAGES[0];
    const rows = selected.key === "all" ? searched : searched.filter((p) => (selected.statuses as readonly string[]).includes(p.status));
    // Anything waiting on this person first, then most recently changed.
    return [...rows].sort(
      (a, b) =>
        Number(actionByPermit.has(b.id)) - Number(actionByPermit.has(a.id)) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [searched, stage, actionByPermit]);

  return (
    <main className="flex flex-1 flex-col gap-5 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Permits</h1>
          <p className="mt-1 text-muted-foreground">Every permit you can see, with the ones waiting on you first.</p>
        </div>
        {hasAnyRole(roles, PERMIT_CREATE_ROLES) ? (
          <Link href="/permits/new" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden />
            Create permit
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex h-10 items-center lg:w-80">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Search permits</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setParam("q", e.target.value);
            }}
            placeholder="Reference, title, type or place"
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setQuery("");
                setParam("q", "");
              }}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <div role="tablist" aria-label="Permit stage" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {STAGES.filter((s) => s.key === "all" || counts[s.key] > 0 || s.key === stage).map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={stage === s.key}
              onClick={() => setParam("stage", s.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                stage === s.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
              <span className={cn("tabular-nums", stage === s.key ? "opacity-70" : "")}>{counts[s.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading permits…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">{query ? `No permits match “${query}”` : "No permits at this stage"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query ? "Try a reference such as PTW-0142, a machine or a location." : "Choose another stage above."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div
            aria-hidden
            className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_8.5rem_7rem] gap-4 border-b border-border px-5 py-2.5 text-xs font-medium text-muted-foreground lg:grid"
          >
            <span>Permit</span>
            <span>Type and place</span>
            <span>Planned</span>
            <span>Status</span>
            <span className="text-right">Next step</span>
          </div>
          <ul className="divide-y divide-border">
            {visible.map((permit) => {
              const type = lookups?.permitTypes.get(permit.permitTypeId);
              const action = actionByPermit.get(permit.id);
              return (
                <li
                  key={permit.id}
                  className="relative grid gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-muted/40 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_8.5rem_7rem] lg:items-center"
                >
                  <div className="min-w-0">
                    {/* The whole row opens the permit; the action button stays independently clickable. */}
                    <Link href={`/permits/${permit.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                      {permit.title}
                    </Link>
                    <p className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                      {permit.reference ? <span className="font-mono">{permit.reference}</span> : <span>No reference yet</span>}
                      <span>Updated {formatRelative(permit.updatedAt)}</span>
                    </p>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full bg-border"
                        style={type?.color ? { backgroundColor: type.color } : undefined}
                      />
                      <span className="truncate">{type?.name ?? "Permit"}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{placeOf(permit, lookups) ?? "Place not set"}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatWindow(permit.plannedStartAt, permit.plannedEndAt)}</p>
                  <div>
                    <PermitStatusBadge status={permit.status} />
                  </div>
                  <div className="relative z-10 lg:text-right">
                    {action ? (
                      <Link
                        href={action.href}
                        className={buttonVariants({ variant: action.urgent ? "default" : "outline", size: "sm" })}
                      >
                        {action.label}
                      </Link>
                    ) : null}
                  </div>
                </li>
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
