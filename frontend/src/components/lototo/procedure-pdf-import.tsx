"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api";
import {
  cancelLototoPdfImport,
  confirmLototoPdfImport,
  getLototoPdfImportJob,
  startLototoPdfImport,
  type LototoPdfImportJob,
} from "@/lib/lototo/api";

const STAGE_LABEL: Record<string, string> = {
  queued: "Uploading",
  extracting: "Extracting document",
  interpreting: "Interpreting procedures",
  creating_draft: "Creating draft",
  awaiting_override: "Waiting for confirmation",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

function warningText(warnings: unknown) {
  if (!Array.isArray(warnings)) return "";
  return warnings
    .map((item) => {
      if (item && typeof item === "object" && "message" in item) return String((item as { message?: string }).message ?? "");
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function ProcedurePdfImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  async function poll(jobId: string): Promise<LototoPdfImportJob> {
    for (;;) {
      const job = await getLototoPdfImportJob(jobId);
      setStage(STAGE_LABEL[job.status] ?? job.status);
      if (job.status === "awaiting_override") return job;
      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") return job;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  async function runImport(file: File) {
    setBusy(true);
    setError(null);
    setStage("Uploading");
    try {
      const started = await startLototoPdfImport(file);
      setJobId(started.jobId);
      let job = await poll(started.jobId);
      if (job.status === "awaiting_override") {
        const detail = Array.isArray(job.warnings) ? (job.warnings[0] as { code?: string; title?: string; status?: string; hasDraft?: boolean }) : undefined;
        const ok = await confirmAction(
          detail?.code
            ? `Procedure ${detail.code} (${detail.title ?? ""}) already exists as ${detail.status}${detail.hasDraft ? " with a draft" : ""}. Replace the draft from this PDF?`
            : "A procedure with this code already exists. Replace the draft from this PDF?",
          { title: "Replace existing procedure draft?", confirmLabel: "Replace draft", intent: "warning" },
        );
        if (!ok) {
          await cancelLototoPdfImport(job.jobId);
          setError("Import cancelled.");
          setStage(null);
          return;
        }
        await confirmLototoPdfImport(job.jobId);
        job = await poll(job.jobId);
      }
      if (job.status === "completed" && job.procedureId) {
        const notes = warningText(job.warnings);
        if (notes) sessionStorage.setItem(`lototo-pdf-warnings:${job.procedureId}`, notes);
        router.push(`/lototo/procedures/${job.procedureId}`);
        return;
      }
      if (job.status === "cancelled") {
        setError("Import cancelled.");
        setStage(null);
        return;
      }
      setError(warningText(job.errors) || "PDF import failed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "PDF import failed.");
    } finally {
      setBusy(false);
      setJobId(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Import from PDF</p>
          <p className="text-sm text-muted-foreground">
            Upload one procedure PDF. It is read into a draft, then discarded.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void runImport(file);
            }}
          />
          <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            <FileText aria-hidden />
            {busy ? stage ?? "Importing…" : "Upload PDF"}
          </Button>
          {busy && jobId ? (
            <Button type="button" variant="outline" onClick={() => void cancelLototoPdfImport(jobId)}>
              Cancel import
            </Button>
          ) : null}
        </div>
      </div>
      {busy && stage ? <p className="mt-3 text-sm text-muted-foreground">{stage}</p> : null}
      {error ? (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </pre>
      ) : null}
    </div>
  );
}
