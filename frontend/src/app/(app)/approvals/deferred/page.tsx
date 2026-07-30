"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export default function DeferredPermitsPage() {
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    listPermits("deferred")
      .then(setPermits)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load deferred permits");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Deferred permits</h1>
          <p className="text-sm text-muted-foreground">
            Permits returned for clarification before approval can continue.
          </p>
        </div>
        <Link href="/approvals">
          <Button variant="outline">Approval queue</Button>
        </Link>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading deferred permits...</p>
      ) : permits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deferred permits found.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {permits.map((permit) => (
                <tr key={permit.id} className="border-t border-border">
                  <td className="px-4 py-3">{permit.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{permit.reference ?? "—"}</td>
                  <td className="px-4 py-3">
                    <PermitStatusBadge status={permit.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(permit.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/permits/${permit.id}`} className="text-primary hover:underline">
                      View permit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
