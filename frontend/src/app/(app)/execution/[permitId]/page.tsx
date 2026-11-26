"use client";

import { VerificationEvidenceCapture } from "@/components/common/verification-evidence-capture";
import { BackLink } from "@/components/layout/page-header";
import Link from "next/link";
import { formatDateTime, formatWindow } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PermitPageShell, useInPermitWorkspace, usePermitPageId } from "@/lib/permit/workspace";
import { ApiError } from "@/lib/api";
import {
  activatePermit,
  releasePermitForExecution,
  addProgress,
  completeExecution,
  getEvidenceDownloadUrl,
  getWorkCycle,
  listEvidence,
  listProgress,
  pauseWork,
  resumePermit,
  resumeWork,
  revalidatePermitAfterSuspension,
  saveExecutionStart,
  suspendPermit,
  uploadEvidence,
} from "@/lib/execution/api";
import { openPresignedDownload } from "@/lib/download";
import { WorkPauseForm } from "@/components/execution/work-pause-form";
import { WorkResumeForm } from "@/components/execution/work-resume-form";
import { DayRecordHistory } from "@/components/multi-day/day-record-history";
import { HandoverForm } from "@/components/multi-day/handover-form";
import { HandoverList } from "@/components/multi-day/handover-list";
import { TimeRequests } from "@/components/multi-day/time-requests";
import { getDayCycle, listDaySecures, listHandovers, listRevalidationHistory } from "@/lib/multi-day/api";
import type { DaySecureRecord, RevalidationHistoryEvent, ShiftHandoverRecord } from "@/lib/multi-day/types";
import type { WorkCycleSnapshot } from "@/lib/execution/types";
import { parseExecutionStart, type ExecutionStartState } from "@/lib/execution/start";
import { StartExecutionSteps, type StartExecutionEvidences } from "@/components/execution/start-execution-steps";
import { masterDataApi, type HazardRecord } from "@/lib/master-data/api";
import type { EvidenceRecord, PermitExecution, ProgressRecord } from "@/lib/execution/types";
import { getPermit, getPermitLototoExecution } from "@/lib/permit/api";
import { PermitLototoExecution } from "@/components/permit/lototo-execution";
import { permitDetailToForm } from "@/lib/permit/form";
import type { PermitDetail } from "@/lib/permit/types";
import { ActivityLog } from "@/components/execution/activity-log";
import { EvidenceUpload } from "@/components/execution/evidence-upload";
import { EvidencePreviewList } from "@/components/execution/evidence-preview-list";
import { ProgressFeed } from "@/components/execution/progress-feed";
import { StatusTimeline } from "@/components/execution/status-timeline";
import { SuspensionDialog } from "@/components/execution/suspension-dialog";
import { identityFromPermit, PermitSummary } from "@/components/permit/permit-summary";
import { PermitFormResponses } from "@/components/permit/permit-form-responses";
import { DayCycleBadge } from "@/components/multi-day/day-cycle-badge";
import { MultiDayPolicySummary } from "@/components/multi-day/multi-day-policy-summary";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { DayCycleSnapshot } from "@/lib/multi-day/types";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";

const START_RESUME_ROLES = [
  "permit-operator",
  "permit-approver",
  "tenant-owner",
  "tenant-admin",
  "platform-admin",
] as const;
const SUSPEND_ROLES = ["tenant-owner", "tenant-admin", "permit-approver", "safety-officer"] as const;
const REVALIDATE_ROLES = ["tenant-owner", "tenant-admin", "permit-approver", "permit-receiver"] as const;

/** Common site updates, so logging progress on a phone needs little typing. */
const PROGRESS_PHRASES = [
  "Work started",
  "Isolations verified before start",
  "Work progressing as planned",
  "Temporary stop — leaving area safe",
  "Area cleaned and tools removed",
];

export default function PermitExecutionPage() {
  const permitId = usePermitPageId("permitId");
  const embedded = useInPermitWorkspace();
  const router = useRouter();
  const { roles, profile } = useAuthProfile();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [dayCycle, setDayCycle] = useState<DayCycleSnapshot | null>(null);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [execution, setExecution] = useState<PermitExecution | null>(null);
  const [workCycle, setWorkCycle] = useState<WorkCycleSnapshot | null>(null);
  const [handovers, setHandovers] = useState<ShiftHandoverRecord[]>([]);
  const [daySecures, setDaySecures] = useState<DaySecureRecord[]>([]);
  const [reopenHistory, setReopenHistory] = useState<RevalidationHistoryEvent[]>([]);
  const handoverExecutorIds = useMemo(
    () => detail?.executors.map((row) => row.workforceUserId) ?? [],
    [detail],
  );
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [progressSummary, setProgressSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingEvidenceId, setDownloadingEvidenceId] = useState<string | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendError, setSuspendError] = useState<string | null>(null);
  const [lototoIsolated, setLototoIsolated] = useState<boolean | null>(null);
  const [lototoRestored, setLototoRestored] = useState<boolean | null>(null);
  const [start, setStart] = useState<ExecutionStartState>(parseExecutionStart(null));
  const [hazards, setHazards] = useState<Map<string, HazardRecord>>(new Map());
  const [ppeNames, setPpeNames] = useState<Map<string, string>>(new Map());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [siteReady, setSiteReady] = useState(false);
  const [detailsCorrect, setDetailsCorrect] = useState(false);
  const [completeComment, setCompleteComment] = useState("");
  const [completeEvidence, setCompleteEvidence] = useState<File | null>(null);
  const [completeChecklist, setCompleteChecklist] = useState({
    workDescribedComplete: false,
    procedureFollowed: false,
    lototoDone: false,
    gasTestingDone: false,
  });

  async function loadData() {
    const permitDetail = await getPermit(permitId);
    setDetail(permitDetail);
    setStart(parseExecutionStart(permitDetail.permit.executionStart));
    if (permitDetail.multiDay?.isMultiDay) {
      setDayCycle(await getDayCycle(permitId).catch(() => null));
    } else {
      setDayCycle(null);
    }

    if (permitDetail.permit.lototoRequired) {
      const certificates = permitDetail.isolationCertificates ?? [];
      if (certificates.length > 0) {
        setLototoIsolated(certificates.every((certificate) => certificate.status === "isolated_verified"));
        setLototoRestored(permitDetail.permit.lototoRestored === true);
      } else {
        const board = await getPermitLototoExecution(permitId);
        setLototoIsolated(board.isolated);
        setLototoRestored(permitDetail.permit.lototoRestored === true);
      }
    } else {
      setLototoIsolated(true);
      setLototoRestored(true);
    }

    if (permitDetail.permit.status === "active" || permitDetail.permit.status === "suspended") {
      const [progressItems, evidenceItems, workResult, handoverRows, secureRows, reopenRows] = await Promise.all([
        listProgress(permitId),
        listEvidence(permitId),
        getWorkCycle(permitId)
          .then((work) => ({ work, error: null as string | null }))
          .catch((err) => ({
            work: null,
            error: err instanceof ApiError ? err.message : "Failed to load work cycle",
          })),
        listHandovers(permitId).catch(() => [] as ShiftHandoverRecord[]),
        permitDetail.multiDay?.isMultiDay
          ? listDaySecures(permitId).catch(() => [] as DaySecureRecord[])
          : Promise.resolve([] as DaySecureRecord[]),
        permitDetail.multiDay?.isMultiDay
          ? listRevalidationHistory(permitId).catch(() => [] as RevalidationHistoryEvent[])
          : Promise.resolve([] as RevalidationHistoryEvent[]),
      ]);
      setProgress(progressItems);
      setEvidence(evidenceItems);
      setWorkCycle(workResult.work);
      setActionError(workResult.error);
      setHandovers(handoverRows);
      setDaySecures(secureRows);
      setReopenHistory(reopenRows);
      const work = workResult.work;
      if (work?.execution) {
        setExecution((current) => ({
          id: work.execution!.id,
          permitId,
          activatedAt: current?.activatedAt ?? work.execution!.actualStartAt,
          activatedBy: current?.activatedBy ?? "",
          actualStartAt: work.execution!.actualStartAt,
          workState: work.execution!.workState,
          workPausedAt: work.execution!.workPausedAt ?? null,
          workResumedAt: work.execution!.workResumedAt ?? null,
          suspendedAt: work.execution!.suspendedAt ?? current?.suspendedAt ?? null,
          suspendedBy: current?.suspendedBy ?? null,
          suspensionReason: current?.suspensionReason ?? null,
          resumedAt: current?.resumedAt ?? null,
          resumedBy: current?.resumedBy ?? null,
        }));
      }
    } else {
      setWorkCycle(null);
      setHandovers([]);
      setDaySecures([]);
      setReopenHistory([]);
    }
  }

  useEffect(() => {
    loadData().catch((err) => {
      setError(err instanceof ApiError ? err.message : "Failed to load permit");
    });
    Promise.all([masterDataApi.hazards(), masterDataApi.ppe()])
      .then(([hazardRows, ppeRows]) => {
        setHazards(new Map(hazardRows.map((row) => [row.id, row])));
        setPpeNames(new Map(ppeRows.map((row) => [row.id, row.name])));
      })
      .catch(() => undefined);
  }, [permitId]);

  async function handleActivate(evidences?: StartExecutionEvidences) {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const result = await activatePermit(permitId, { start });
      setWizardOpen(false);
      setDetail((current) =>
        current ? { ...current, permit: result.permit } : current,
      );
      setExecution(result.execution);

      if (evidences) {
        if (evidences.toolbox) {
          try {
            await uploadEvidence(permitId, evidences.toolbox, { comment: "Toolbox talk evidence" });
          } catch {
            // Non-blocking upload error after activation
          }
        }
        if (evidences.hazards) {
          for (const [key, file] of Object.entries(evidences.hazards)) {
            if (file) {
              try {
                await uploadEvidence(permitId, file, { comment: `Hazard control ${key} evidence` });
              } catch {
                // Non-blocking upload error
              }
            }
          }
        }
        if (evidences.ppes) {
          for (const [ppeId, file] of Object.entries(evidences.ppes)) {
            if (file) {
              try {
                await uploadEvidence(permitId, file, { comment: `PPE ${ppeNames.get(ppeId) ?? ppeId} readiness evidence` });
              } catch {
                // Non-blocking upload error
              }
            }
          }
        }
        if (evidences.lototo) {
          try {
            await uploadEvidence(permitId, evidences.lototo, { comment: "LOTOTO verification evidence" });
          } catch {
            // Non-blocking upload error
          }
        }
        if (evidences.gasMeter) {
          try {
            await uploadEvidence(permitId, evidences.gasMeter, { comment: "Gas test meter photo" });
          } catch {
            // Non-blocking upload error
          }
        }
      }

      toast("Work started");
      await loadData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Activation failed";
      setActionError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRelease() {
    if (!(await confirmAction("Release this permit for execution? The executor can then start the work.", {
      title: "Release for execution",
      confirmLabel: "Release for execution",
    }))) {
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      await releasePermitForExecution(permitId, { siteReady: true, detailsCorrect: true });
      setSiteReady(false);
      setDetailsCorrect(false);
      toast("Released for execution");
      await loadData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Release failed";
      setActionError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBegin() {
    const released = Boolean(detail?.permit.executionReleasedAt);
    if (!released) {
      setIsSubmitting(true);
      setActionError(null);
      try {
        await releasePermitForExecution(permitId, { siteReady: true, detailsCorrect: true });
        toast("Released for execution");
        await loadData();
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Release failed";
        setActionError(msg);
        toast(msg, "error");
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }
    setWizardOpen(true);
  }

  async function handleResume() {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const result = await resumePermit(permitId);
      setDetail((current) =>
        current ? { ...current, permit: result.permit } : current,
      );
      setExecution(result.execution);
      toast("Permit resumed");
      await loadData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Resume failed";
      setActionError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevalidate() {
    const confirmed = await confirmAction(
      "Revalidate this suspended permit? It will go through full approval again.",
    );
    if (!confirmed) {
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      await revalidatePermitAfterSuspension(permitId);
      toast("Permit revalidated, sent for approval");
      router.push(`/approvals/${permitId}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Revalidation failed";
      setActionError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSuspend(file?: File | null) {
    setIsSubmitting(true);
    setSuspendError(null);
    try {
      if (file) {
        await uploadEvidence(permitId, file, { comment: "Suspension evidence" });
      }
      const result = await suspendPermit(permitId, suspendReason);
      setDetail((current) =>
        current ? { ...current, permit: result.permit } : current,
      );
      setExecution(result.execution);
      setSuspendOpen(false);
      setSuspendReason("");
      toast("Permit suspended");
      await loadData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Suspension failed";
      setSuspendError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePauseWork(payload: {
    summary: string;
    checklist: Record<string, boolean>;
    notes?: string;
    overnightRestoreChosen?: boolean;
    lototoRemovals?: string[];
    lateReason?: string;
  }) {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const result = await pauseWork(permitId, payload);
      setExecution(result.execution);
      toast("Work paused");
      await loadData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Pause failed";
      setActionError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResumeWork(payload: {
    checklist: Record<string, boolean>;
    notes?: string;
    crew?: Array<{ workforceUserId: string; role: "primary" | "substitute" }>;
  }) {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const result = await resumeWork(permitId, payload);
      setExecution(result.execution);
      toast("Work resumed");
      await loadData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Resume work failed";
      setActionError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteExecution() {
    const lototoOk = !detail?.permit.lototoRequired || completeChecklist.lototoDone;
    const gasOk = !detail?.permit.gasTestingRequired || completeChecklist.gasTestingDone;
    if (
      !completeComment.trim() ||
      !completeChecklist.workDescribedComplete ||
      !completeChecklist.procedureFollowed ||
      !lototoOk ||
      !gasOk
    ) {
      setActionError("Complete the checklist and add a comment before declaring execution complete.");
      return;
    }
    const confirmed = await confirmAction(
      "This ends the job for this permit. You cannot pause again after completion. Continue?",
      { title: "Mark execution completed", confirmLabel: "Ends the job" },
    );
    if (!confirmed) {
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      if (completeEvidence) {
        await uploadEvidence(permitId, completeEvidence, { comment: "Execution completion evidence" });
      }
      const updated = await completeExecution(permitId, {
        comment: completeComment.trim(),
        checklist: {
          ...completeChecklist,
          lototoDone: !detail?.permit.lototoRequired || completeChecklist.lototoDone,
          gasTestingDone: !detail?.permit.gasTestingRequired || completeChecklist.gasTestingDone,
        },
      });
      setDetail(updated);
      setCompleteEvidence(null);
      toast("Execution marked complete");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not complete execution";
      setActionError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddProgress(event: React.FormEvent) {
    event.preventDefault();
    if (!progressSummary.trim()) {
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const record = await addProgress(permitId, { summary: progressSummary.trim() });
      setProgress((items) => [...items, record]);
      setProgressSummary("");
      toast("Progress update saved successfully");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to record progress";
      setActionError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUploadEvidence(file: File, comment: string): Promise<boolean> {
    setIsUploading(true);
    setUploadError(null);
    try {
      const record = await uploadEvidence(permitId, file, {
        comment: comment.trim() || undefined,
      });
      setEvidence((items) => [...items, record]);
      toast(`${file.name} uploaded successfully`);
      return true;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Upload failed";
      setUploadError(msg);
      toast(msg, "error");
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  async function handleOpenEvidence(evidenceId: string) {
    setDownloadingEvidenceId(evidenceId);
    try {
      await openPresignedDownload(() => getEvidenceDownloadUrl(permitId, evidenceId));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to open evidence file";
      toast(msg, "error");
    } finally {
      setDownloadingEvidenceId(null);
    }
  }

  if (error) {
    return (
      <div className="p-8 text-sm text-destructive" role="alert">
        {error}
      </div>
    );
  }

  if (!detail) {
    return <p className="p-8 text-sm text-muted-foreground">Loading permit execution...</p>;
  }

  const { permit } = detail;
  const form = permitDetailToForm(detail);
  const isApproved = permit.status === "approved";
  const isActive = permit.status === "active";
  const isSuspended = permit.status === "suspended";
  const privileged = hasAnyRole(roles, ["tenant-owner", "tenant-admin", "platform-admin"]);
  const assignedExecutor = Boolean(profile && detail.executors.some((row) => row.workforceUserId === profile.id));
  const primaryExecutor = Boolean(
    profile && detail.executors.some((row) => row.workforceUserId === profile.id && row.isPrimary),
  );
  const canRunThisPermit = privileged || assignedExecutor;
  const released = Boolean(permit.executionReleasedAt);
  const isReceiver = Boolean(profile && (permit.submittedBy === profile.id || permit.createdBy === profile.id));
  const checksReady = siteReady && detailsCorrect;
  const releasesThenStarts = isApproved && !released && isReceiver && canRunThisPermit;
  const canWriteProgress = hasAnyRole(roles, START_RESUME_ROLES);
  const canComplete = privileged || (hasAnyRole(roles, ["permit-operator"]) && primaryExecutor);
  const completeOff = hasAnyRole(roles, ["permit-operator"]) && !canComplete;
  const workUi = workCycle?.workUiState ?? (isActive ? "in_progress" : isSuspended ? "suspended" : null);
  const workInProgress = workUi === "in_progress";
  const workPaused = workUi === "paused";
  const missedSecureDates = workCycle?.missingPriorSecureDates ?? [];
  const lateSecureBlocked = workInProgress && missedSecureDates.length > 0;
  const cutoffBlocked = workInProgress && workCycle?.pastCutoff === true && !lateSecureBlocked;
  const workWriteBlocked = lateSecureBlocked || cutoffBlocked;
  const pendingHandover = handovers.find((row) => row.status === "pending_acceptance");
  const canCreateHandover =
    !pendingHandover &&
    Boolean(profile) &&
    (!handovers[0]?.custodyHeldBy || handovers[0].custodyHeldBy === profile?.id);

  return (
    <PermitPageShell>
      {embedded ? null : (
      <div>
        <BackLink href="/permits" label="Permits" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{permit.title}</h1>
          <PermitStatusBadge status={permit.status} />
          {dayCycle?.isMultiDay ? (
            <DayCycleBadge permitId={permit.id} dayCycleState={dayCycle.dayCycleState} />
          ) : null}
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {permit.reference ? <span className="font-mono">{permit.reference}</span> : null}
          <span>{formatWindow(permit.plannedStartAt, permit.plannedEndAt)}</span>
        </p>
        {detail?.multiDay?.isMultiDay ? (
          <div className="mt-3">
            <MultiDayPolicySummary multiDay={detail.multiDay} dayCycle={dayCycle} />
          </div>
        ) : null}
        <nav aria-label="Execution records" className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href={`/permits/${permit.id}`} className="text-primary hover:underline">Permit</Link>
          <Link href={`/execution/${permit.id}/progress`} className="text-primary hover:underline">Progress timeline</Link>
          <Link href={`/execution/${permit.id}/evidence`} className="text-primary hover:underline">Evidence photos</Link>
        </nav>
      </div>
      )}

      {actionError ? (
        <div role="alert" className="text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      {permit.status === "execution_completed" ? (
        <div className="grid gap-1 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Work complete — next steps</p>
          <p>
            {permit.lototoRequired && lototoRestored !== true
              ? "1) Receiver verifies completion. 2) Restore energy / remove personal locks in LOTOTO. 3) Request close. 4) Approver closes."
              : "1) Receiver verifies completion. 2) Request close (plant may stay isolated until restored in LOTOTO). 3) Approver closes."}
          </p>
        </div>
      ) : null}

      {permit.lototoRequired && (detail?.isolationCertificates ?? []).length === 0 && (isActive || permit.status === "execution_completed") ? (
        <PermitLototoExecution
          permitId={permit.id}
          reloadKey={permit.status}
          onBoardChange={(board) => {
            setLototoIsolated(board.isolated);
          }}
        />
      ) : null}

      {isApproved && !released && isReceiver ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Release for execution</h2>
          <div className="grid gap-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={siteReady} onChange={(event) => setSiteReady(event.target.checked)} />
              Site is ready for execution
            </label>
          </div>
          <div className="grid gap-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={detailsCorrect} onChange={(event) => setDetailsCorrect(event.target.checked)} />
              The approved work, place and people are still correct
            </label>
          </div>
        </section>
      ) : null}

      {isApproved && !released && !isReceiver ? (
        <p className="text-sm text-muted-foreground">Waiting for the receiver to release this permit.</p>
      ) : null}

      {isApproved && released ? (
        <p className="text-sm text-muted-foreground">
          Released for execution{permit.executionReleasedAt ? ` ${formatDateTime(permit.executionReleasedAt)}` : ""}.
        </p>
      ) : null}

      {isApproved && released && canRunThisPermit && wizardOpen ? (
        <StartExecutionSteps
          permitId={permit.id}
          detail={detail}
          form={form}
          hazards={hazards}
          ppeNames={ppeNames}
          lototoIsolated={lototoIsolated !== false}
          start={start}
          isSubmitting={isSubmitting}
          onChange={setStart}
          onSave={async () => {
            try {
              await saveExecutionStart(permitId, start);
              toast("Start time saved");
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : "Failed to save start time";
              toast(msg, "error");
              throw err;
            }
          }}
          onBeginWork={handleActivate}
          onPostpone={() => setWizardOpen(false)}
          onSuspend={() => setSuspendOpen(true)}
        />
      ) : null}

      <section className="flex flex-wrap gap-2">
        {isApproved && !released && isReceiver && !canRunThisPermit ? (
          <Button onClick={() => void handleRelease()} disabled={isSubmitting || !checksReady}>
            Release for execution
          </Button>
        ) : null}
        {((isApproved && released && canRunThisPermit) || releasesThenStarts) && !wizardOpen ? (
          <Button onClick={() => void handleBegin()} disabled={isSubmitting || (releasesThenStarts && !checksReady)}>
            Start Permit Execution
          </Button>
        ) : null}
        {isApproved || isActive ? (
          hasAnyRole(roles, SUSPEND_ROLES) ? (
            <Button variant="destructive" onClick={() => setSuspendOpen(true)} disabled={isSubmitting}>
              Suspend work
            </Button>
          ) : null
        ) : null}
        {isSuspended && canRunThisPermit ? (
          <Button onClick={() => void handleResume()} disabled={isSubmitting}>
            {isSubmitting ? "Resuming..." : "Resume work"}
          </Button>
        ) : null}
        {isSuspended && hasAnyRole(roles, REVALIDATE_ROLES) ? (
          <Button onClick={() => void handleRevalidate()} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Revalidate after suspension"}
          </Button>
        ) : null}
      </section>


      {(isActive || isSuspended) && (
        <>
          {dayCycle?.isMultiDay ? (
            <section className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
              <span className="font-medium">Day cycle</span>
              <DayCycleBadge permitId={permit.id} dayCycleState={dayCycle.dayCycleState} />
              {dayCycle.currentOperationalDate ? (
                <span className="text-muted-foreground">{dayCycle.currentOperationalDate}</span>
              ) : null}
            </section>
          ) : null}
          {isActive && workUi ? (
            <section className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
              <span className="font-medium">Work state</span>
              <span className="rounded-md border border-border px-2 py-0.5 text-xs uppercase tracking-wide">
                {workPaused ? "Paused" : workInProgress ? "In progress" : workUi}
              </span>
              {workPaused ? (
                <span className="text-muted-foreground">Resume before logging progress or completing.</span>
              ) : null}
            </section>
          ) : null}

          <section className="grid gap-3">
            <h2 className="text-sm font-semibold">Execution timeline</h2>
            <StatusTimeline execution={execution} history={workCycle?.history} />
          </section>

          {isActive && workPaused && workCycle && canWriteProgress ? (
            <WorkResumeForm
              work={workCycle}
              disabled={!canRunThisPermit}
              isSubmitting={isSubmitting}
              onSubmit={handleResumeWork}
            />
          ) : null}

          {isActive && workInProgress && canWriteProgress ? (
            <>
              {lateSecureBlocked ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                  Progress, evidence, and complete are blocked until you pause. Missed days: {missedSecureDates.join(", ")}.
                </p>
              ) : null}
              {cutoffBlocked ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                  The operational day cut-off has passed. Pause and leave the area safe before logging more progress or completing. This pause does not close the day unless it is still open tomorrow.
                </p>
              ) : null}
              <section className="grid gap-3">
                <h2 className="text-sm font-semibold">Add progress update</h2>
                {!canRunThisPermit ? (
                  <p className="text-sm text-muted-foreground">Only an assigned executor can log progress on this permit.</p>
                ) : null}
                <form className="grid gap-3 rounded-lg border border-border p-4" onSubmit={handleAddProgress}>
                  <div className="flex flex-wrap gap-1.5">
                    {PROGRESS_PHRASES.map((phrase) => (
                      <button
                        key={phrase}
                        type="button"
                        disabled={isSubmitting || !canRunThisPermit || workWriteBlocked}
                        onClick={() => setProgressSummary((c) => (c.trim() ? `${c.trim()}. ${phrase}` : phrase))}
                        className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
                      >
                        {phrase}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={progressSummary}
                    required
                    disabled={isSubmitting || !canRunThisPermit || workWriteBlocked}
                    onChange={(event) => setProgressSummary(event.target.value)}
                    placeholder="Describe work completed or current status..."
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Button type="submit" disabled={isSubmitting || !canRunThisPermit || workWriteBlocked || !progressSummary.trim()}>
                    {isSubmitting ? "Saving..." : "Save progress"}
                  </Button>
                </form>
              </section>

              <section className="grid gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Upload evidence</h2>
                  <Link
                    href={`/execution/${permit.id}/evidence`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View gallery ({evidence.length})
                  </Link>
                </div>
                <EvidenceUpload
                  disabled={!isActive || !canRunThisPermit || workWriteBlocked}
                  isUploading={isUploading}
                  error={uploadError}
                  onUpload={handleUploadEvidence}
                />
                {evidence.length > 0 ? (
                  <div className="mt-2 grid gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Uploaded evidence ({evidence.length})</p>
                    <EvidencePreviewList
                      evidence={evidence.slice().reverse()}
                      onOpen={handleOpenEvidence}
                      openingId={downloadingEvidenceId}
                    />
                  </div>
                ) : null}
              </section>

              {workCycle ? (
                <WorkPauseForm
                  work={workCycle}
                  disabled={!canRunThisPermit}
                  isSubmitting={isSubmitting}
                  onSubmit={handlePauseWork}
                />
              ) : (
                <section className="rounded-lg border border-border p-4">
                  <h2 className="text-sm font-semibold">Pause work</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Work cycle could not be loaded. Refresh the page before pausing.
                  </p>
                </section>
              )}

              {canComplete || completeOff ? (
                <section className="grid gap-3 rounded-lg border border-border p-4">
                  <h2 className="text-sm font-semibold">Declare execution completed</h2>
                  {completeOff ? (
                    <p className="text-sm text-muted-foreground">Only the primary executor can complete this permit.</p>
                  ) : null}
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={completeOff || workWriteBlocked}
                      checked={completeChecklist.workDescribedComplete}
                      onChange={(e) => setCompleteChecklist((current) => ({ ...current, workDescribedComplete: e.target.checked }))}
                    />
                    Work described in the permit is complete
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={completeOff || workWriteBlocked}
                      checked={completeChecklist.procedureFollowed}
                      onChange={(e) => setCompleteChecklist((current) => ({ ...current, procedureFollowed: e.target.checked }))}
                    />
                    Procedure was followed
                  </label>
                  {permit.lototoRequired ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input
                      type="checkbox"
                      disabled={completeOff || workWriteBlocked}
                      checked={completeChecklist.lototoDone}
                        onChange={(e) => setCompleteChecklist((current) => ({ ...current, lototoDone: e.target.checked }))}
                      />
                      LOTOTO is done
                    </label>
                  ) : null}
                  {permit.gasTestingRequired ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input
                      type="checkbox"
                      disabled={completeOff || workWriteBlocked}
                      checked={completeChecklist.gasTestingDone}
                        onChange={(e) => setCompleteChecklist((current) => ({ ...current, gasTestingDone: e.target.checked }))}
                      />
                      Gas testing is done
                    </label>
                  ) : null}
                  <textarea
                    value={completeComment}
                    required
                    disabled={isSubmitting || completeOff || workWriteBlocked}
                    onChange={(event) => setCompleteComment(event.target.value)}
                    placeholder="Completion comments (required)"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <VerificationEvidenceCapture
                    visible={Boolean(completeChecklist.workDescribedComplete && completeChecklist.procedureFollowed)}
                    label="Execution completion photo / closing evidence"
                    hint="Optional — attach a closing site photo if none uploaded yet"
                    file={completeEvidence}
                    onFileChange={setCompleteEvidence}
                    disabled={isSubmitting || completeOff || workWriteBlocked}
                  />
                  <Button
                    onClick={() => void handleCompleteExecution()}
                    disabled={isSubmitting || completeOff || workWriteBlocked || !completeComment.trim()}
                  >
                    {isSubmitting ? "Submitting..." : "Mark execution completed"}
                  </Button>
                </section>
              ) : null}
            </>
          ) : null}

          <section className="grid gap-3">
            <h2 className="text-sm font-semibold">Recent progress</h2>
            <ProgressFeed items={progress.slice().reverse().slice(0, 5)} />
          </section>

          {(isActive || isSuspended) ? (
            <section className="grid gap-3">
              <h2 className="text-sm font-semibold">Shift handover</h2>
              <p className="text-xs text-muted-foreground">
                Separate from Pause. Use Pause to leave the job safe; use handover to transfer shift custody.
                Accepting may require LOTOTO custody acknowledgement when isolations remain open.
              </p>
              {canCreateHandover ? (
                <HandoverForm
                  permitId={permitId}
                  progressRecords={[]}
                  executorIds={handoverExecutorIds}
                  currentUserId={profile?.id}
                  hideTitle
                  onSaved={() => void loadData()}
                />
              ) : null}
              <HandoverList
                permitId={permitId}
                handovers={handovers}
                currentUserId={profile?.id}
                onChanged={() => void loadData()}
              />
            </section>
          ) : null}

          {(isActive || isSuspended) && detail?.multiDay?.isMultiDay ? (
            <DayRecordHistory
              pauses={(workCycle?.history ?? []).filter((row) => row.kind === "paused")}
              secures={daySecures}
              reopens={reopenHistory}
              handovers={handovers}
            />
          ) : null}

          {isActive || isSuspended ? (
            <TimeRequests permitId={permitId} onUpdated={() => void loadData()} />
          ) : null}

          <section className="grid gap-3">
            <h2 className="text-sm font-semibold">Activity log</h2>
            <ActivityLog execution={execution} progress={progress} evidence={evidence} />
          </section>
        </>
      )}

      {/* Once work is under way the crew knows the permit; keep it one tap away instead of in the way. */}
      {/* In the workspace the Preparation tab has the permit, so it starts closed there. */}
      <details open={isApproved && !embedded} className="group rounded-xl border border-border bg-card open:border-transparent open:bg-transparent">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold group-open:px-0 group-open:pb-3">
          Permit details <span className="font-normal text-muted-foreground group-open:hidden">(tap to open)</span>
        </summary>
        <div className="grid gap-4">
          <PermitSummary form={form} status={permit.status} showHeader={false} identity={identityFromPermit(permit)} />
          <PermitFormResponses responses={permit.formResponses ?? []} />
        </div>
      </details>

      <SuspensionDialog
        open={suspendOpen}
        reason={suspendReason}
        isSubmitting={isSubmitting}
        error={suspendError}
        onReasonChange={setSuspendReason}
        onConfirm={handleSuspend}
        onClose={() => {
          if (!isSubmitting) {
            setSuspendOpen(false);
            setSuspendReason("");
            setSuspendError(null);
          }
        }}
      />
    </PermitPageShell>
  );
}
