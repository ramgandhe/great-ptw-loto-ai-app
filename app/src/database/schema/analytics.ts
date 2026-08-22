import {
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

/** FR-DSH-001…003 role-based dashboard kinds. */
export const DASHBOARD_KINDS = [
  'personal',
  'hod',
  'safety',
  'management',
] as const;
export type DashboardKind = (typeof DASHBOARD_KINDS)[number];

export const REPORT_EXPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

export const REPORT_EXPORT_STATUSES = [
  'pending',
  'generating',
  'ready',
  'failed',
  'expired',
] as const;
export type ReportExportStatus = (typeof REPORT_EXPORT_STATUSES)[number];

export const ANALYTICS_SNAPSHOT_SCOPES = [
  'permits',
  'incidents',
  'lototo',
  'simops',
  'operational',
] as const;
export type AnalyticsSnapshotScope = (typeof ANALYTICS_SNAPSHOT_SCOPES)[number];

/** Per-user dashboard layout/preferences (FR-DSH-001…003). */
export const dashboardPreferences = pgTable(
  'dashboard_preferences',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    dashboardKind: varchar('dashboard_kind', { length: 32 }).notNull(),
    layout: jsonb('layout').$type<Record<string, unknown>>().notNull().default({}),
    filters: jsonb('filters').$type<Record<string, unknown>>().notNull().default({}),
    refreshSeconds: integer('refresh_seconds').notNull().default(60),
  },
  (table) => [
    uniqueIndex('dashboard_preferences_tenant_user_kind_unique').on(
      table.tenantId,
      table.userId,
      table.dashboardKind,
    ),
    index('dashboard_preferences_tenant_id_idx').on(table.tenantId),
    index('dashboard_preferences_tenant_user_idx').on(table.tenantId, table.userId),
  ],
);

/** Report generation metadata (FR-DSH-005 / FC-DSH-003). */
export const reportExports = pgTable(
  'report_exports',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    requestedBy: uuid('requested_by').notNull(),
    reportType: varchar('report_type', { length: 64 }).notNull(),
    format: varchar('format', { length: 16 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    filters: jsonb('filters').$type<Record<string, unknown>>().notNull().default({}),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    storageBucket: varchar('storage_bucket', { length: 128 }),
    storageKey: varchar('storage_key', { length: 512 }),
    fileName: varchar('file_name', { length: 255 }),
    contentType: varchar('content_type', { length: 128 }),
    errorMessage: text('error_message'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('report_exports_tenant_id_idx').on(table.tenantId),
    index('report_exports_tenant_status_idx').on(table.tenantId, table.status),
    index('report_exports_tenant_requested_by_idx').on(table.tenantId, table.requestedBy),
    index('report_exports_created_at_idx').on(table.createdAt),
  ],
);

/** Point-in-time analytics payloads for trends (FR-DSH-004 / BR-DSH-006). */
export const analyticsSnapshots = pgTable(
  'analytics_snapshots',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    scope: varchar('scope', { length: 32 }).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    source: varchar('source', { length: 64 }).notNull().default('system'),
  },
  (table) => [
    index('analytics_snapshots_tenant_id_idx').on(table.tenantId),
    index('analytics_snapshots_tenant_scope_idx').on(table.tenantId, table.scope),
    index('analytics_snapshots_tenant_captured_at_idx').on(table.tenantId, table.capturedAt),
    uniqueIndex('analytics_snapshots_tenant_scope_period_unique').on(
      table.tenantId,
      table.scope,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

/** Cached KPI values for dashboard widgets (FR-DSH-006). */
export const kpiCache = pgTable(
  'kpi_cache',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    kpiKey: varchar('kpi_key', { length: 128 }).notNull(),
    dashboardKind: varchar('dashboard_kind', { length: 32 }),
    periodLabel: varchar('period_label', { length: 64 }).notNull().default('current'),
    value: jsonb('value').$type<Record<string, unknown>>().notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('kpi_cache_tenant_key_period_unique').on(
      table.tenantId,
      table.kpiKey,
      table.periodLabel,
    ),
    index('kpi_cache_tenant_id_idx').on(table.tenantId),
    index('kpi_cache_tenant_kind_idx').on(table.tenantId, table.dashboardKind),
    index('kpi_cache_expires_at_idx').on(table.expiresAt),
  ],
);
