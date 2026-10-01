"use client";

import { BackLink } from "@/components/layout/page-header";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getSimopsCase } from "@/lib/simops/api";
import type { SimopsCaseDetail } from "@/lib/simops/types";
import { CaseResolve } from "@/components/simops/case-resolve";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { SIMOPS_RESOLVE_ROLES } from "@/lib/auth/roles";

export default function ConflictDetailPage() {
  const params = useParams<{ id: string }>();
  const { roles } = useAuthProfile();
  const canResolve = hasAnyRole(roles, SIMOPS_RESOLVE_ROLES);
  const [detail, setDetail] = useState<SimopsCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    if (!params.id) return Promise.resolve();
    return getSimopsCase(params.id)
      .then(setDetail)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load SIMOPS case");
      });
  }, [params.id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div>
        <BackLink href="/simops" label="SIMOPS" />
        <h1 className="font-heading text-3xl font-bold tracking-tight">SIMOPS case</h1>
        <p className="text-sm text-muted-foreground">
          Compare overlapping permits, then allow, add controls, or reject each one.
        </p>
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
        <p className="text-sm text-muted-foreground">Loading case…</p>
      ) : detail ? (
        <CaseResolve
          detail={detail}
          canResolve={canResolve}
          onUpdated={() => {
            setIsLoading(true);
            load().finally(() => setIsLoading(false));
          }}
        />
      ) : null}
    </main>
  );
}
