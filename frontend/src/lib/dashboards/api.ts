import { fetchApi } from "@/lib/api";
import type {
  AnalyticsPayload,
  AnalyticsScope,
  AnalyticsTrendsPayload,
  DashboardKind,
  DashboardPayload,
  GenerateReportPayload,
  KpiBundle,
  ReportExport,
} from "./types";

export function getDashboard(kind?: DashboardKind) {
  const query = kind ? `?kind=${kind}` : "";
  return fetchApi<DashboardPayload>(`/dashboard${query}`);
}

export function getDashboardKpis(kind?: DashboardKind, periodLabel = "current") {
  const search = new URLSearchParams();
  if (kind) {
    search.set("kind", kind);
  }
  if (periodLabel) {
    search.set("periodLabel", periodLabel);
  }
  const query = search.toString();
  return fetchApi<KpiBundle>(`/dashboard/kpis${query ? `?${query}` : ""}`);
}

export function getAnalytics(
  scope?: AnalyticsScope,
  filters?: { status?: string; plantId?: string; periodStart?: string; periodEnd?: string },
) {
  const search = new URLSearchParams();
  if (scope) {
    search.set("scope", scope);
  }
  if (filters?.status) search.set("status", filters.status);
  if (filters?.plantId) search.set("plantId", filters.plantId);
  if (filters?.periodStart) search.set("periodStart", filters.periodStart);
  if (filters?.periodEnd) search.set("periodEnd", filters.periodEnd);
  const query = search.toString();
  return fetchApi<AnalyticsPayload>(`/analytics${query ? `?${query}` : ""}`);
}

export function getAnalyticsTrends(scope?: AnalyticsScope, limit = 14) {
  const search = new URLSearchParams();
  if (scope) {
    search.set("scope", scope);
  }
  search.set("limit", String(limit));
  return fetchApi<AnalyticsTrendsPayload>(`/analytics/trends?${search.toString()}`);
}

export function listReports(status?: string) {
  const query = status ? `?status=${status}` : "";
  return fetchApi<ReportExport[]>(`/reports${query}`);
}

export function generateReport(payload: GenerateReportPayload) {
  return fetchApi<ReportExport>("/reports/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
