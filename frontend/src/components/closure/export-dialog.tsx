"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

type ExportDialogProps = {
  open: boolean;
  filename: string;
  isExporting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function ExportDialog({
  open,
  filename,
  isExporting = false,
  error,
  onConfirm,
  onClose,
}: ExportDialogProps) {
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
      <div className="flex flex-col gap-4 p-6">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            Export permit history
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Download a JSON export of the complete permit history and audit log.
          </p>
        </div>
        <p className="text-sm">
          File: <span className="font-mono">{filename}</span>
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Download export"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export function downloadJsonExport(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
