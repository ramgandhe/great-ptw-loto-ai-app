"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export default function PermitsPage() {
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "pending_approval">("all");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    listPermits(filter === "all" ? undefined : filter)
      .then(setPermits)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load permits");
      })
      .finally(() => setIsLoading(false));
  }, [filter]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Permits</h1>
          <p className="text-sm text-muted-foreground">
            Create, manage drafts and track submitted permits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/permits/new">
            <Button>
              <Plus className="size-4" aria-hidden />
              Create permit
            </Button>
          </Link>
          <Link href="/permits/drafts">
            <Button variant="outline">Drafts</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "draft", "pending_approval"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant={filter === value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "All" : value.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading permits...</p>
      ) : permits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No permits found.</p>
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
                    <div className="flex gap-3">
                      <Link href={`/permits/${permit.id}`} className="text-primary hover:underline">
                        View
                      </Link>
                      {permit.status === "draft" ? (
                        <Link href={`/permits/${permit.id}/edit`} className="text-primary hover:underline">
                          Edit
                        </Link>
                      ) : null}
                    </div>
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
