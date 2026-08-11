"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  continueNearMiss,
  getIncident,
  getIncidentHistory,
  getInvestigation,
  stopNearMiss,
  submitIncident,
  uploadIncidentEvidence,
} from "@/lib/incidents/api";
import type {
  ClosureHistoryEntry,
  IncidentDetail,
  InvestigationDetail,
} from "@/lib/incidents/types";
import { IncidentClosureWorkflow } from "@/components/incidents/incident-closure-workflow";
import { IncidentStatusBadge } from "@/components/incidents/incident-status-badge";
import { InvestigationWorkflow } from "@/components/incidents/investigation-workflow";
import { Button } from "@/components/ui/button";

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationDetail | null>(null);
  const [history, setHistory] = useState<ClosureHistoryEntry[]>([]);
  const [hasVerification, setHasVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const incidentDetail = await getIncident(params.id);

    const historyPayload = await getIncidentHistory(params.id).catch(() => null);
    const verification = historyPayload?.verification ?? null;
    setHistory(historyPayload?.history ?? []);
    setHasVerification(Boolean(verification));

    let investigationDetail: InvestigationDetail | null = null;
    if (incidentDetail.incident.status !== "draft") {
      investigationDetail = await getInvestigation(params.id).catch(() => null);
      setInvestigation(investigationDetail);
    } else {
      setInvestigation(null);
    }

    const investigationCompleted =
      investigationDetail?.investigation.status === "completed";
    if (
      (verification || investigationCompleted) &&
      incidentDetail.incident.status !== "closed" &&
      incidentDetail.incident.status !== "verified"
    ) {
      incidentDetail.incident.status = "verified";
    }

    setDetail(incidentDetail);
  }, [params.id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load incident"));
  }, [load]);

  async function handleSubmit() {
    try {
      await submitIncident(params.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submit failed");
    }
  }

  async function handleEvidenceUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      await uploadIncidentEvidence(params.id, file);
      await load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    }
  }

  if (error) {
    return <div className="p-8 text-sm text-destructive" role="alert">{error}</div>;
  }

  if (!detail) {
    return <p className="p-8 text-sm text-muted-foreground">Loading incident…</p>;
  }

  const { incident } = detail;
  const investigationCompleted = investigation?.investigation.status === "completed";
  const showInvestigation =
    incident.status !== "draft" &&
    incident.status !== "verified" &&
    incident.status !== "closed";

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{incident.title}</h1>
            <IncidentStatusBadge status={incident.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {incident.reference} · {incident.incidentType.replace(/_/g, " ")}
          </p>
        </div>
        <Link href="/incidents">
          <Button variant="outline">Back to list</Button>
        </Link>
      </div>

      <section className="rounded-lg border border-border p-4 text-sm">
        <p>{incident.description}</p>
        <p className="mt-2 text-muted-foreground">
          Occurred {new Date(incident.occurredAt).toLocaleString()}
          {incident.locationDescription ? ` · ${incident.locationDescription}` : ""}
        </p>
      </section>

      {incident.status === "draft" ? (
        <Button onClick={handleSubmit}>Submit incident</Button>
      ) : null}

      {detail.severityLifecycle ? (
        <section className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="text-lg font-medium">Severity lifecycle (FR-INC-011)</h2>
          <p className="text-sm text-muted-foreground">
            Path: {detail.severityLifecycle.severityPath.replace(/_/g, " ")} · Status:{" "}
            {detail.severityLifecycle.lifecycleStatus.replace(/_/g, " ")}
          </p>
          {detail.severityLifecycle.lifecycleStatus === "awaiting_hod" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  try {
                    await continueNearMiss(incident.id, "HOD continue");
                    await load();
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : "Continue failed");
                  }
                }}
              >
                HOD Continue
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await stopNearMiss(incident.id, "HOD stop");
                    await load();
                  } catch (err) {
                    setError(err instanceof ApiError ? err.message : "Stop failed");
                  }
                }}
              >
                HOD Stop
              </Button>
            </div>
          ) : null}
          {detail.severityHistory && detail.severityHistory.length > 0 ? (
            <ul className="text-sm space-y-1">
              {detail.severityHistory.map((entry) => (
                <li key={entry.id}>
                  {entry.eventType.replace(/_/g, " ")} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-lg font-medium">Evidence</h2>
        {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
        <input type="file" onChange={handleEvidenceUpload} />
        {detail.evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence uploaded.</p>
        ) : (
          <ul className="text-sm">
            {detail.evidence.map((item) => (
              <li key={item.id}>
                {item.fileName} ({Math.round(item.fileSize / 1024)} KB)
              </li>
            ))}
          </ul>
        )}
      </section>

      {showInvestigation ? (
        <InvestigationWorkflow incidentId={incident.id} detail={investigation} onUpdated={load} />
      ) : null}

      <IncidentClosureWorkflow
        incidentId={incident.id}
        status={incident.status}
        hasVerification={hasVerification}
        investigationCompleted={investigationCompleted}
        onUpdated={load}
      />

      {history.length > 0 ? (
        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-lg font-medium">History</h2>
          <ul className="space-y-2 text-sm">
            {history.map((entry) => (
              <li key={entry.id}>
                {entry.eventType.replace(/_/g, " ")} · {new Date(entry.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
