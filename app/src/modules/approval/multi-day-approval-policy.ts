import {
  DEFAULT_DAILY_REVALIDATION_REQUIRED,
  DEFAULT_EMERGENCY_OVERRIDE_ALLOWED,
  type MultiDayPermitPolicy,
} from '../revalidation/multi-day.types';

export type ApprovalMultiDayPolicyInput = {
  dailyRevalidationRequired?: boolean;
  emergencyOverrideAllowed?: boolean;
  /** Slice J3: permit-type lock forces daily audit ON. */
  forceDailyRevalidation?: boolean;
};

/**
 * Policy applied on final approval for multi-day permits.
 * Returns null when the permit is not multi-day (no policy write needed).
 */
export function resolveApprovalMultiDayPolicy(
  isMultiDay: boolean,
  input: ApprovalMultiDayPolicyInput = {},
): MultiDayPermitPolicy | null {
  if (!isMultiDay) {
    return null;
  }

  const dailyRevalidationRequired = input.forceDailyRevalidation
    ? true
    : (input.dailyRevalidationRequired ?? DEFAULT_DAILY_REVALIDATION_REQUIRED);

  return {
    dailyRevalidationRequired,
    emergencyOverrideAllowed:
      input.emergencyOverrideAllowed ?? DEFAULT_EMERGENCY_OVERRIDE_ALLOWED,
  };
}
