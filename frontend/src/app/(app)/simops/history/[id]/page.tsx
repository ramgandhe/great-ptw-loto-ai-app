"use client";

import { BackLink } from "@/components/layout/page-header";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getSimopsCase } from "@/lib/simops/api";
import type { SimopsCaseDetail } from "@/lib/simops/types";
import { CaseResolve } from "@/components/simops/case-resolve";

export default function SimopsHistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<SimopsCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    getSimopsCase(params.id)
      .then(setDetail)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load history record");
      })
      .finally(() => setIsLoading(false));
  }, [params.id]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div>
        <BackLink href="/simops?view=history" label="Resolved cases" />
        <h1 className="font-heading text-3xl font-bold tracking-tight">Resolved SIMOPS case</h1>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading record…</p>
      ) : detail ? (
        <CaseResolve detail={detail} canResolve={false} onUpdated={() => undefined} />
      ) : null}
    </main>
  );
}
