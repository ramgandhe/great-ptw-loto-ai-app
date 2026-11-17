/**
 * Multi-day permit domain types and defaults (Slice A).
 * Product rules: .planning/2026-11-10-multi-day-permit-refinement/mdp-refinement.md
 */

/** Day-cycle badge / gate states for a multi-day permit. */
export const DAY_CYCLE_STATES = [
  'not_multi_day',
  'secure_due',
  'late_secure_required',
  'reopen_due',
  'cleared',
  'failed_reopen',
  'override_used',
  'closed_path',
] as const;

export type DayCycleState = (typeof DAY_CYCLE_STATES)[number];

/** How more time is requested on a permit. */
export const TIME_FLOW_KINDS = ['overtime', 'extension', 'renewal'] as const;
export type TimeFlowKind = (typeof TIME_FLOW_KINDS)[number];

/** Default operational-day cut-off (HH:mm, tenant-local). */
export const DEFAULT_OPERATIONAL_DAY_CUTOFF = '16:30';

/** Default max multi-day validity in calendar days from planned start. */
export const DEFAULT_MAX_MULTI_DAY_VALIDITY_DAYS = 7;

/** Approval-time policy defaults (hard gate + override available). */
export const DEFAULT_DAILY_REVALIDATION_REQUIRED = true;
export const DEFAULT_EMERGENCY_OVERRIDE_ALLOWED = true;

/** Cut-off stored as HH:mm (24h). */
export type OperationalDayCutoff = string;

export type MultiDayPermitPolicy = {
  dailyRevalidationRequired: boolean;
  emergencyOverrideAllowed: boolean;
};

export type MultiDayTenantSettings = {
  maxMultiDayValidityDays: number;
  operationalDayCutoff: OperationalDayCutoff;
  /** Role that may approve same-day overtime; default HOD/permit-approver path. */
  overtimeApproverRole: 'permit-approver' | 'area-authority' | 'shift-in-charge';
};

export const DEFAULT_MULTI_DAY_TENANT_SETTINGS: MultiDayTenantSettings = {
  maxMultiDayValidityDays: DEFAULT_MAX_MULTI_DAY_VALIDITY_DAYS,
  operationalDayCutoff: DEFAULT_OPERATIONAL_DAY_CUTOFF,
  overtimeApproverRole: 'permit-approver',
};

export const DEFAULT_MULTI_DAY_PERMIT_POLICY: MultiDayPermitPolicy = {
  dailyRevalidationRequired: DEFAULT_DAILY_REVALIDATION_REQUIRED,
  emergencyOverrideAllowed: DEFAULT_EMERGENCY_OVERRIDE_ALLOWED,
};

/**
 * Parse HH:mm cut-off into minutes from local midnight.
 * Invalid input falls back to default 16:30 (16 * 60 + 30).
 */
export function cutoffToMinutes(
  cutoff: string | null | undefined,
  fallback: OperationalDayCutoff = DEFAULT_OPERATIONAL_DAY_CUTOFF,
): number {
  const raw = (cutoff && cutoff.trim()) || fallback;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw);
  if (!match) {
    const fb = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(fallback);
    if (!fb) {
      return 16 * 60 + 30;
    }
    return Number(fb[1]) * 60 + Number(fb[2]);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isDayCycleState(value: string): value is DayCycleState {
  return (DAY_CYCLE_STATES as readonly string[]).includes(value);
}

export function isTimeFlowKind(value: string): value is TimeFlowKind {
  return (TIME_FLOW_KINDS as readonly string[]).includes(value);
}
