"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

type SuspensionDialogProps = {
  open: boolean;
  reason: string;
  isSubmitting?: boolean;
  error?: string | null;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function SuspensionDialog({
  open,
  reason,
  isSubmitting = false,
  error,
  onReasonChange,
  onConfirm,
  onClose,
}: SuspensionDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const canConfirm = reason.trim().length > 0;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-0 shadow-lg backdrop:bg-black/50"
      onClose={onClose}
    >
      <form
        className="flex flex-col gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (canConfirm && !isSubmitting) {
            onConfirm();
          }
        }}
      >
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            Suspend work
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Provide a reason for suspending this permit. Supervisors will be notified.
          </p>
        </div>

        <div>
          <label htmlFor="suspension-reason" className="text-sm font-medium">
            Suspension reason
          </label>
          <textarea
            id="suspension-reason"
            value={reason}
            required
            disabled={isSubmitting}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" disabled={!canConfirm || isSubmitting}>
            {isSubmitting ? "Suspending..." : "Suspend work"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
