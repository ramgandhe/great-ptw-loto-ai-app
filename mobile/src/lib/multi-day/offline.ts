import { enqueueSyncItem } from "@/lib/offline/queue";
import type {
  CreateShiftHandoverPayload,
  RecordDailyProgressPayload,
  RequestExtensionPayload,
  RevalidatePermitPayload,
} from "./types";

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

export async function queueOfflineRenewalCreate(permitId: string): Promise<void> {
  await enqueueSyncItem({
    entityType: "mdp_renewal",
    method: "POST",
    path: `/permits/${permitId}/renewals`,
    payload: {},
  });
}
