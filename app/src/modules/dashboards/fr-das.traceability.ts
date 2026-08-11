/**
 * Explicit FR-DAS ↔ FR-DSH equivalence (FR-DSH alone is not proof of FR-DAS).
 *
 * | FR-DAS | FR-DSH evidence reused | Metric / surface |
 * |--------|------------------------|------------------|
 * | FR-DAS-002 | FR-DSH-001…003 kinds + RBAC | Role-relevant dashboard summary |
 * | FR-DAS-003 | FR-DSH-005 report_exports | permit_summary report |
 * | FR-DAS-004 | FR-DSH-005 | incident_summary report |
 * | FR-DAS-005 | (gap closed) | simops_summary report + analytics scope |
 * | FR-DAS-006 | (gap closed) | lototo_summary report + analytics scope |
 * | FR-DAS-007 | FR-DSH-004 snapshots | organizational analytics scopes |
 * | FR-DAS-008 | FR-DSH-005 filters column | applied operational filters |
 */
export const FR_DAS_TRACEABILITY = {
  'FR-DAS-002': {
    frDsh: ['FR-DSH-001', 'FR-DSH-002', 'FR-DSH-003'],
    surface: 'dashboard.summary',
    sourceTables: ['permits', 'incidents', 'simops_conflicts', 'isolation_execution'],
  },
  'FR-DAS-003': {
    frDsh: ['FR-DSH-005'],
    surface: 'reports.permit_summary',
    sourceTables: ['permits'],
  },
  'FR-DAS-004': {
    frDsh: ['FR-DSH-005'],
    surface: 'reports.incident_summary',
    sourceTables: ['incidents'],
  },
  'FR-DAS-005': {
    frDsh: ['FR-DSH-004', 'FR-DSH-005'],
    surface: 'reports.simops_summary',
    sourceTables: ['simops_conflicts'],
  },
  'FR-DAS-006': {
    frDsh: ['FR-DSH-004', 'FR-DSH-005'],
    surface: 'reports.lototo_summary',
    sourceTables: ['isolation_execution', 'lototo_plans'],
  },
  'FR-DAS-007': {
    frDsh: ['FR-DSH-004', 'FR-DSH-006'],
    surface: 'analytics.scopes',
    sourceTables: ['permits', 'incidents', 'simops_conflicts', 'isolation_execution'],
  },
  'FR-DAS-008': {
    frDsh: ['FR-DSH-005'],
    surface: 'reports.filters + analytics/kpi filters',
    sourceTables: ['permits', 'incidents', 'simops_conflicts', 'isolation_execution'],
  },
} as const;

export type FrDasRequirementId = keyof typeof FR_DAS_TRACEABILITY;

/** Metric definitions reconciled to PostgreSQL counts (tenant-scoped). */
export const FR_DAS_METRIC_DEFINITIONS = {
  active_permits: {
    description: 'Permits in active or approved status',
    requirementIds: ['FR-DAS-002', 'FR-DAS-003', 'FR-DAS-007'] as const,
  },
  pending_approvals: {
    description: 'Permits awaiting approval',
    requirementIds: ['FR-DAS-002', 'FR-DAS-003', 'FR-DAS-007'] as const,
  },
  open_incidents: {
    description: 'Incidents open / investigating / pending verification',
    requirementIds: ['FR-DAS-002', 'FR-DAS-004', 'FR-DAS-007'] as const,
  },
  open_simops_conflicts: {
    description: 'SIMOPS conflicts in open status',
    requirementIds: ['FR-DAS-002', 'FR-DAS-005', 'FR-DAS-007'] as const,
  },
  active_lototo_executions: {
    description: 'Isolation executions in_progress / isolated / verified',
    requirementIds: ['FR-DAS-002', 'FR-DAS-006', 'FR-DAS-007'] as const,
  },
} as const;

export const REPORT_TYPES = [
  'permit_summary',
  'incident_summary',
  'simops_summary',
  'lototo_summary',
  'operational_kpis',
] as const;
