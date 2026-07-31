import { fetchApi } from "@/lib/api";
import { normalizeCurrentSubscription } from "./normalize";
import type {
  BillingInvoice,
  ChangePlanPayload,
  CreateSubscriptionPayload,
  CurrentSubscriptionApiResponse,
  InvoiceStatusFilter,
  PlanChangeRecord,
  RecordUsagePayload,
  SubscriptionPlan,
  TenantSubscription,
  UsageRecord,
} from "./types";

export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return fetchApi<SubscriptionPlan[]>("/subscriptions/plans");
}

export async function getCurrentSubscription(): Promise<TenantSubscription | null> {
  const data = await fetchApi<CurrentSubscriptionApiResponse>("/subscriptions/current");
  return normalizeCurrentSubscription(data);
}

export function createSubscription(payload: CreateSubscriptionPayload) {
  return fetchApi<TenantSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function changeSubscriptionPlan(payload: ChangePlanPayload) {
  return fetchApi<TenantSubscription>("/subscriptions/change-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listPlanChanges() {
  return fetchApi<PlanChangeRecord[]>("/subscriptions/plan-changes");
}

function buildInvoiceQuery(status?: InvoiceStatusFilter): string {
  if (!status || status === "all") {
    return "";
  }

  return `?status=${encodeURIComponent(status)}`;
}

export function listInvoices(status?: InvoiceStatusFilter) {
  return fetchApi<BillingInvoice[]>(`/billing/invoices${buildInvoiceQuery(status)}`);
}

export function listUsageRecords() {
  return fetchApi<UsageRecord[]>("/billing/usage");
}

export function recordUsage(payload: RecordUsagePayload) {
  return fetchApi<UsageRecord>("/billing/usage", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
