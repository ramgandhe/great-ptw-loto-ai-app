"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { createHandover } from "@/lib/multi-day/api";
import type { DailyProgressRecord } from "@/lib/multi-day/types";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { Button } from "@/components/ui/button";

type HandoverFormProps = {
  permitId: string;
  progressRecords: DailyProgressRecord[];
  onSaved: () => void;
};

export function HandoverForm({ permitId, progressRecords, onSaved }: HandoverFormProps) {
  const [directory, setDirectory] = useState<WorkforceRecord[]>([]);
  const [incomingUserId, setIncomingUserId] = useState("");
  const [dailyProgressId, setDailyProgressId] = useState("");
  const [completedActivities, setCompletedActivities] = useState("");
  const [outstandingWork, setOutstandingWork] = useState("");
  const [safetyObservations, setSafetyObservations] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listWorkforceDirectory()
      .then(setDirectory)
      .catch(() => setDirectory([]));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await createHandover(permitId, {
        incomingUserId,
        completedActivities: completedActivities.trim(),
        outstandingWork: outstandingWork.trim(),
        safetyObservations: safetyObservations.trim() || undefined,
        dailyProgressId: dailyProgressId || undefined,
      });
      setCompletedActivities("");
      setOutstandingWork("");
      setSafetyObservations("");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete handover");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-lg font-medium">Shift handover</h2>
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <label className="block text-sm">
        Incoming personnel
        <select
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={incomingUserId}
          onChange={(event) => setIncomingUserId(event.target.value)}
          required
        >
          <option value="">Select person</option>
          {directory.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      {progressRecords.length > 0 ? (
        <label className="block text-sm">
          Link to daily progress (optional)
          <select
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
          </select>
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
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Complete handover"}
      </Button>
    </form>
  );
}
