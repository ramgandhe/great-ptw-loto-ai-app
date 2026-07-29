"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { listEvidence } from "@/lib/execution/api";
import type { EvidenceRecord } from "@/lib/execution/types";
import { getPermit } from "@/lib/permit/api";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export default function EvidenceGalleryPage() {
  const params = useParams<{ permitId: string }>();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPermit(params.permitId), listEvidence(params.permitId)])
      .then(([detail, items]) => {
        setTitle(detail.permit.title);
        setStatus(detail.permit.status);
        setEvidence(items);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load evidence");
      });
  }, [params.permitId]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{title || "Evidence gallery"}</h1>
            {status ? <PermitStatusBadge status={status} /> : null}
          </div>
          <p className="text-sm text-muted-foreground">Photographs and documents captured during execution</p>
        </div>
        <Link href={`/execution/${params.permitId}`}>
          <Button variant="ghost">Back to execution</Button>
        </Link>
      </div>

      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">No evidence uploaded yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {evidence.map((item) => (
            <li key={item.id} className="rounded-lg border border-border p-4">
              <p className="font-medium">{item.fileName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.contentType} · {Math.round(item.fileSize / 1024)} KB
              </p>
              {item.comment ? (
                <p className="mt-2 text-sm text-muted-foreground">{item.comment}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
