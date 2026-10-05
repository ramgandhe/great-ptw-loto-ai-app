/** Task views at the top of the permit list (?view=…). "Needs me" is the person's work queue. */
export const QUEUE_VIEWS = [
  { key: "needs-me", label: "Needs me", statuses: null },
  { key: "drafts", label: "Drafts", statuses: ["draft"] },
  { key: "review", label: "Awaiting review", statuses: ["pending_approval", "deferred", "rejected"] },
  { key: "live", label: "Live", statuses: ["approved", "active", "suspended"] },
  { key: "closing", label: "Closing", statuses: ["execution_completed", "pending_closure"] },
  { key: "finished", label: "Finished", statuses: ["closed", "cancelled", "expired"] },
  { key: "all", label: "All", statuses: null },
] as const satisfies readonly { key: string; label: string; statuses: readonly string[] | null }[];
export type QueueView = (typeof QUEUE_VIEWS)[number]["key"];

/** Older links: ?scope=mine and ?stage=… */
const LEGACY: Record<string, QueueView> = {
  draft: "drafts",
  review: "review",
  approved: "live",
  live: "live",
  closing: "closing",
  done: "finished",
};

/**
 * The view a link asks for. Without one, people with work waiting start on "Needs me", everyone
 * else on "All".
 */
export function queueViewFrom(params: URLSearchParams, needsMeCount: number): QueueView {
  const asked = params.get("view") ?? LEGACY[params.get("stage") ?? ""] ?? (params.get("scope") === "mine" ? "needs-me" : null);
  if (asked && QUEUE_VIEWS.some((view) => view.key === asked)) return asked as QueueView;
  return needsMeCount > 0 ? "needs-me" : "all";
}

/** Whether a permit belongs in a view; `needsMe` says whether it is in the person's work queue. */
export function inQueueView(view: QueueView, status: string, needsMe: boolean): boolean {
  if (view === "needs-me") return needsMe;
  const statuses = QUEUE_VIEWS.find((v) => v.key === view)?.statuses;
  return !statuses || (statuses as readonly string[]).includes(status);
}
