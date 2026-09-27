import { fetchApi } from "@/lib/api";
import type { InsightsPayload, ReportView, ReportViewType } from "./types";

export function getInsights(days = 90) {
  return fetchApi<InsightsPayload>(`/analytics/insights?days=${days}`);
}

export function getReportView<T>(type: ReportViewType, days = 90) {
  return fetchApi<ReportView<T>>(`/reports/view?type=${type}&days=${days}`);
}
