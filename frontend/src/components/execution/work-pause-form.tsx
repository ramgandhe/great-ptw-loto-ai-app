"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WorkCycleSnapshot } from "@/lib/execution/types";

type WorkPauseFormProps = {
  work: WorkCycleSnapshot;
  disabled?: boolean;
  isSubmitting?: boolean;
  onSubmit: (payload: {
    summary: string;
    checklist: Record<string, boolean>;
    notes?: string;
    overnightRestoreChosen?: boolean;
    lototoRemovals?: string[];
    lateReason?: string;
  }) => Promise<void>;
};

export function WorkPauseForm({ work, disabled, isSubmitting, onSubmit }: WorkPauseFormProps) {
  const items = work.pauseTemplate.items;
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [overnightRestoreChosen, setOvernightRestoreChosen] = useState(false);
  const [lototoRemovals, setLototoRemovals] = useState<string[]>([]);
  const [lateReason, setLateReason] = useState("");
  const overnightItems = work.lototoOvernightItems ?? [];
  const missingDates = work.missingPriorSecureDates ?? [];

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of items) {
      next[item.key] = false;
    }
    setChecks(next);
  }, [items]);

  const allRequired = items.every((item) => !item.required || checks[item.key] === true);
  const restoreAllowed = work.overnightIsolationPolicy === "restore_allowed";

  return (
    <form
      className="grid gap-3 rounded-lg border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!summary.trim() || !allRequired || disabled || isSubmitting) return;
        if (missingDates.length > 0 && lateReason.trim().length < 3) return;
        void onSubmit({
          summary: summary.trim(),
          checklist: checks,
          notes: notes.trim() || undefined,
          overnightRestoreChosen: restoreAllowed ? overnightRestoreChosen : false,
          lototoRemovals: lototoRemovals.length > 0 ? lototoRemovals : undefined,
          lateReason: missingDates.length > 0 ? lateReason.trim() : undefined,
        });
      }}
    >
      <h2 className="text-sm font-semibold">Pause work</h2>
      <p className="text-xs text-muted-foreground">
        Full leave-safe package (not shift handover). Work stays on this permit; resume before progress or complete.
      </p>
      {missingDates.length > 0 ? (
        <p className="text-sm text-destructive" role="alert">
          Missed leave-safe for {missingDates.join(", ")}. This pause records a late secure for those days. A reason is required.
        </p>
      ) : null}
      <textarea
        value={summary}
        required
        disabled={disabled || isSubmitting}
        onChange={(event) => setSummary(event.target.value)}
        placeholder="Period summary (what was done, what remains)"
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
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
      {overnightItems.length > 0 ? (
        <div className="grid gap-2 rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            LOTOTO overnight — mark only if a lock/point will be removed
          </p>
          {overnightItems.map((item) => {
            const checked = lototoRemovals.includes(item.id);
            return (
              <label key={item.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled || isSubmitting}
                  checked={checked}
                  onChange={(event) => {
                    setLototoRemovals((current) =>
                      event.target.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id),
                    );
                  }}
                />
                <span>
                  {item.label}
                  <span className="ml-1 text-xs text-muted-foreground">({item.kind.replace("_", " ")})</span>
                </span>
              </label>
            );
          })}
          {lototoRemovals.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Marked removals require full LOTOTO re-isolation before resume.
            </p>
          ) : null}
        </div>
      ) : work.lototoRequired ? (
        <p className="text-xs text-muted-foreground">No open personal locks recorded for overnight snapshot.</p>
      ) : null}
      {restoreAllowed ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            disabled={disabled || isSubmitting}
            checked={overnightRestoreChosen}
            onChange={(event) => setOvernightRestoreChosen(event.target.checked)}
          />
          Restore energy overnight (requires full LOTOTO re-isolation before resume)
        </label>
      ) : (
        <p className="text-xs text-muted-foreground">
          Overnight isolations stay on (organisation policy: hold).
        </p>
      )}
      <textarea
        value={notes}
        disabled={disabled || isSubmitting}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Optional notes"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {missingDates.length > 0 ? (
        <textarea
          value={lateReason}
          required
          disabled={disabled || isSubmitting}
          onChange={(event) => setLateReason(event.target.value)}
          placeholder="Why the previous day was not paused (required)"
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      ) : null}
      <Button
        type="submit"
        disabled={
          disabled ||
          isSubmitting ||
          !summary.trim() ||
          !allRequired ||
          (missingDates.length > 0 && lateReason.trim().length < 3)
        }
      >
        {isSubmitting ? "Pausing..." : "Pause work"}
      </Button>
    </form>
  );
}
