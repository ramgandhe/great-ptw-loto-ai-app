"use client";

import { BackLink } from "@/components/layout/page-header";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getPlanHistory } from "@/lib/restoration/api";
import type { LototoHistoryEntry } from "@/lib/restoration/types";
import { RestorationTimeline } from "@/components/restoration/restoration-timeline";

export default function LototoHistoryPage() {
  const params = useParams<{ planId: string }>();
  const [entries, setEntries] = useState<LototoHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getPlanHistory(params.planId)
      .then(setEntries)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load history");
      })
      .finally(() => setIsLoading(false));
  }, [params.planId]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div>
        <BackLink href="/lototo?view=restoration" label="LOTOTO restoration" />
        <h1 className="mt-2 text-2xl font-semibold">LOTOTO history</h1>
        <p className="text-sm text-muted-foreground">
          Append-only audit trail for this plan.
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading history…</p>
      ) : (
        <RestorationTimeline entries={entries} />
      )}
    </main>
  );
}
