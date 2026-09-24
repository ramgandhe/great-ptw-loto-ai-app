"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { deleteDraftPermit, getPermit } from "@/lib/permit/api";
import { permitDetailToForm } from "@/lib/permit/form";
import type { PermitDetail } from "@/lib/permit/types";
import { isEditablePermitStatus } from "@/lib/permit/status";
import { PermitApprovalStatus } from "@/components/permit/permit-approval-status";
import { PermitSummary } from "@/components/permit/permit-summary";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import {
  revalidatePermitAfterSuspension,
  suspendPermit,
} from "@/lib/execution/api";
import { SuspensionDialog } from "@/components/execution/suspension-dialog";

const DELETE_ROLES = ["tenant-owner", "tenant-admin"] as const;
const SUSPEND_ROLES = ["tenant-owner", "tenant-admin", "hod", "safety-officer"] as const;
const REVALIDATE_ROLES = ["tenant-owner", "tenant-admin", "hod", "job-issuer"] as const;

export default function PermitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { roles } = useAuthProfile();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendError, setSuspendError] = useState<string | null>(null);

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
  const canDelete =
    detail.permit.status === "draft" && hasAnyRole(roles, DELETE_ROLES);
  const canSuspend =
    (detail.permit.status === "approved" || detail.permit.status === "active") &&
    hasAnyRole(roles, SUSPEND_ROLES);
  const canRevalidate =
    detail.permit.status === "suspended" && hasAnyRole(roles, REVALIDATE_ROLES);

  async function handleDelete() {
    const confirmed = window.confirm(
      "Permanently delete this draft permit? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      await deleteDraftPermit(params.id);
      router.push("/permits/drafts");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSuspend() {
    if (!suspendReason.trim()) {
      setSuspendError("A reason is required");
      return;
    }
    setIsSubmitting(true);
    setSuspendError(null);
    try {
      const result = await suspendPermit(params.id, suspendReason.trim());
      setDetail((current) =>
        current ? { ...current, permit: { ...current.permit, ...result.permit } } : current,
      );
      setSuspendOpen(false);
      setSuspendReason("");
    } catch (err) {
      setSuspendError(err instanceof ApiError ? err.message : "Suspend failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevalidate() {
    const confirmed = window.confirm(
      "Revalidate this suspended permit? It will go through full approval again.",
    );
    if (!confirmed) {
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await revalidatePermitAfterSuspension(params.id);
      setDetail(updated);
      router.push(`/approvals/${params.id}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Revalidation failed");
    } finally {
      setIsSubmitting(false);
    }
  }

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
          {canDelete ? (
            <Button variant="destructive" disabled={isSubmitting} onClick={() => void handleDelete()}>
              Delete draft
            </Button>
          ) : null}
          {canSuspend ? (
            <Button
              variant="destructive"
              disabled={isSubmitting}
              onClick={() => {
                setSuspendError(null);
                setSuspendOpen(true);
              }}
            >
              Suspend permit
            </Button>
          ) : null}
          {canRevalidate ? (
            <Button disabled={isSubmitting} onClick={() => void handleRevalidate()}>
              Revalidate after suspension
            </Button>
          ) : null}
          {["approved", "active", "suspended"].includes(detail.permit.status) ? (
            <>
              <Link href={`/execution/${detail.permit.id}`}>
                <Button>
                  {detail.permit.status === "approved" ? "Start execution" : "Open execution"}
                </Button>
              </Link>
              <Link href={`/permits/${detail.permit.id}/multi-day`}>
                <Button variant="outline">Multi-day</Button>
              </Link>
              <Link href={`/lototo/plans/new?permitId=${detail.permit.id}`}>
                <Button variant="outline">Configure LOTOTO</Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

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

      <SuspensionDialog
        open={suspendOpen}
        reason={suspendReason}
        onReasonChange={setSuspendReason}
        error={suspendError}
        isSubmitting={isSubmitting}
        onConfirm={() => void handleSuspend()}
        onClose={() => {
          if (!isSubmitting) {
            setSuspendOpen(false);
            setSuspendReason("");
            setSuspendError(null);
          }
        }}
      />
    </main>
  );
}
