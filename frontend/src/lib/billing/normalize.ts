import type { CurrentSubscriptionApiResponse, TenantSubscription } from "./types";

export function normalizeCurrentSubscription(
  data: CurrentSubscriptionApiResponse,
): TenantSubscription | null {
  if ("subscription" in data && data.subscription === null) {
    return null;
  }

  if ("id" in data && data.plan) {
    return data as TenantSubscription;
  }

  return null;
}
