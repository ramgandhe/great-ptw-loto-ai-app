"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getPermit } from "@/lib/permit/api";
import { permitDetailToForm } from "@/lib/permit/form";
import type { PermitDetail } from "@/lib/permit/types";
import { isEditablePermitStatus } from "@/lib/permit/status";
import { PermitApprovalStatus } from "@/components/permit/permit-approval-status";
import { PermitSummary } from "@/components/permit/permit-summary";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export default function PermitDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPermit(params.id)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load permit"));
  }, [params.id]);

  if (error) {
    return (
      <div className="p-8 text-sm text-destructive" role="alert">
        {error}
      </div>
    );
  }

  if (!detail) {
    return <p className="p-8 text-sm text-muted-foreground">Loading permit...</p>;
  }

  const form = permitDetailToForm(detail);
  const canEdit = isEditablePermitStatus(detail.permit.status);
  const isResubmit =
    detail.permit.status === "deferred" || detail.permit.status === "rejected";

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{detail.permit.title}</h1>
            <PermitStatusBadge status={detail.permit.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {detail.permit.reference ? `Reference ${detail.permit.reference}` : "Draft permit"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/permits/${detail.permit.id}/preview`}>
            <Button variant="outline">Preview</Button>
          </Link>
          {canEdit ? (
            <Link href={`/permits/${detail.permit.id}/edit`}>
              <Button>{isResubmit ? "Revise & resubmit" : "Edit draft"}</Button>
            </Link>
          ) : null}
          {["approved", "active", "suspended"].includes(detail.permit.status) ? (
            <Link href={`/permits/${detail.permit.id}/execute`}>
              <Button>
                {detail.permit.status === "approved" ? "Start execution" : "Open execution"}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <PermitSummary
        form={form}
        status={detail.permit.status}
        reference={detail.permit.reference}
      />

      <PermitApprovalStatus permitId={detail.permit.id} status={detail.permit.status} />

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Attachments</h2>
        {detail.attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments uploaded.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {detail.attachments.map((attachment) => (
              <li key={attachment.id} className="rounded-lg border border-border px-3 py-2">
                {attachment.fileName} ({Math.round(attachment.fileSize / 1024)} KB)
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
