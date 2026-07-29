"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

type ClosureDialogProps = {
  open: boolean;
  comment: string;
  isSubmitting?: boolean;
  error?: string | null;
  onCommentChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function ClosureDialog({
  open,
  comment,
  isSubmitting = false,
  error,
  onCommentChange,
  onConfirm,
  onClose,
}: ClosureDialogProps) {
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
          if (!isSubmitting) {
            onConfirm();
          }
        }}
      >
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            Close permit
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm closure to archive this permit. Closed permits become read-only.
          </p>
        </div>

        <div>
          <label htmlFor="closure-comment" className="text-sm font-medium">
            Closure comment (optional)
          </label>
          <textarea
            id="closure-comment"
            value={comment}
            disabled={isSubmitting}
            onChange={(event) => onCommentChange(event.target.value)}
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Closing..." : "Close permit"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
