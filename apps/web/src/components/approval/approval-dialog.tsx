"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CommentPanel } from "./comment-panel";

type ApprovalDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  comment: string;
  commentRequired?: boolean;
  commentLabel?: string;
  isSubmitting?: boolean;
  error?: string | null;
  onCommentChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function ApprovalDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = "default",
  comment,
  commentRequired = false,
  commentLabel,
  isSubmitting = false,
  error,
  onCommentChange,
  onConfirm,
  onClose,
}: ApprovalDialogProps) {
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

  const canConfirm = !commentRequired || comment.trim().length > 0;

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
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <CommentPanel
          label={commentLabel ?? "Comment"}
          value={comment}
          required={commentRequired}
          onChange={onCommentChange}
        />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={confirmVariant}
            disabled={!canConfirm || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
