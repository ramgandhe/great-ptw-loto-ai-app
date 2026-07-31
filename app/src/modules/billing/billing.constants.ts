/** BullMQ: run billing cycle and draft invoices for renewing subscriptions. */
export const BILLING_CYCLE_INVOICE_JOB = 'billing.cycle-invoice';

/** BullMQ: aggregate usage metrics into usage_records. */
export const BILLING_USAGE_AGGREGATE_JOB = 'billing.usage-aggregate';

/** BullMQ: notify admins of upcoming renewals (FR-BIL-005). */
export const BILLING_RENEWAL_NOTIFY_JOB = 'billing.renewal-notify';

export const BILLING_ADMIN_ROLES = ['org-admin', 'platform-admin'] as const;

export const BILLING_READ_ROLES = [
  'org-admin',
  'platform-admin',
  'safety-manager',
] as const;
