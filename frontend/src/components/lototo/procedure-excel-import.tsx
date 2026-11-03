"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api";
import {
  importLototoProcedure,
  type LototoImportFieldError,
  type LototoImportOverrideDetails,
} from "@/lib/lototo/api";

function formatErrors(errors: LototoImportFieldError[]) {
  return errors
    .map((item) => {
      const where = [item.sheet, item.row != null ? `row ${item.row}` : null, item.field]
        .filter(Boolean)
        .join(" · ");
      return `${where}: ${item.message}`;
    })
    .join("\n");
}

export function ProcedureExcelImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runImport(file: File) {
    setBusy(true);
    setError(null);
    try {
      let procedure;
      try {
        procedure = await importLototoProcedure(file);
      } catch (err) {
        if (!(err instanceof ApiError) || err.code !== "PROCEDURE_IMPORT_OVERRIDE_REQUIRED") {
          throw err;
        }
        const details = err.details as LototoImportOverrideDetails | undefined;
        const ok = await confirmAction(
          details
            ? `Procedure ${details.code} (${details.title}) already exists as ${details.status}${details.hasDraft ? " with a draft" : ""}. Replace the draft from this Excel file?`
            : "A procedure with this code already exists. Replace the draft from this Excel file?",
          { title: "Replace existing procedure draft?", confirmLabel: "Replace draft", intent: "warning" },
        );
        if (!ok) {
          setError("Import cancelled.");
          return;
        }
        procedure = await importLototoProcedure(file, { confirmOverride: true });
      }
      router.push(`/lototo/procedures/${procedure.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as { errors?: LototoImportFieldError[] } | LototoImportFieldError[] | undefined;
        const errors = Array.isArray(details) ? details : details?.errors;
        setError(errors?.length ? formatErrors(errors) : err.message);
      } else {
        setError("Import failed.");
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Import from Excel</p>
          <p className="text-sm text-muted-foreground">
            Upload one procedure workbook (.xlsx). It always lands as a draft for review.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void runImport(file);
            }}
          />
          <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden />
            {busy ? "Importing…" : "Upload Excel"}
          </Button>
        </div>
      </div>
      {error ? (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </pre>
      ) : null}
    </div>
  );
}
