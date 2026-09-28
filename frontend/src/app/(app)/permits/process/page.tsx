"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Route } from "lucide-react";
import { ApiError } from "@/lib/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { EDGES, NODES } from "@/lib/permit/process";
import { formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { ProcessDetails, ProcessMap, ProcessMapLegend, type MapSelection } from "@/components/permit/process-map";

export default function PermitProcessPage() {
  const [permits, setPermits] = useState<PermitRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapSelection>(null);

  useEffect(() => {
    listPermits()
      .then(setPermits)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load permits for the stage counts"));
  }, []);

  const byStage = useMemo(() => {
    const groups: Record<string, PermitRecord[]> = {};
    for (const permit of permits ?? []) (groups[permit.status] ??= []).push(permit);
    for (const list of Object.values(groups)) list.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    return groups;
  }, [permits]);

  const counts = permits ? Object.fromEntries(NODES.map((n) => [n.id, byStage[n.id]?.length ?? 0])) : undefined;
  if (counts) delete counts.veto;

  const stagePermits = selected?.kind === "node" ? byStage[selected.id] ?? [] : [];

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-8 sm:px-8">
      <PageHeader
        back={{ href: "/permits", label: "Permits" }}
        title="Permit process"
        description="Every stage a permit passes through, who moves it on, and where it can loop back. Numbers show how many of your permits sit at each stage now. Select a stage or an arrow for the detail."
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ProcessMap counts={counts} selected={selected} onSelect={setSelected} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProcessMapLegend />
        <p className="text-xs text-muted-foreground md:hidden">Scroll the map sideways to see every stage.</p>
      </div>

      {selected ? (
        <ProcessDetails selection={selected} onSelect={setSelected}>
          {selected.kind === "node" && counts && selected.id in counts ? (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold">
                At this stage now <span className="font-normal text-muted-foreground">({stagePermits.length})</span>
              </h3>
              {stagePermits.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">None of your permits are here.</p>
              ) : (
                <ul className="mt-2 grid gap-1.5">
                  {stagePermits.slice(0, 12).map((permit) => (
                    <li key={permit.id}>
                      <Link
                        href={`/permits/${permit.id}/journey`}
                        className="flex flex-wrap items-baseline gap-x-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <span className="font-mono text-xs text-muted-foreground">{permit.reference ?? "Draft"}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{permit.title}</span>
                        <span className="text-xs text-muted-foreground">Last moved {formatRelative(permit.updatedAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {stagePermits.length > 12 ? (
                <Link href="/permits" className="mt-2 inline-block text-sm text-primary hover:underline">
                  See all {stagePermits.length} in Permits
                </Link>
              ) : null}
            </div>
          ) : null}
        </ProcessDetails>
      ) : (
        <section aria-labelledby="stages-heading" className="rounded-xl border border-border bg-card">
          <h2 id="stages-heading" className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-semibold">
            <Route className="size-4 text-muted-foreground" aria-hidden />
            Stages at a glance
          </h2>
          <ul className="divide-y divide-border">
            {NODES.filter((n) => n.kind !== "event").map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ kind: "node", id: node.id })}
                  className="grid w-full gap-x-4 gap-y-0.5 px-5 py-2.5 text-left text-sm hover:bg-muted/60 sm:grid-cols-[11rem_1fr_auto]"
                >
                  <span className="font-medium">{node.title}</span>
                  <span className="text-muted-foreground">{node.owner}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {counts ? `${counts[node.id] ?? 0} now` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            {EDGES.length} possible moves. A safety officer can stop any live permit with a veto.
          </p>
        </section>
      )}
    </main>
  );
}
