import { classifySchedule } from './multi-day-classification';
import {
  DEFAULT_MULTI_DAY_PERMIT_POLICY,
  DEFAULT_OPERATIONAL_DAY_CUTOFF,
  type MultiDayPermitPolicy,
} from './multi-day.types';
import { resolveMultiDayTenantSettings } from './multi-day-settings';

export type MultiDaySummary = {
  isMultiDay: boolean;
  startOperationalDate: string | null;
  endOperationalDate: string | null;
  endPastCutoffSameDay: boolean;
  dailyRevalidationRequired: boolean;
  emergencyOverrideAllowed: boolean;
  operationalDayCutoff: string;
  timezone: string;
  maxMultiDayValidityDays: number;
};

/** Stub for unit-test fixtures that build PermitDetail by hand. */
export const EMPTY_MULTI_DAY_SUMMARY: MultiDaySummary = {
  isMultiDay: false,
  startOperationalDate: null,
  endOperationalDate: null,
  endPastCutoffSameDay: false,
  dailyRevalidationRequired: true,
  emergencyOverrideAllowed: true,
  operationalDayCutoff: DEFAULT_OPERATIONAL_DAY_CUTOFF,
  timezone: 'UTC',
  maxMultiDayValidityDays: 7,
};

type PermitMdpFields = {
  /** Date or ISO string — Redis cache round-trips dates as strings. */
  plannedStartAt: Date | string | null;
  plannedEndAt: Date | string | null;
  dailyRevalidationRequired?: boolean | null;
  emergencyOverrideAllowed?: boolean | null;
};

type OrgMdpFields = {
  timezone?: string | null;
  maxMultiDayValidityDays?: number | null;
  operationalDayCutoff?: string | null;
  overtimeApproverRole?: string | null;
};

export function buildMultiDaySummary(
  permit: PermitMdpFields,
  org?: OrgMdpFields | null,
): MultiDaySummary {
  const settings = resolveMultiDayTenantSettings(org);
  const timezone = org?.timezone?.trim() || 'UTC';
  const classification = classifySchedule(
    permit.plannedStartAt,
    permit.plannedEndAt,
    timezone,
    settings.operationalDayCutoff,
  );

  const policy: MultiDayPermitPolicy = {
    dailyRevalidationRequired:
      permit.dailyRevalidationRequired ?? DEFAULT_MULTI_DAY_PERMIT_POLICY.dailyRevalidationRequired,
    emergencyOverrideAllowed:
      permit.emergencyOverrideAllowed ?? DEFAULT_MULTI_DAY_PERMIT_POLICY.emergencyOverrideAllowed,
  };

  return {
    isMultiDay: classification?.isMultiDay === true,
    startOperationalDate: classification?.startOperationalDate ?? null,
    endOperationalDate: classification?.endOperationalDate ?? null,
    endPastCutoffSameDay: classification?.endPastCutoffSameDay === true,
    dailyRevalidationRequired: policy.dailyRevalidationRequired,
    emergencyOverrideAllowed: policy.emergencyOverrideAllowed,
    operationalDayCutoff: settings.operationalDayCutoff || DEFAULT_OPERATIONAL_DAY_CUTOFF,
    timezone,
    maxMultiDayValidityDays: settings.maxMultiDayValidityDays,
  };
}
