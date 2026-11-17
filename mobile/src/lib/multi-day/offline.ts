import { enqueueSyncItem } from "@/lib/offline/queue";
import type {
  CreateDaySecurePayload,
  CreateShiftHandoverPayload,
  DecideShiftHandoverPayload,
  RecordDailyProgressPayload,
  RequestExtensionPayload,
  RevalidatePermitPayload,
} from "./types";

/**
 * Slice J5: offline conflict rules for MDP sync.
 * - One secure / progress / reopen per permit+operationalDate; later queue loses to server 409.
 * - Handover accept/reject only while status is pending_acceptance; otherwise drop with conflict.
 * - Do not invent clear-for-work offline — reopen must sync before work continues.
 */
export const MDP_OFFLINE_CONFLICT_RULES = [
  "day_secure_unique_per_operational_date",
  "daily_progress_unique_per_operational_date",
  "reopen_today_bound",
  "handover_accept_requires_pending",
] as const;

export async function queueOfflineDailyProgress(
  permitId: string,
  payload: RecordDailyProgressPayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "mdp_daily_progress",
    method: "POST",
    path: `/permits/${permitId}/daily-progress`,
    payload,
  });
}

export async function queueOfflineHandover(
  permitId: string,
  payload: CreateShiftHandoverPayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "mdp_handover",
    method: "POST",
    path: `/permits/${permitId}/handover`,
    payload,
  });
}

export async function queueOfflineHandoverAccept(
  permitId: string,
  handoverId: string,
  payload: DecideShiftHandoverPayload = {},
): Promise<void> {
  await enqueueSyncItem({
    entityType: "mdp_handover_accept",
    method: "POST",
    path: `/permits/${permitId}/handovers/${handoverId}/accept`,
    payload,
  });
}

export async function queueOfflineHandoverReject(
  permitId: string,
  handoverId: string,
  payload: DecideShiftHandoverPayload = {},
): Promise<void> {
  await enqueueSyncItem({
    entityType: "mdp_handover_reject",
    method: "POST",
    path: `/permits/${permitId}/handovers/${handoverId}/reject`,
    payload,
  });
}

export async function queueOfflineRevalidation(
  permitId: string,
  payload: RevalidatePermitPayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "mdp_revalidation",
    method: "POST",
    path: `/permits/${permitId}/revalidate`,
    payload,
  });
}

/** Prefer reopen path (Slice C); revalidate remains for legacy queues. */
export async function queueOfflineReopen(
  permitId: string,
  payload: RevalidatePermitPayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "mdp_reopen",
    method: "POST",
    path: `/permits/${permitId}/reopen`,
    payload,
  });
}

export async function queueOfflineExtensionRequest(
  permitId: string,
  payload: RequestExtensionPayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "mdp_extension",
    method: "POST",
    path: `/permits/${permitId}/extensions`,
    payload,
  });
}

export async function queueOfflineDaySecure(
  permitId: string,
  payload: CreateDaySecurePayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "mdp_day_secure",
    method: "POST",
    path: `/permits/${permitId}/day-secures`,
    payload,
  });
}
