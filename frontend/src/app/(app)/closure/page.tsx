"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export default function ClosureQueuePage() {
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    listPermits("active")
      .then(setPermits)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load permits");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Permit closure</h1>
          <p className="text-sm text-muted-foreground">
            Verify completed work and close active permits.
          </p>
        </div>
        <Link href="/closure/archive">
          <Button variant="outline">View archive</Button>
        </Link>
      </div>

      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading permits...</p>
      ) : permits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active permits awaiting closure.</p>
      ) : (
        <div className="grid gap-3">
          {permits.map((permit) => (
            <article key={permit.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="font-semibold">{permit.title}</h3>
                    <PermitStatusBadge status={permit.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {permit.reference ?? permit.id.slice(0, 8)}
                  </p>
                </div>
                <Link href={`/closure/${permit.id}`}>
                  <Button variant="outline" size="sm">
                    Verify & close
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
