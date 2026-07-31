"use client";

import { useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type FileUploadFieldProps = {
  id?: string;
  accept?: string;
  disabled?: boolean;
  label?: string;
  hint?: string;
  value?: File | null;
  onChange: (file: File | null) => void;
  className?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadField({
  id = "file-upload",
  accept = "image/*,application/pdf",
  disabled = false,
  label = "Upload file",
  hint = "Images or PDF up to 10 MB",
  value = null,
  onChange,
  className,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0] ?? null;
    onChange(file);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <span className="text-sm font-medium">{label}</span>
      <div
        className={cn(
          "relative rounded-lg border border-dashed p-4 transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/30",
          disabled && "cursor-not-allowed opacity-60",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) {
            handleFiles(event.dataTransfer.files);
          }
        }}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => handleFiles(event.target.files)}
        />

        {value ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{value.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(value.size)}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onChange(null);
                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
              aria-label="Remove selected file"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
              <FileUp className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-foreground">Drag and drop a file here</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
