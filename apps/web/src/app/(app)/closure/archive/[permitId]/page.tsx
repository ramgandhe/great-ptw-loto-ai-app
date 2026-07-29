"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getArchivedPermit, getPermitAudit, getPermitHistory } from "@/lib/closure/api";
import type { ArchivedPermitDetail, AuditLogEntry, PermitHistoryEntry } from "@/lib/closure/types";
import { listEvidence, listProgress } from "@/lib/execution/api";
import type { EvidenceRecord, ProgressRecord } from "@/lib/execution/types";
import { AuditTimeline } from "@/components/closure/audit-timeline";
import { downloadJsonExport, ExportDialog } from "@/components/closure/export-dialog";
import { HistoryTimeline } from "@/components/closure/history-timeline";
import { ReadonlyPermitViewer } from "@/components/closure/readonly-permit-viewer";
import { ProgressFeed } from "@/components/execution/progress-feed";
import { Button } from "@/components/ui/button";

export default function HistoricalPermitPage() {
  const params = useParams<{ permitId: string }>();
  const [detail, setDetail] = useState<ArchivedPermitDetail | null>(null);
  const [history, setHistory] = useState<PermitHistoryEntry[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getArchivedPermit(params.permitId),
      getPermitHistory(params.permitId).catch(() => []),
      getPermitAudit(params.permitId).catch(() => []),
      listProgress(params.permitId).catch(() => []),
      listEvidence(params.permitId).catch(() => []),
    ])
      .then(([archived, historyItems, auditItems, progressItems, evidenceItems]) => {
        setDetail(archived);
        setHistory(historyItems);
        setAudit(auditItems);
        setProgress(progressItems);
        setEvidence(evidenceItems);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load archived permit");
      });
  }, [params.permitId]);

  function handleExport() {
    if (!detail) {
      return;
    }
    try {
      downloadJsonExport(`${detail.permit.reference ?? detail.permit.id}-history.json`, {
        permit: detail,
        history,
        audit,
        progress,
        evidence,
        exportedAt: new Date().toISOString(),
      });
      setExportOpen(false);
      setExportError(null);
    } catch {
      setExportError("Export failed");
    }
  }

  if (error) {
    return (
      <div className="p-8 text-sm text-destructive" role="alert">
        {error}
      </div>
    );
  }

  if (!detail) {
    return <p className="p-8 text-sm text-muted-foreground">Loading archived permit...</p>;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Historical permit</h1>
          <p className="text-sm text-muted-foreground">Read-only archived record</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExportOpen(true)}>
            Export history
          </Button>
          <Link href="/closure/archive">
            <Button variant="ghost">Back to archive</Button>
          </Link>
        </div>
      </div>

      <ReadonlyPermitViewer
        detail={detail}
        verification={detail.verification}
        closure={detail.closure}
      />

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Execution progress</h2>
        <ProgressFeed items={progress.slice().reverse()} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Evidence ({evidence.length})</h2>
        {evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence attached.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {evidence.map((item) => (
              <li key={item.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                {item.fileName}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Lifecycle history</h2>
        <HistoryTimeline entries={history} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Audit log</h2>
        <AuditTimeline entries={audit} />
      </section>

      <ExportDialog
        open={exportOpen}
        filename={`${detail.permit.reference ?? detail.permit.id}-history.json`}
        error={exportError}
        onConfirm={handleExport}
        onClose={() => {
          setExportOpen(false);
          setExportError(null);
        }}
      />
    </main>
  );
}
