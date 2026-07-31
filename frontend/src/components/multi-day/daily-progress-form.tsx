"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { recordDailyProgress } from "@/lib/multi-day/api";
import { Button } from "@/components/ui/button";

type DailyProgressFormProps = {
  permitId: string;
  onSaved: () => void;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function DailyProgressForm({ permitId, onSaved }: DailyProgressFormProps) {
  const [operationalDate, setOperationalDate] = useState(todayIsoDate());
  const [completedWork, setCompletedWork] = useState("");
  const [pendingWork, setPendingWork] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await recordDailyProgress(permitId, {
        operationalDate,
        completedWork: completedWork.trim(),
        pendingWork: pendingWork.trim() || undefined,
        summary: summary.trim(),
        submit: true,
      });
      setCompletedWork("");
      setPendingWork("");
      setSummary("");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record daily progress");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-lg font-medium">Record daily progress</h2>
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <label className="block text-sm">
        Operational date
        <input
          type="date"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={operationalDate}
          onChange={(event) => setOperationalDate(event.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        Work completed
        <textarea
          className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={completedWork}
          onChange={(event) => setCompletedWork(event.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        Outstanding work
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={pendingWork}
          onChange={(event) => setPendingWork(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        Daily summary
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          required
        />
      </label>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Submit daily progress"}
      </Button>
    </form>
  );
}
