import type {
  BillingInvoiceStatus,
  BillingInterval,
  TenantSubscriptionStatus,
} from "./types";

export const SUBSCRIPTION_STATUS_LABELS: Record<TenantSubscriptionStatus, string> = {
  trial: "Trial",
  active: "Active",
  past_due: "Past due",
  cancelled: "Cancelled",
  suspended: "Suspended",
};

export const INVOICE_STATUS_LABELS: Record<BillingInvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  void: "Void",
};

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
};

export const METRIC_KEY_LABELS: Record<string, string> = {
  active_permits: "Active permits",
  users: "Users",
  storage_gb: "Storage (GB)",
};

export function formatMetricKey(key: string): string {
  return METRIC_KEY_LABELS[key] ?? key.replace(/_/g, " ");
}

export function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatDateLabel(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function currentPeriodLabel(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

export const BILLING_ADMIN_ROLES = ["org-admin", "platform-admin"] as const;

export function isBillingAdmin(roles: string[]): boolean {
  return roles.some((role) => (BILLING_ADMIN_ROLES as readonly string[]).includes(role));
}
