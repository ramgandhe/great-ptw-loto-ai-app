import type { DashboardKind } from '../../database/schema/analytics';

/** BullMQ: process pending report_exports rows (FR-DSH-005). */
export const DASHBOARD_REPORT_GENERATE_JOB = 'dashboard.report-generate';

/** BullMQ: capture analytics_snapshots for trend history (FR-DSH-004). */
export const DASHBOARD_ANALYTICS_SNAPSHOT_JOB = 'dashboard.analytics-snapshot';

/** BullMQ: refresh kpi_cache values for dashboard widgets (FR-DSH-006). */
export const DASHBOARD_KPI_REFRESH_JOB = 'dashboard.kpi-refresh';

export const DASHBOARD_READ_ROLES = [
  'operator',
  'job-issuer',
  'hod',
  'safety-officer',
  'org-admin',
  'platform-admin',
  'viewer',
] as const;

export const DASHBOARD_REPORT_ROLES = [
  'hod',
  'safety-officer',
  'org-admin',
  'platform-admin',
] as const;

export const DASHBOARD_ANALYTICS_ROLES = [
  'hod',
  'safety-officer',
  'org-admin',
  'platform-admin',
] as const;

/** Roles allowed per dashboard kind (BR-DSH-001 / BR-DSH-002). */
export const DASHBOARD_KIND_ROLES: Record<DashboardKind, readonly string[]> = {
  personal: DASHBOARD_READ_ROLES,
  hod: ['hod', 'safety-officer', 'org-admin', 'platform-admin'],
  safety: ['safety-officer', 'org-admin', 'platform-admin'],
  management: ['safety-officer', 'org-admin', 'platform-admin'],
};

/** Object key prefix inside MINIO_BUCKET for generated report exports. */
export const DASHBOARD_REPORT_PREFIX = 'dashboards/reports';
