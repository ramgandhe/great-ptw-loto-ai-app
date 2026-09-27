"use client";

import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/analytics/animated-number";
import { StatTile } from "@/components/analytics/charts";
import { staggerContainer, staggerItem } from "@/lib/motion";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { PermitStatusCard } from "@/components/execution/permit-status-card";

const EXECUTION_STATUSES = ["approved", "active", "suspended"] as const;

export default function ActivePermitsPage() {
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedAt] = useState(() => Date.now());

  useEffect(() => {
    Promise.all(EXECUTION_STATUSES.map((status) => listPermits(status)))
      .then((groups) => setPermits(groups.flat()))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load permits");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const active = permits.filter((permit) => permit.status === "active");
  const suspended = permits.filter((permit) => permit.status === "suspended");
  const approved = permits.filter((permit) => permit.status === "approved");

  // Captured once per load; "overdue" doesn't need to tick while the page is open.
  const now = loadedAt;
  const isOverdue = (permit: PermitRecord) => Boolean(permit.plannedEndAt && new Date(permit.plannedEndAt).getTime() < now);
  const groups = [
    { key: "suspended", title: "Suspended", hint: "Work is stopped until the permit is revalidated.", rows: suspended },
    { key: "active", title: "In progress", hint: "Work under way on site.", rows: active },
    { key: "approved", title: "Ready to start", hint: "Approved. Start once isolations are in place.", rows: approved },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Active work</h1>
        <p className="mt-1 text-muted-foreground">Suspended work first, then what is in progress, then what is ready to start.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Suspended" value={<AnimatedNumber value={suspended.length} />} tone={suspended.length > 0 ? "warning" : "neutral"} />
        <StatTile
          label="In progress"
          value={<AnimatedNumber value={active.length} />}
          hint={active.some(isOverdue) ? `${active.filter(isOverdue).length} past planned end` : undefined}
          tone={active.some(isOverdue) ? "danger" : "neutral"}
        />
        <StatTile label="Ready to start" value={<AnimatedNumber value={approved.length} />} />
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading permits…</p>
      ) : permits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          No work is approved or in progress. Approved permits appear here ready to start.
        </p>
      ) : (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-8">
          {groups
            .filter((g) => g.rows.length > 0)
            .map((g) => (
              <motion.section key={g.key} variants={staggerItem} className="grid gap-3" aria-labelledby={`grp-${g.key}`}>
                <div>
                  <h2 id={`grp-${g.key}`} className="font-semibold">
                    {g.title} <span className="font-normal text-muted-foreground">{g.rows.length}</span>
                  </h2>
                  <p className="text-sm text-muted-foreground">{g.hint}</p>
                </div>
                {[...g.rows]
                  .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)))
                  .map((permit) => (
                    <PermitStatusCard key={permit.id} permit={permit} overdue={g.key === "active" && isOverdue(permit)} />
                  ))}
              </motion.section>
            ))}
        </motion.div>
      )}
    </main>
  );
}
