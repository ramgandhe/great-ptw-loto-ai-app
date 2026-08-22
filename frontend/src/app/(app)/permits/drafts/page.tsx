"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getProfile } from "@/lib/auth/api";
import { canRoleSubmitPermit } from "@/lib/permit/form";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export default function DraftPermitsPage() {
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    getProfile()
      .then((profile) => setCanCreate(canRoleSubmitPermit(profile.roles)))
      .catch(() => setCanCreate(false));

    listPermits("draft")
      .then(setPermits)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load drafts");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Draft permits</h1>
          <p className="text-sm text-muted-foreground">
            {canCreate
              ? "Resume incomplete permits before submission."
              : "Complete on-site details for permits assigned to you."}
          </p>
        </div>
        <div className="flex gap-2">
          {canCreate ? (
            <Link href="/permits/new">
              <Button>Create permit</Button>
            </Link>
          ) : null}
          <Link href="/permits">
            <Button variant="ghost">All permits</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <div role="alert" className="text-sm text-destructive">{error}</div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading drafts...</p>
      ) : permits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No draft permits saved.</p>
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
                    Updated {new Date(permit.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/permits/${permit.id}/preview`}>
                    <Button variant="outline" size="sm">Preview</Button>
                  </Link>
                  <Link href={`/permits/${permit.id}/edit`}>
                    <Button size="sm">Continue editing</Button>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
