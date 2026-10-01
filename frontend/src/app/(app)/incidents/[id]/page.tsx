"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Eye, Paperclip, Scale } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
import { IncidentClosureWorkflow } from "@/components/incidents/incident-closure-workflow";
import { IncidentStatusBadge } from "@/components/incidents/incident-status-badge";
import { InvestigationWorkflow } from "@/components/incidents/investigation-workflow";
import { fieldClassName } from "@/components/permit/form-field";
import { Button } from "@/components/ui/button";
import { FileUploadField } from "@/components/ui/file-upload-field";
import { StatusChip } from "@/components/ui/status-chip";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { INCIDENT_TYPES, PRIORITIES } from "@/lib/analytics/labels";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { INCIDENT_HOD_DECISION_ROLES, INCIDENT_REPORT_ROLES } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";
import {
  getIncident,
  getIncidentEvidenceUrl,
  getIncidentHistory,
  getInvestigation,
  recordHodDecision,
  submitIncident,
  uploadIncidentEvidence,
} from "@/lib/incidents/api";
import type { ClosureHistoryEntry, IncidentDetail, InvestigationDetail } from "@/lib/incidents/types";

/** Near misses wait for the HOD: does work carry on while it is investigated? */
function HodDecision({ incidentId, onDone }: { incidentId: string; onDone: () => Promise<void> }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "continue" | "stop") {
    setBusy(true);
    setError(null);
    try {
      await recordHodDecision(incidentId, { decision, comment: comment.trim() || undefined });
      toast(decision === "continue" ? "Decision recorded: work continues" : "Decision recorded: work stopped");
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The decision did not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{ "--glow": "var(--act-decide)" } as React.CSSProperties}
      className="is-selected grid gap-3 rounded-xl p-4"
      aria-labelledby="hod-decision"
    >
      <h2 id="hod-decision" className="flex items-center gap-2 font-heading text-lg font-bold">
        <Scale className="size-5 text-(--act-decide)" aria-hidden />
        Your decision is needed
      </h2>
      <p className="text-sm text-muted-foreground">Decide whether related work may continue while this near miss is investigated.</p>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Reason (optional)</span>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} className={`${fieldClassName} min-h-16 py-2`} maxLength={2000} />
      </label>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void decide("continue")} style={{ backgroundColor: "var(--act-do)" }}>
          Work may continue
        </Button>
        <Button disabled={busy} variant="destructive" onClick={() => void decide("stop")}>
          Stop the work
        </Button>
      </div>
    </section>
  );
}

/** Who acts next at each stage (mirrors the work queue's incident actions). */
const NEXT_OWNER: Record<string, string> = {
  draft: "The reporter submits it",
  pending_hod_decision: "HOD decides whether work continues",
  open: "Safety officer assigns an investigator",
  investigating: "Investigator completes the investigation",
  pending_verification: "Safety officer verifies the actions",
  verified: "Safety officer closes it",
};

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const { roles } = useAuthProfile();
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationDetail | null>(null);
  const [history, setHistory] = useState<ClosureHistoryEntry[]>([]);
  const [hasVerification, setHasVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
  }, []);

  const load = useCallback(async () => {
    const incidentDetail = await getIncident(params.id);
    const historyPayload = await getIncidentHistory(params.id).catch(() => null);
    const verification = historyPayload?.verification ?? null;
    setHistory(historyPayload?.history ?? []);
    setHasVerification(Boolean(verification));
    let investigationDetail: InvestigationDetail | null = null;
    if (incidentDetail.incident.status !== "draft") {
      investigationDetail = await getInvestigation(params.id).catch(() => null);
    }
    setInvestigation(investigationDetail);
    if (
      (verification || investigationDetail?.investigation.status === "completed") &&
      incidentDetail.incident.status !== "closed" &&
      incidentDetail.incident.status !== "verified"
    ) {
      incidentDetail.incident.status = "verified";
    }
    setDetail(incidentDetail);
  }, [params.id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "The incident could not be loaded."));
  }, [load]);

  async function handleSubmit() {
    try {
      await submitIncident(params.id);
      toast("Incident submitted for review");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submit failed. Try again.");
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadIncidentEvidence(params.id, file);
      setFile(null);
      toast(`${file.name} uploaded`);
      await load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function openEvidence(evidenceId: string) {
    // Open the tab now (inside the click) so pop-up blockers allow it, then point it at the file.
    const tab = window.open("", "_blank");
    try {
      const { url } = await getIncidentEvidenceUrl(params.id, evidenceId);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      tab?.close();
      toast(err instanceof ApiError ? err.message : "The file could not be opened.", "error");
    }
  }

  if (error) {
    return (
      <main className="p-8 text-sm text-destructive" role="alert">
        {error}
      </main>
    );
  }
  if (!detail) {
    return <main className="p-8 text-sm text-muted-foreground">Loading incident…</main>;
  }

  const { incident } = detail;
  const type = INCIDENT_TYPES[incident.incidentType];
  const priority = PRIORITIES.find((p) => p.key === incident.priority);
  const closed = incident.status === "closed";
  const showInvestigation = !["draft", "pending_hod_decision", "verified", "closed"].includes(incident.status);

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        back={{ href: "/incidents", label: "Incidents" }}
        title={incident.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-foreground">{incident.reference}</span>
            <IncidentStatusBadge status={incident.status} />
            {type ? <StatusChip label={type.label} color={type.color} /> : null}
            {priority ? <StatusChip label={`${priority.label} priority`} color={priority.color} /> : null}
          </span>
        }
        actions={
          incident.status === "draft" && hasAnyRole(roles, INCIDENT_REPORT_ROLES) ? (
            <Button size="lg" onClick={() => void handleSubmit()}>
              Submit incident
            </Button>
          ) : null
        }
      />

      {/* Where it stands: who acts next, who investigates, and what it affects. */}
      <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Next</dt>
          <dd className="mt-0.5 font-medium">{NEXT_OWNER[incident.status] ?? "Nothing pending"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Investigator</dt>
          <dd className="mt-0.5 font-medium">
            {investigation
              ? `${nameOf(lookups?.people, investigation.investigation.investigatorId) ?? "Assigned"}${investigation.investigation.dueDate ? `, due ${formatDateTime(investigation.investigation.dueDate)}` : ""}`
              : "Not assigned"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Related permits</dt>
          <dd className="mt-0.5 flex flex-wrap gap-x-3">
            {detail.permits.length
              ? detail.permits.map((link) => (
                  <Link key={link.permitId} href={`/permits/${link.permitId}`} className="font-medium text-primary hover:underline">
                    {link.permit.reference ?? link.permit.title}
                  </Link>
                ))
              : "None"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Occurred</dt>
          <dd className="mt-0.5 font-medium">
            {formatDateTime(incident.occurredAt)}
            {incident.locationDescription ? `, ${incident.locationDescription}` : ""}
          </dd>
        </div>
      </dl>

      {incident.status === "pending_hod_decision" && hasAnyRole(roles, INCIDENT_HOD_DECISION_ROLES) ? (
        <HodDecision incidentId={incident.id} onDone={load} />
      ) : null}

      {showInvestigation ? (
        <section aria-labelledby="investigation" className="grid gap-3">
          <SectionTitle id="investigation" title="Investigation" />
          <InvestigationWorkflow incidentId={incident.id} detail={investigation} onUpdated={load} />
        </section>
      ) : null}

      {incident.status !== "draft" && incident.status !== "pending_hod_decision" ? (
        <IncidentClosureWorkflow
          incidentId={incident.id}
          status={incident.status}
          hasVerification={hasVerification}
          investigationCompleted={investigation?.investigation.status === "completed"}
          onUpdated={load}
        />
      ) : null}

      <section aria-labelledby="report" className="grid gap-3">
        <SectionTitle id="report" title="Report" />
        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="whitespace-pre-line">{incident.description}</p>
          {detail.equipment.length > 0 ? (
            <p>
              <span className="text-muted-foreground">Equipment: </span>
              <span className="font-medium">{detail.equipment.map((e) => e.machinery.name).join(", ")}</span>
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="evidence" className="grid gap-3">
        <SectionTitle id="evidence" title="Evidence" description="Photos and documents. Select a file to open it." />
        {detail.evidence.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {detail.evidence.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openEvidence(item.id)}
                  className="row-hover flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm"
                >
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.fileName}</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.max(1, Math.round(item.fileSize / 1024))} KB · {formatDateTime(item.createdAt)}
                    </span>
                  </span>
                  <Eye className="size-4 shrink-0 text-(--act-do)" aria-label="Open" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No evidence yet.</p>
        )}
        {!closed && hasAnyRole(roles, INCIDENT_REPORT_ROLES) ? (
          <div className="grid gap-2 rounded-xl border border-border bg-card p-4">
            <FileUploadField id="incident-evidence" label="Add evidence" value={file} onChange={setFile} disabled={uploading} />
            {uploadError ? <p role="alert" className="text-sm text-destructive">{uploadError}</p> : null}
            <Button onClick={() => void handleUpload()} disabled={!file || uploading} className="justify-self-start">
              {uploading ? "Uploading…" : "Upload evidence"}
            </Button>
          </div>
        ) : null}
      </section>

      {history.length > 0 ? (
        <section aria-labelledby="history" className="grid gap-3">
          <SectionTitle id="history" title="History" />
          <ol className="grid gap-1.5 border-l-2 border-border pl-4 text-sm">
            {history.map((entry) => (
              <li key={entry.id}>
                <span className="font-medium capitalize">{entry.eventType.replace(/_/g, " ")}</span>{" "}
                <span className="text-muted-foreground">· {formatDateTime(entry.createdAt)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
