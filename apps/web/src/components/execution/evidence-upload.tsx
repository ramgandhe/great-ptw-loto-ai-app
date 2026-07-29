"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type EvidenceUploadProps = {
  disabled?: boolean;
  isUploading?: boolean;
  error?: string | null;
  onUpload: (file: File, comment: string) => void;
};

export function EvidenceUpload({
  disabled = false,
  isUploading = false,
  error,
  onUpload,
}: EvidenceUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [comment, setComment] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (selectedFile && !isUploading) {
      onUpload(selectedFile, comment);
      setSelectedFile(null);
      setComment("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <form className="grid gap-3 rounded-lg border border-border p-4" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="evidence-file" className="text-sm font-medium">
          Evidence file
        </label>
        <input
          ref={inputRef}
          id="evidence-file"
          type="file"
          accept="image/*,application/pdf"
          disabled={disabled || isUploading}
          onChange={handleFileChange}
          className="mt-1 block w-full text-sm"
        />
      </div>
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
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={disabled || isUploading || !selectedFile}>
          {isUploading ? "Uploading..." : "Upload evidence"}
        </Button>
      </div>
    </form>
  );
}
