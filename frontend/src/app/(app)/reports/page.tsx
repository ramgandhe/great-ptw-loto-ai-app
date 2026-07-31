"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { generateReport, listReports } from "@/lib/dashboards/api";
import { REPORT_TYPE_LABELS } from "@/lib/dashboards/labels";
import type { GenerateReportPayload, ReportExport, ReportFormat, ReportType } from "@/lib/dashboards/types";
import { Button } from "@/components/ui/button";

const REPORT_TYPES: ReportType[] = ["operational_kpis", "permit_summary", "incident_summary"];
const FORMATS: ReportFormat[] = ["csv", "pdf", "xlsx"];

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportExport[]>([]);
  const [reportType, setReportType] = useState<ReportType>("operational_kpis");
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadReports = useCallback(() => {
    setIsLoading(true);
    setError(null);

    listReports()
      .then(setReports)
      .catch((err) => {
        setReports([]);
        setError(err instanceof ApiError ? err.message : "Failed to load reports");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    const payload: GenerateReportPayload = { reportType, format };

    try {
      const created = await generateReport(payload);
      setSuccess(`Report queued (${created.status}).`);
      loadReports();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Request operational exports and review generation status.
          </p>
        </div>
        <Link href="/">
          <Button type="button" variant="outline" size="sm">
            Back to dashboard
          </Button>
        </Link>
      </div>

      <form
        onSubmit={handleGenerate}
        className="grid max-w-xl gap-4 rounded-lg border border-border p-5"
      >
        <h2 className="text-sm font-semibold">Generate report</h2>

        <label className="flex flex-col gap-1 text-sm">
          Report type
          <select
            className="rounded-md border border-border bg-background px-3 py-2"
            value={reportType}
            onChange={(event) => setReportType(event.target.value as ReportType)}
          >
            {REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {REPORT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Format
          <select
            className="rounded-md border border-border bg-background px-3 py-2"
            value={format}
            onChange={(event) => setFormat(event.target.value as ReportFormat)}
          >
            {FORMATS.map((value) => (
              <option key={value} value={value}>
                {value.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" disabled={isGenerating}>
          {isGenerating ? "Generating…" : "Generate report"}
        </Button>
      </form>

      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {success ? <p className="text-sm text-muted-foreground">{success}</p> : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Your exports</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading reports…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports generated yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {REPORT_TYPE_LABELS[report.reportType] ?? report.reportType} ·{" "}
                    {report.format.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {report.status} · {new Date(report.createdAt).toLocaleString()}
                  </p>
                  {report.errorMessage ? (
                    <p className="text-xs text-destructive">{report.errorMessage}</p>
                  ) : null}
                </div>
                {report.fileName ? (
                  <span className="text-xs text-muted-foreground">{report.fileName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
