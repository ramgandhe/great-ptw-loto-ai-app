"use client";

import { useState } from "react";
import type { EvidenceRecord } from "@/lib/execution/types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";

type EvidencePreviewListProps = {
  evidence: EvidenceRecord[];
  onOpen: (evidenceId: string) => Promise<void> | void;
  openingId?: string | null;
};

export function EvidencePreviewList({ evidence, onOpen, openingId }: EvidencePreviewListProps) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        No evidence photos or documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {evidence.map((item) => {
        const isImage = item.contentType?.startsWith("image/");
        const isBusy = openingId === item.id;

        return (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm shadow-sm transition-colors hover:border-border/80"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {isImage ? <ImageIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground text-xs sm:text-sm" title={item.fileName}>
                  {item.fileName}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {Math.max(1, Math.round(item.fileSize / 1024))} KB · {formatDateTime(item.createdAt)}
                </p>
                {item.comment ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {item.comment}
                  </p>
                ) : null}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 text-xs h-8 px-2.5"
              disabled={isBusy}
              onClick={() => void onOpen(item.id)}
            >
              {isBusy ? (
                "Opening…"
              ) : isImage ? (
                <>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Preview
                </>
              ) : (
                <>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Open
                </>
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
