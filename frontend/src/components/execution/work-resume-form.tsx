"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WorkCycleSnapshot } from "@/lib/execution/types";

type WorkResumeFormProps = {
  work: WorkCycleSnapshot;
  disabled?: boolean;
  isSubmitting?: boolean;
  onSubmit: (payload: {
    checklist: Record<string, boolean>;
    notes?: string;
    crew?: Array<{ workforceUserId: string; role: "primary" | "substitute" }>;
  }) => Promise<void>;
};

export function WorkResumeForm({ work, disabled, isSubmitting, onSubmit }: WorkResumeFormProps) {
  const items = work.resumeTemplate.items;
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [crewUserIds, setCrewUserIds] = useState("");
  const crewRequired = work.crewRosterRequired === true;
  const suggested = work.suggestedCrew ?? [];
  const handoverBlocked = work.handoverRequired === true && work.handoverAccepted !== true;

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of items) {
      next[item.key] = false;
    }
    setChecks(next);
  }, [items]);

  const allRequired = items.every((item) => !item.required || checks[item.key] === true);
  const crewIds = crewUserIds
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  const crewReady = !crewRequired || crewIds.length > 0;

  return (
    <form
      className="grid gap-3 rounded-lg border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!allRequired || !crewReady || handoverBlocked || disabled || isSubmitting) return;
        const suggestionById = new Map(suggested.map((row) => [row.workforceUserId, row.role]));
        void onSubmit({
          checklist: checks,
          notes: notes.trim() || undefined,
          crew: crewRequired
            ? crewIds.map((workforceUserId) => ({
                workforceUserId,
                role: suggestionById.get(workforceUserId) ?? "primary",
              }))
            : undefined,
        });
      }}
    >
      <h2 className="text-sm font-semibold">{work.resumeTemplate.title}</h2>
      <p className="text-xs text-muted-foreground">
        {work.resumeTemplate.mode === "minimal"
          ? "Minimal resume confirmation (daily audit off)."
          : "Resume clearance before continuing work."}
        {work.resumeTemplate.reisolateRequired
          ? " Complete full LOTOTO re-isolation on this permit first, then confirm below."
          : null}
      </p>
      {work.resumeTemplate.simopsBlocked ? (
        <p className="text-sm text-destructive" role="alert">
          {work.resumeTemplate.simopsBlockReason ||
            "Resolve blocking SIMOPS before resume."}
        </p>
      ) : null}
      {work.openPause?.summary ? (
        <p className="text-sm text-muted-foreground">
          Last pause: {work.openPause.summary}
        </p>
      ) : null}
      {handoverBlocked ? (
        <p className="text-sm text-destructive" role="alert">
          You did not pause this job. Resume stays blocked until the person who paused hands it to you and you accept that handover below.
        </p>
      ) : null}
      {items.map((item) => (
        <label key={item.key} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            disabled={disabled || isSubmitting}
            checked={checks[item.key] === true}
            onChange={(event) =>
              setChecks((current) => ({ ...current, [item.key]: event.target.checked }))
            }
          />
          {item.label}
        </label>
      ))}
      {crewRequired ? (
        <div className="grid gap-2">
          <label className="block text-sm">
            Today’s crew (workforce user IDs, comma-separated)
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={crewUserIds}
              disabled={disabled || isSubmitting}
              onChange={(event) => setCrewUserIds(event.target.value)}
            />
          </label>
          {suggested.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || isSubmitting}
              onClick={() => setCrewUserIds(suggested.map((row) => row.workforceUserId).join(", "))}
            >
              Use permit executors
            </Button>
          ) : null}
        </div>
      ) : null}
      <textarea
        value={notes}
        disabled={disabled || isSubmitting}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Optional notes"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Button
        type="submit"
        disabled={
          disabled || isSubmitting || handoverBlocked || !allRequired || !crewReady || work.resumeTemplate.simopsBlocked === true
        }
      >
        {isSubmitting ? "Resuming..." : "Resume work"}
      </Button>
    </form>
  );
}
