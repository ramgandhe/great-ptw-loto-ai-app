"use client";
import { AppSelect } from "@/components/ui/select";

import { VerificationEvidenceCapture } from "@/components/common/verification-evidence-capture";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { createHandover } from "@/lib/multi-day/api";
import { uploadEvidence } from "@/lib/execution/api";
import type { DailyProgressRecord } from "@/lib/multi-day/types";
import { listTenantUserNames } from "@/lib/workforce/api";
import type { TenantUser } from "@/lib/workforce/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type HandoverFormProps = {
  permitId: string;
  progressRecords: DailyProgressRecord[];
  onSaved: () => void;
  executorIds: string[];
  currentUserId?: string;
  /** When true, omit the form’s own heading (parent section already titled). */
  hideTitle?: boolean;
};

export function HandoverForm({
  permitId,
  progressRecords,
  onSaved,
  executorIds,
  currentUserId,
  hideTitle = false,
}: HandoverFormProps) {
  const [directory, setDirectory] = useState<TenantUser[]>([]);
  const [incomingUserId, setIncomingUserId] = useState("");
  const [dailyProgressId, setDailyProgressId] = useState("");
  const [completedActivities, setCompletedActivities] = useState("");
  const [outstandingWork, setOutstandingWork] = useState("");
  const [safetyObservations, setSafetyObservations] = useState("");
  const [handoverEvidence, setHandoverEvidence] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const assigned = new Set(executorIds);
    listTenantUserNames()
      .then((rows) =>
        setDirectory(
          rows.filter(
            (person) => assigned.has(person.id) && person.id !== currentUserId && person.enabled !== false,
          ),
        ),
      )
      .catch(() => setDirectory([]));
  }, [currentUserId, executorIds]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      if (handoverEvidence) {
        await uploadEvidence(permitId, handoverEvidence, { comment: "Shift handover evidence" });
      }
      await createHandover(permitId, {
        incomingUserId,
        completedActivities: completedActivities.trim(),
        outstandingWork: outstandingWork.trim(),
        safetyObservations: safetyObservations.trim() || undefined,
        dailyProgressId: dailyProgressId || undefined,
      });
      setHandoverEvidence(null);
      setIncomingUserId("");
      setCompletedActivities("");
      setOutstandingWork("");
      setSafetyObservations("");
      toast("Handover submitted for acceptance");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit handover");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      id="handover"
      onSubmit={handleSubmit}
      className="scroll-mt-24 space-y-3 rounded-lg border border-border p-4"
    >
      {hideTitle ? null : <h2 className="text-lg font-medium">Shift handover</h2>}
      <p className="text-sm text-muted-foreground">
        Submits for dual acceptance. Custody stays with you until the incoming party accepts.
      </p>
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <label className="block text-sm">
        Incoming personnel
        <AppSelect
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={incomingUserId}
          onChange={(event) => setIncomingUserId(event.target.value)}
          required
        >
          <option value="">Select person</option>
          {directory.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name || person.email || person.username}
            </option>
          ))}
        </AppSelect>
        {directory.length === 0 ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            No other active executor is assigned to this permit.
          </span>
        ) : null}
      </label>
      {progressRecords.length > 0 ? (
        <label className="block text-sm">
          Link to daily progress (optional)
          <AppSelect
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={dailyProgressId}
            onChange={(event) => setDailyProgressId(event.target.value)}
          >
            <option value="">None</option>
            {progressRecords.map((record) => (
              <option key={record.id} value={record.id}>
                {record.operationalDate} — {record.summary}
              </option>
            ))}
          </AppSelect>
        </label>
      ) : null}
      <label className="block text-sm">
        Completed activities
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={completedActivities}
          onChange={(event) => setCompletedActivities(event.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        Outstanding work
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={outstandingWork}
          onChange={(event) => setOutstandingWork(event.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        Safety observations
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={safetyObservations}
          onChange={(event) => setSafetyObservations(event.target.value)}
        />
      </label>
      <VerificationEvidenceCapture
        visible={true}
        label="Handover site/log evidence"
        file={handoverEvidence}
        onFileChange={setHandoverEvidence}
        disabled={isSubmitting}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Submit handover"}
      </Button>
    </form>
  );
}
