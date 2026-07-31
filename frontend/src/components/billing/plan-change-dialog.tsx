"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { SubscriptionPlan } from "@/lib/billing/types";

type PlanChangeDialogProps = {
  open: boolean;
  plan: SubscriptionPlan | null;
  isSubscribe: boolean;
  reason: string;
  isSubmitting?: boolean;
  error?: string | null;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function PlanChangeDialog({
  open,
  plan,
  isSubscribe,
  reason,
  isSubmitting = false,
  error,
  onReasonChange,
  onConfirm,
  onClose,
}: PlanChangeDialogProps) {
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

  if (!open || !plan) {
    return null;
  }

  const title = isSubscribe ? "Confirm subscription" : "Confirm plan change";
  const description = isSubscribe
    ? `Subscribe to ${plan.name}? Billing will start for this tenant.`
    : `Change to ${plan.name}? Your billing period will reset.`;

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
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        {!isSubscribe ? (
          <label className="flex flex-col gap-1 text-sm">
            Reason (optional)
            <textarea
              className="min-h-20 rounded-md border border-border bg-background px-3 py-2"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              maxLength={500}
            />
          </label>
        ) : null}

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
            {isSubmitting ? "Saving…" : "Confirm"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
