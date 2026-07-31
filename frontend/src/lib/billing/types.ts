export type BillingInterval = "monthly" | "yearly";

export type SubscriptionPlanStatus = "active" | "retired";

export type TenantSubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "suspended";

export type BillingInvoiceStatus = "draft" | "issued" | "paid" | "void";

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  billingInterval: BillingInterval;
  priceMinor: number;
  currency: string;
  enabledModules: string[];
  usageLimits: Record<string, unknown>;
  status: SubscriptionPlanStatus;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: TenantSubscriptionStatus;
  periodStart: string;
  periodEnd: string;
  renewAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: SubscriptionPlan;
}

export type CurrentSubscriptionApiResponse =
  | { subscription: null; plan: null }
  | (Omit<TenantSubscription, "plan"> & { plan: SubscriptionPlan });

export interface UsageRecord {
  id: string;
  tenantId: string;
  metricKey: string;
  quantity: number;
  periodLabel: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingInvoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  status: BillingInvoiceStatus;
  periodStart: string;
  periodEnd: string;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanChangeRecord {
  id: string;
  tenantId: string;
  subscriptionId: string;
  fromPlanId: string | null;
  toPlanId: string;
  changedBy: string;
  reason: string | null;
  changedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionPayload {
  planId: string;
  status?: "trial" | "active";
}

export interface ChangePlanPayload {
  planId: string;
  reason?: string;
}

export interface RecordUsagePayload {
  metricKey: string;
  quantity: number;
  periodLabel: string;
}

export type InvoiceStatusFilter = BillingInvoiceStatus | "all";
