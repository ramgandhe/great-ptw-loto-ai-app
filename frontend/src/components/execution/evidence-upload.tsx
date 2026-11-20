"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUploadField } from "@/components/ui/file-upload-field";

type EvidenceUploadProps = {
  disabled?: boolean;
  isUploading?: boolean;
  error?: string | null;
  onUpload: (file: File, comment: string) => Promise<boolean | void> | void;
};

export function EvidenceUpload({
  disabled = false,
  isUploading = false,
  error,
  onUpload,
}: EvidenceUploadProps) {
  const [comment, setComment] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    if (file) {
      setValidationError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isUploading || disabled) return;

    if (!selectedFile) {
      setValidationError("File is required.");
      return;
    }

    setValidationError(null);
    try {
      const result = await onUpload(selectedFile, comment);
      // If result is explicitly false, do not clear
      if (result !== false) {
        setSelectedFile(null);
        setComment("");
      }
    } catch {
      // If upload threw, do not clear file state
    }
  }

  const displayedError = validationError || error;

  return (
    <form className="grid gap-4 rounded-lg border border-border bg-card p-4" onSubmit={handleSubmit}>
      <FileUploadField
        id="evidence-file"
        label="Evidence file"
        hint="Photos or PDF documents"
        accept="image/*,application/pdf"
        disabled={disabled || isUploading}
        value={selectedFile}
        onChange={handleFileChange}
      />

      <div>
        <label htmlFor="evidence-comment" className="text-sm font-medium">
          Comment (optional)
        </label>
        <textarea
          id="evidence-comment"
          value={comment}
          disabled={disabled || isUploading}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {displayedError ? (
        <p role="alert" className="text-sm text-destructive">
          {displayedError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled || isUploading}>
          {isUploading ? "Uploading…" : "Upload evidence"}
        </Button>
      </div>
    </form>
  );
}
