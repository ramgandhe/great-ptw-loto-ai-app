"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { openPresignedDownload } from "@/lib/download";
import { getEvidenceDownloadUrl, listEvidence } from "@/lib/execution/api";
import type { EvidenceRecord } from "@/lib/execution/types";
import { getPermit } from "@/lib/permit/api";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export default function EvidenceGalleryPage() {
  const params = useParams<{ permitId: string }>();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  async function handleDownload(evidenceId: string) {
    setDownloadingId(evidenceId);
    setDownloadError(null);
    try {
      await openPresignedDownload(() => getEvidenceDownloadUrl(params.permitId, evidenceId));
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Failed to open evidence file");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="font-heading text-3xl font-bold tracking-tight">{title || "Evidence gallery"}</h1>
            {status ? <PermitStatusBadge status={status} /> : null}
          </div>
          <p className="text-sm text-muted-foreground">Photographs and documents captured during execution</p>
        </div>
        <Link href={`/execution/${params.permitId}`}>
          <Button variant="ghost">Back to execution</Button>
        </Link>
      </div>

      {downloadError ? (
        <div role="alert" className="text-sm text-destructive">
          {downloadError}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">No evidence uploaded yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {evidence.map((item) => (
            <li key={item.id} className="flex flex-col justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium">{item.fileName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.contentType} · {Math.round(item.fileSize / 1024)} KB
                </p>
                {item.comment ? (
                  <p className="mt-2 text-sm text-muted-foreground">{item.comment}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                </p>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingId === item.id}
                  onClick={() => void handleDownload(item.id)}
                >
                  {downloadingId === item.id ? "Opening..." : "Download"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
