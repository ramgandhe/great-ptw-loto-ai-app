export function permitReportCacheKey(permit: {
  id: string;
  status: string;
  updatedAt: string;
  permitVersion?: number | null;
}): string {
  return `${permit.id}:${permit.status}:${permit.updatedAt}:${permit.permitVersion ?? 1}`;
}

/** Reuse the bytes already previewed. A changed permit, or a request still in flight, does not start another download. */
export function permitReportOpenPlan(input: {
  currentKey: string | null;
  hasFile: boolean;
  nextKey: string;
  busy: boolean;
}): "reuse" | "wait" | "fetch" {
  if (input.hasFile && input.currentKey === input.nextKey) return "reuse";
  if (input.busy) return "wait";
  return "fetch";
}

export function permitReportDialogState(input: {
  loading: boolean;
  error: string | null;
  previewUrl: string | null;
}): "preparing" | "error" | "ready" | "empty" {
  if (input.previewUrl) return "ready";
  if (input.loading) return "preparing";
  if (input.error) return "error";
  return "empty";
}

export function canDownloadPermitReport(input: { loading: boolean; previewUrl: string | null }): boolean {
  return !input.loading && Boolean(input.previewUrl);
}
