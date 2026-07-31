import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';

/** FR-BIL-001 subscription plan catalog. */
export const BILLING_INTERVALS = ['monthly', 'yearly'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const SUBSCRIPTION_PLAN_STATUSES = ['active', 'retired'] as const;
export type SubscriptionPlanStatus = (typeof SUBSCRIPTION_PLAN_STATUSES)[number];

export const TENANT_SUBSCRIPTION_STATUSES = [
  'trial',
  'active',
  'past_due',
  'cancelled',
  'suspended',
] as const;
export type TenantSubscriptionStatus = (typeof TENANT_SUBSCRIPTION_STATUSES)[number];

export const BILLING_INVOICE_STATUSES = ['draft', 'issued', 'paid', 'void'] as const;
export type BillingInvoiceStatus = (typeof BILLING_INVOICE_STATUSES)[number];

/** Global plan catalogue (FR-BIL-001 / FR-BIL-002). */
export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    ...auditColumns,
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    billingInterval: varchar('billing_interval', { length: 16 }).notNull(),
    priceMinor: integer('price_minor').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    enabledModules: jsonb('enabled_modules').$type<string[]>().notNull().default([]),
    usageLimits: jsonb('usage_limits').$type<Record<string, unknown>>().notNull().default({}),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    description: text('description'),
  },
  (table) => [
    uniqueIndex('subscription_plans_code_unique').on(table.code),
    index('subscription_plans_status_idx').on(table.status),
  ],
);

/** Tenant subscription assignment (FR-BIL-001 / FR-BIL-006). */
export const tenantSubscriptions = pgTable(
  'tenant_subscriptions',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 32 }).notNull().default('trial'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    renewAt: timestamp('renew_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (table) => [
    index('tenant_subscriptions_tenant_id_idx').on(table.tenantId),
    index('tenant_subscriptions_tenant_status_idx').on(table.tenantId, table.status),
    index('tenant_subscriptions_plan_id_idx').on(table.planId),
    index('tenant_subscriptions_renew_at_idx').on(table.renewAt),
  ],
);

/** Usage monitoring against plan limits (FR-BIL-003). */
export const usageRecords = pgTable(
  'usage_records',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    metricKey: varchar('metric_key', { length: 128 }).notNull(),
    quantity: bigint('quantity', { mode: 'number' }).notNull().default(0),
    periodLabel: varchar('period_label', { length: 64 }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('usage_records_tenant_metric_period_unique').on(
      table.tenantId,
      table.metricKey,
      table.periodLabel,
    ),
    index('usage_records_tenant_id_idx').on(table.tenantId),
    index('usage_records_tenant_metric_idx').on(table.tenantId, table.metricKey),
    index('usage_records_recorded_at_idx').on(table.recordedAt),
  ],
);

/** Billing history / invoices (FR-BIL-004). */
export const billingInvoices = pgTable(
  'billing_invoices',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => tenantSubscriptions.id, { onDelete: 'restrict' }),
    invoiceNumber: varchar('invoice_number', { length: 64 }).notNull(),
    amountMinor: integer('amount_minor').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('billing_invoices_invoice_number_unique').on(table.invoiceNumber),
    index('billing_invoices_tenant_id_idx').on(table.tenantId),
    index('billing_invoices_tenant_status_idx').on(table.tenantId, table.status),
    index('billing_invoices_subscription_id_idx').on(table.subscriptionId),
  ],
);

/** Append-only plan change audit (FR-BIL-001 / FR-BIL-006). */
export const planChangeHistory = pgTable(
  'plan_change_history',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => tenantSubscriptions.id, { onDelete: 'restrict' }),
    fromPlanId: uuid('from_plan_id').references(() => subscriptionPlans.id, {
      onDelete: 'restrict',
    }),
    toPlanId: uuid('to_plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
    changedBy: uuid('changed_by').notNull(),
    reason: text('reason'),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('plan_change_history_tenant_id_idx').on(table.tenantId),
    index('plan_change_history_subscription_id_idx').on(table.subscriptionId),
    index('plan_change_history_changed_at_idx').on(table.changedAt),
  ],
);
