"use client";

import { BackLink } from "@/components/layout/page-header";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { deleteDraftPermit, getPermit } from "@/lib/permit/api";
import { permitDetailToForm } from "@/lib/permit/form";
import type { PermitDetail } from "@/lib/permit/types";
import { isEditablePermitStatus } from "@/lib/permit/status";
import { toast } from "@/components/ui/toast";
import { PermitApprovalStatus } from "@/components/permit/permit-approval-status";
import { PermitJourney } from "@/components/permit/permit-journey";
import { PermitLototoExecution } from "@/components/permit/lototo-execution";
import { PermitPeopleReassign } from "@/components/permit/permit-people-reassign";
import { PermitSummary } from "@/components/permit/permit-summary";
import { PermitFormResponses } from "@/components/permit/permit-form-responses";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { revalidatePermitAfterSuspension, suspendPermit } from "@/lib/execution/api";
import { SuspensionDialog } from "@/components/execution/suspension-dialog";
import { LockKeyhole, Pencil, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative, formatWindow } from "@/lib/format";
import { safetyVetoPermit } from "@/lib/approval/api";
import { SAFETY_VETO_ROLES } from "@/lib/auth/roles";
import { PermitWorkspaceContext } from "@/lib/permit/workspace";
import { CLOSURE_REVIEW_STATUSES, WORKSPACE_TABS, workspaceHref, workspaceTabs, type WorkspaceTab } from "@/lib/permit/workspace-tabs";
import PermitReviewPage from "../../approvals/[permitId]/page";
import PermitClosurePage from "../../closure/[permitId]/page";
import PermitExecutionPage from "../../execution/[permitId]/page";
import MultiDayPermitPage from "./multi-day/page";

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

/**
 * One place for a permit: Overview (where it is, who it waits on, actions), Preparation (the
 * permit and its forms), Review (approval, or verification and closure), Work (on site) and
 * History. Review and Work show the same screens as their own routes, which stay for old links.
 */
function PermitWorkspace() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { roles } = useAuthProfile();
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

  const { permit } = detail;
  const tabs = workspaceTabs(permit.status, roles);
  const requested = searchParams.get("tab") as WorkspaceTab | null;
  // A link to a tab that has nothing for this person (or this status) lands on the Overview.
  const tab: WorkspaceTab = requested && tabs.includes(requested) ? requested : "overview";

  const canEdit = isEditablePermitStatus(permit.status);
  const isResubmit = permit.status === "deferred" || permit.status === "rejected";
  const canDelete = permit.status === "draft" && hasAnyRole(roles, DELETE_ROLES);
  const canSuspend = (permit.status === "approved" || permit.status === "active") && hasAnyRole(roles, SUSPEND_ROLES);
  const canVeto = VETO_STATUSES.includes(permit.status) && hasAnyRole(roles, SAFETY_VETO_ROLES);
  const canRevalidate = permit.status === "suspended" && hasAnyRole(roles, REVALIDATE_ROLES);
  const editLink = canEdit ? (
    <Link href={`/permits/${permit.id}/edit`} className={buttonVariants({ variant: "outline", size: "lg" })}>
      <Pencil aria-hidden />
      {isResubmit ? "Revise and resubmit" : "Edit draft"}
    </Link>
  ) : null;

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
    if (!window.confirm("Permanently delete this draft permit? This cannot be undone.")) return;
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
      setDetail((current) => (current ? { ...current, permit: { ...current.permit, ...result.permit } } : current));
      setSuspendOpen(false);
      setSuspendReason("");
    } catch (err) {
      setSuspendError(err instanceof ApiError ? err.message : "Suspend failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevalidate() {
    if (!window.confirm("Revalidate this suspended permit? It will go through full approval again.")) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      setDetail(await revalidatePermitAfterSuspension(params.id));
      router.push(workspaceHref(params.id, "review"));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Revalidation failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-5 p-4 sm:p-8">
      <header className="print:hidden">
        <BackLink href="/permits" label="Permits" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{permit.title}</h1>
          <PermitStatusBadge status={permit.status} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          <span className="font-mono">{permit.reference ?? "No reference until submitted"}</span>
          <span>{formatWindow(permit.plannedStartAt, permit.plannedEndAt)}</span>
          <span>Updated {formatRelative(permit.updatedAt)}</span>
        </p>
        <nav aria-label="Permit sections" className="-mx-1 mt-4 flex gap-1 overflow-x-auto border-b border-border">
          {WORKSPACE_TABS.filter((t) => tabs.includes(t.key)).map((t) => (
            <Link
              key={t.key}
              href={workspaceHref(permit.id, t.key)}
              scroll={false}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium",
                tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>

      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {tab === "overview" ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid min-w-0 gap-5">
            <PermitJourney id={permit.id} part="now" />
            {detail.permit.lototoRequired &&
            ["approved", "active", "execution_completed", "pending_closure"].includes(detail.permit.status) ? (
              <PermitLototoExecution permitId={detail.permit.id} />
            ) : null}
            <PermitPeopleReassign detail={detail} onSaved={setDetail} />
            <section aria-label="Permit actions" className="flex flex-wrap gap-2 empty:hidden">
              {editLink}
              {canRevalidate ? (
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
              {permit.machineryId && tabs.includes("work") ? (
                <Link href={`/lototo?new=1&machineryId=${permit.machineryId}`} className={buttonVariants({ variant: "ghost", size: "lg" })}>
                  <LockKeyhole aria-hidden />
                  Configure LOTOTO
                </Link>
              ) : null}
            </section>
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
          </div>
          <aside className="rounded-xl border border-border bg-card p-4">
            <PermitApprovalStatus permitId={permit.id} status={permit.status} />
          </aside>
        </div>
      ) : null}

      {tab === "preparation" ? (
        <>
          <div className="flex flex-wrap gap-2 print:hidden">
            {editLink}
            {/* This tab is the print view: printing hides the app chrome and actions. */}
            <Button type="button" variant="ghost" size="lg" onClick={() => window.print()}>
              <Printer aria-hidden />
              Print this permit
            </Button>
          </div>
          <PermitSummary form={permitDetailToForm(detail)} status={permit.status} attachments={detail.attachments} showHeader={false} />
          <PermitFormResponses responses={permit.formResponses ?? []} />
        </>
      ) : null}

      <PermitWorkspaceContext.Provider value={permit.id}>
        {tab === "review" ? CLOSURE_REVIEW_STATUSES.includes(permit.status) ? <PermitClosurePage /> : <PermitReviewPage /> : null}
        {tab === "work" ? (
          <>
            <PermitExecutionPage />
            {permit.status === "approved" ? null : <MultiDayPermitPage />}
          </>
        ) : null}
      </PermitWorkspaceContext.Provider>

      {tab === "history" ? <PermitJourney id={permit.id} part="history" /> : null}

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

export default function PermitWorkspacePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading permit...</p>}>
      <PermitWorkspace />
    </Suspense>
  );
}
