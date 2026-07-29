"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { listProgress } from "@/lib/execution/api";
import type { ProgressRecord } from "@/lib/execution/types";
import { getPermit } from "@/lib/permit/api";
import { ProgressFeed } from "@/components/execution/progress-feed";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export default function ProgressTimelinePage() {
  const params = useParams<{ permitId: string }>();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPermit(params.permitId), listProgress(params.permitId)])
      .then(([detail, items]) => {
        setTitle(detail.permit.title);
        setStatus(detail.permit.status);
        setProgress(items);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load progress");
      });
  }, [params.permitId]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{title || "Progress timeline"}</h1>
            {status ? <PermitStatusBadge status={status} /> : null}
          </div>
          <p className="text-sm text-muted-foreground">Chronological work progress updates</p>
        </div>
        <Link href={`/execution/${params.permitId}`}>
          <Button variant="ghost">Back to execution</Button>
        </Link>
      </div>

      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : (
        <ProgressFeed items={progress.slice().reverse()} />
      )}
    </main>
  );
}
