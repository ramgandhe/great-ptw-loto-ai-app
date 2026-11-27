"use client";

import { useState } from "react";
import { Camera, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VerificationEvidenceCaptureProps {
  visible: boolean;
  label?: string;
  hint?: string;
  file?: File | null;
  onFileChange: (file: File | null) => void;
  comment?: string;
  onCommentChange?: (comment: string) => void;
  showComment?: boolean;
  disabled?: boolean;
  className?: string;
}

export function VerificationEvidenceCapture({
  visible,
  label = "Attach verification evidence (photo, geo photo, or PDF)",
  hint = "Optional — photos, live/geo photos, or signed documents up to 10 MB",
  file = null,
  onFileChange,
  comment = "",
  onCommentChange,
  showComment = false,
  disabled = false,
  className,
}: VerificationEvidenceCaptureProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "mt-2.5 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3 text-sm transition-all",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 font-medium text-foreground text-xs text-muted-foreground uppercase tracking-wider mb-2">
        <Camera className="h-3.5 w-3.5" />
        <span>{label}</span>
        <span className="text-[10px] font-normal text-muted-foreground lowercase ml-1">(optional)</span>
      </div>

      {file ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{file.name}</span>
            <span className="text-muted-foreground shrink-0">
              ({(file.size / 1024).toFixed(0)} KB)
            </span>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onFileChange(null)}
            className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Remove evidence file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-input bg-background/50 px-3 py-2 text-center hover:bg-accent/40">
            <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" />
              Upload photo, live photo, or PDF document
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">{hint}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={disabled}
              className="sr-only"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                onFileChange(selected);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}

      {showComment && onCommentChange && (
        <div className="mt-2">
          <input
            type="text"
            disabled={disabled}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Evidence note or comment (optional)..."
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
    </div>
  );
}
