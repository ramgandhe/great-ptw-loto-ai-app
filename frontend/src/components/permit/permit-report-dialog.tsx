"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { canDownloadPermitReport, permitReportDialogState } from "@/lib/permit/report-view";
import { Download } from "lucide-react";

type PermitReportDialogProps = {
  open: boolean;
  edition: string;
  fileName: string | null;
  previewUrl: string | null;
  loading: boolean;
  error: string | null;
  onDownload: () => void;
  onClose: () => void;
};

export function PermitReportDialog({
  open,
  edition,
  fileName,
  previewUrl,
  loading,
  error,
  onDownload,
  onClose,
}: PermitReportDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;

  const view = permitReportDialogState({ loading, error, previewUrl });

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed top-1/2 left-1/2 flex h-[min(90vh,52rem)] w-[min(96vw,64rem)] max-w-none -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-background p-0 shadow-lg backdrop:bg-black/50"
      onClose={onClose}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold">
            Permit report
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {edition}
            {fileName ? ` · ${fileName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onDownload} disabled={!canDownloadPermitReport({ loading, previewUrl })}>
            <Download aria-hidden />
            Download PDF
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-muted">
        {view === "preparing" ? <p className="p-6 text-sm text-muted-foreground">Preparing the permit report…</p> : null}
        {view === "error" ? (
          <p role="alert" className="p-6 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {view === "ready" && previewUrl ? (
          <iframe title="Permit report preview" src={previewUrl} className="h-full w-full bg-background" />
        ) : null}
      </div>
    </dialog>
  );
}

export function downloadPermitReport(previewUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = previewUrl;
  link.download = fileName;
  link.click();
}
