import {
  DEFAULT_MULTI_DAY_TENANT_SETTINGS,
  type MultiDayTenantSettings,
  type OperationalDayCutoff,
} from './multi-day.types';

const OVERTIME_ROLES = new Set([
  'permit-approver',
  'area-authority',
  'shift-in-charge',
]);

type OrgMdpColumns = {
  maxMultiDayValidityDays?: number | null;
  operationalDayCutoff?: string | null;
  overtimeApproverRole?: string | null;
};

function normalizeCutoff(value: string | null | undefined): OperationalDayCutoff {
  const raw = (value ?? '').trim();
  if (/^([01]?\d|2[0-3]):([0-5]\d)$/.test(raw)) {
    const [h, m] = raw.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  return DEFAULT_MULTI_DAY_TENANT_SETTINGS.operationalDayCutoff;
}

function normalizeMaxDays(value: number | null | undefined): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 365) {
    return value;
  }
  return DEFAULT_MULTI_DAY_TENANT_SETTINGS.maxMultiDayValidityDays;
}

function normalizeOvertimeRole(
  value: string | null | undefined,
): MultiDayTenantSettings['overtimeApproverRole'] {
  if (value && OVERTIME_ROLES.has(value)) {
    return value as MultiDayTenantSettings['overtimeApproverRole'];
  }
  return DEFAULT_MULTI_DAY_TENANT_SETTINGS.overtimeApproverRole;
}

/** Resolve tenant MDP settings from an organisation row (with safe defaults). */
export function resolveMultiDayTenantSettings(
  org: OrgMdpColumns | null | undefined,
): MultiDayTenantSettings {
  if (!org) {
    return { ...DEFAULT_MULTI_DAY_TENANT_SETTINGS };
  }
  return {
    maxMultiDayValidityDays: normalizeMaxDays(org.maxMultiDayValidityDays),
    operationalDayCutoff: normalizeCutoff(org.operationalDayCutoff),
    overtimeApproverRole: normalizeOvertimeRole(org.overtimeApproverRole),
  };
}
