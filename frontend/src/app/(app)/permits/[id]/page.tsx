"use client";

import { BackLink } from "@/components/layout/page-header";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { deleteDraftPermit, getPermit } from "@/lib/permit/api";
import { permitDetailToForm } from "@/lib/permit/form";
import type { PermitDetail } from "@/lib/permit/types";
import { isEditablePermitStatus } from "@/lib/permit/status";
import { toast } from "@/components/ui/toast";
import { PermitApprovalStatus } from "@/components/permit/permit-approval-status";
import { PermitLototoExecution } from "@/components/permit/lototo-execution";
import { PermitPeopleReassign } from "@/components/permit/permit-people-reassign";
import { PermitSummary } from "@/components/permit/permit-summary";
import { PermitFormResponses } from "@/components/permit/permit-form-responses";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import {
  revalidatePermitAfterSuspension,
  suspendPermit,
} from "@/lib/execution/api";
import { SuspensionDialog } from "@/components/execution/suspension-dialog";
import { ArrowRight, CalendarDays, LockKeyhole, Printer, Route, Wrench } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { useWorkQueue } from "@/lib/work-queue-context";
import { safetyVetoPermit } from "@/lib/approval/api";
import { SAFETY_VETO_ROLES } from "@/lib/auth/roles";
import { NODE_BY_ID } from "@/lib/permit/process";

const VETO_STATUSES = ["pending_approval", "approved", "active", "suspended", "deferred", "pending_closure"];
const VETO_REASONS = [
  "Site conditions are not safe",
  "Gas test readings out of limits",
  "Isolation not verified",
  "PPE not adequate for the hazards",
];


const DELETE_ROLES = ["tenant-owner", "tenant-admin"] as const;
const SUSPEND_ROLES = ["tenant-owner", "tenant-admin", "hod", "safety-officer"] as const;
const REVALIDATE_ROLES = ["tenant-owner", "tenant-admin", "hod", "job-issuer"] as const;

export default function PermitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { roles } = useAuthProfile();
  const { items } = useWorkQueue();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendError, setSuspendError] = useState<string | null>(null);
  const [vetoOpen, setVetoOpen] = useState(false);
  const [vetoReason, setVetoReason] = useState("");

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
  const canVeto = VETO_STATUSES.includes(detail.permit.status) && hasAnyRole(roles, SAFETY_VETO_ROLES);
  const canRevalidate =
    detail.permit.status === "suspended" && hasAnyRole(roles, REVALIDATE_ROLES);

  async function handleVeto() {
    if (!vetoReason.trim()) {
      setActionError("Give the reason for stopping this permit. The issuer and approvers will see it.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      await safetyVetoPermit(params.id, vetoReason.trim());
      setVetoOpen(false);
      setVetoReason("");
      setDetail(await getPermit(params.id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "The veto was not recorded. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

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
      toast("Draft deleted");
      router.push("/permits");
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

  const nextAction = items.find((item) => item.permit?.id === detail.permit.id);
  const inExecution = ["approved", "active", "suspended"].includes(detail.permit.status);
  const related = [
    { href: `/permits/${detail.permit.id}/journey`, label: "Journey and current state", icon: Route, show: true },
    { href: `/execution/${detail.permit.id}`, label: "Execution", icon: Wrench, show: inExecution && nextAction?.href !== `/execution/${detail.permit.id}` },
    { href: `/permits/${detail.permit.id}/multi-day`, label: "Daily progress", icon: CalendarDays, show: inExecution },
    { href: `/lototo${detail.permit.machineryId ? `?machineryId=${detail.permit.machineryId}` : ""}`, label: "LOTOTO procedures", icon: LockKeyhole, show: inExecution },
  ].filter((link) => link.show);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div>
        <BackLink href="/permits" label="Permits" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{detail.permit.title}</h1>
          <PermitStatusBadge status={detail.permit.status} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          <span className="font-mono">{detail.permit.reference ?? "No reference until submitted"}</span>
          <span>Updated {formatRelative(detail.permit.updatedAt)}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-5 py-4 print:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{nextAction ? `Your next step: ${nextAction.label.toLowerCase()}` : "What happens next"}</p>
          <p className="text-sm text-muted-foreground">
            {nextAction?.note ? `${nextAction.note}. ` : ""}
            {NODE_BY_ID.get(detail.permit.status)?.meaning ?? ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextAction ? (
            <Link href={nextAction.href} className={cn(buttonVariants({ size: "lg" }))}>
              {nextAction.label}
              <ArrowRight aria-hidden />
            </Link>
          ) : canEdit ? (
            <Link href={`/permits/${detail.permit.id}/edit`} className={buttonVariants({ size: "lg" })}>
              {isResubmit ? "Revise and resubmit" : "Edit draft"}
            </Link>
          ) : null}
          {canRevalidate && nextAction?.action !== "revalidate" ? (
            <Button size="lg" disabled={isSubmitting} onClick={() => void handleRevalidate()}>
              Revalidate
            </Button>
          ) : null}
          {canSuspend ? (
            <Button
              size="lg"
              variant="destructive"
              disabled={isSubmitting}
              onClick={() => {
                setSuspendError(null);
                setSuspendOpen(true);
              }}
            >
              Suspend work
            </Button>
          ) : null}
          {canVeto ? (
            <Button size="lg" variant="destructive" disabled={isSubmitting} onClick={() => setVetoOpen((v) => !v)}>
              Stop work (safety veto)
            </Button>
          ) : null}
          {canDelete ? (
            <Button size="lg" variant="ghost" disabled={isSubmitting} onClick={() => void handleDelete()}>
              Delete draft
            </Button>
          ) : null}
        </div>
      </div>

      {vetoOpen ? (
        <section aria-labelledby="veto-heading" className="grid gap-3 rounded-xl border border-(--status-danger) bg-(--status-danger-bg) p-5">
          <h2 id="veto-heading" className="font-semibold text-(--status-danger)">
            Stop this permit
          </h2>
          <p className="text-sm">The permit is rejected immediately. The issuer can revise it and submit it again.</p>
          <div className="flex flex-wrap gap-1.5">
            {VETO_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setVetoReason((c) => (c.trim() ? `${c.trim()}\n${reason}` : reason))}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted"
              >
                {reason}
              </button>
            ))}
          </div>
          <label htmlFor="veto-reason" className="text-sm font-medium">
            Reason
          </label>
          <textarea
            id="veto-reason"
            rows={3}
            value={vetoReason}
            onChange={(e) => setVetoReason(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" disabled={isSubmitting} onClick={() => void handleVeto()}>
              {isSubmitting ? "Stopping…" : "Stop permit"}
            </Button>
            <Button variant="ghost" onClick={() => setVetoOpen(false)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] print:block">
        <div className="grid min-w-0 gap-6">
          <PermitSummary form={form} status={detail.permit.status} attachments={detail.attachments} showHeader={false} />
          <PermitPeopleReassign detail={detail} onSaved={setDetail} />
          {detail.permit.lototoRequired &&
          ["approved", "active", "execution_completed", "pending_closure"].includes(detail.permit.status) ? (
            <PermitLototoExecution permitId={detail.permit.id} />
          ) : null}
          <PermitFormResponses responses={detail.permit.formResponses ?? []} />
        </div>
        {/* One box: where the permit is in its lifecycle, its history, and where to go from here. */}
        <aside className="grid gap-4 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-18 print:hidden">
          <PermitApprovalStatus permitId={detail.permit.id} status={detail.permit.status} />
          <nav aria-label="Related records" className="-mx-1 grid border-t border-border pt-3">
            {related.map((link) => (
              <Link key={link.href} href={link.href} className="press flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted">
                <link.icon className="size-4 text-muted-foreground" aria-hidden />
                {link.label}
              </Link>
            ))}
            {/* This page is the print view: printing hides the app chrome and actions. */}
            <button type="button" onClick={() => window.print()} className="press flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">
              <Printer className="size-4 text-muted-foreground" aria-hidden />
              Print this permit
            </button>
          </nav>
        </aside>
      </div>

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
