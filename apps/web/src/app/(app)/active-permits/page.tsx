"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { ApiError } from "@/lib/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export default function ActivePermitsPage() {
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listPermits("active"), listPermits("suspended")])
      .then(([active, suspended]) => setPermits([...active, ...suspended]))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load active permits"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Activity className="size-5" aria-hidden />
          Active work
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor active and suspended permit execution.
        </p>
      </div>
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading active permits...</p>
      ) : permits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No active or suspended work.
        </div>
      ) : (
        <div className="grid gap-3">
          {permits.map((permit) => (
            <article key={permit.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{permit.title}</h2>
                  <PermitStatusBadge status={permit.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {permit.reference ?? "No reference"} · updated{" "}
                  {new Date(permit.updatedAt).toLocaleString()}
                </p>
              </div>
              <Link href={`/execution/${permit.id}`}>
                <Button variant="outline">Open execution</Button>
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
