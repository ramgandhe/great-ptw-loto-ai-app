/**
 * Explicit FR-BIL requirement map (MS-08 billing infra alone is not proof of FR-BIL).
 *
 * | FR-BIL | Surface | Source |
 * |--------|---------|--------|
 * | FR-BIL-002 | plan.enabled_modules + isModuleEnabled / updatePlanModules | subscription_plans |
 * | FR-BIL-003 | usage_records + assertWithinLimit + aggregateUsage | usage_records, permits, incidents |
 * | FR-BIL-004 | billing_invoices transitions + cycle draft | billing_invoices, plan_change_history |
 * | FR-BIL-005 | renewal notify → notifications | tenant_subscriptions.renew_at |
 */
export const FR_BIL_TRACEABILITY = {
  'FR-BIL-002': {
    surface: 'subscriptions.modules',
    sourceTables: ['subscription_plans', 'tenant_subscriptions'],
    jobs: [] as const,
  },
  'FR-BIL-003': {
    surface: 'billing.usage',
    sourceTables: ['usage_records', 'subscription_plans', 'permits', 'incidents'],
    jobs: ['billing.usage-aggregate'] as const,
  },
  'FR-BIL-004': {
    surface: 'billing.invoices',
    sourceTables: ['billing_invoices', 'plan_change_history', 'tenant_subscriptions'],
    jobs: ['billing.cycle-invoice'] as const,
  },
  'FR-BIL-005': {
    surface: 'billing.renewal-notify',
    sourceTables: ['tenant_subscriptions', 'notifications'],
    jobs: ['billing.renewal-notify'] as const,
  },
} as const;

export type FrBilRequirementId = keyof typeof FR_BIL_TRACEABILITY;

/** Canonical platform module keys managed via plan.enabled_modules (FR-BIL-002). */
export const PLATFORM_MODULE_KEYS = [
  'ptw',
  'lototo',
  'simops',
  'incidents',
  'dashboards',
  'multi_day',
] as const;

export type PlatformModuleKey = (typeof PLATFORM_MODULE_KEYS)[number];

/** Usage metrics reconciled against plan.usage_limits (FR-BIL-003). */
export const USAGE_METRIC_KEYS = [
  'active_permits',
  'open_incidents',
  'users',
] as const;
