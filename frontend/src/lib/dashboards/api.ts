import { fetchApi } from "@/lib/api";
import type { InsightsPayload, ReportView, ReportViewType } from "./types";

type PlaceQuery = { siteId?: string; workLocationId?: string };

function placeParams(days: number, place?: PlaceQuery) {
  const params = new URLSearchParams({ days: String(days) });
  if (place?.siteId) params.set("siteId", place.siteId);
  if (place?.workLocationId) params.set("workLocationId", place.workLocationId);
  return params.toString();
}

export function getInsights(days = 90, place?: PlaceQuery) {
  return fetchApi<InsightsPayload>(`/analytics/insights?${placeParams(days, place)}`);
}

export function getReportView<T>(type: ReportViewType, days = 90, place?: PlaceQuery) {
  return fetchApi<ReportView<T>>(`/reports/view?type=${type}&${placeParams(days, place)}`);
}
