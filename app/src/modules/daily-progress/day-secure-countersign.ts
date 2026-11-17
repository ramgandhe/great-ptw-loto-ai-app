/**
 * End-of-day secure dual countersign rules (Slice B4 / locked rule #7).
 * Executor always. Area/issuer when daily audit ON or open LOTOTO isolations remain.
 */

/** Certificate statuses that mean energy isolation is still in place overnight. */
export const OVERNIGHT_OPEN_ISOLATION_STATUSES = [
  'isolation_in_progress',
  'isolated_verified',
  'sanction_for_test',
  'restoration_in_progress',
] as const;

export type OvernightOpenIsolationStatus =
  (typeof OVERNIGHT_OPEN_ISOLATION_STATUSES)[number];

export function isOvernightOpenIsolationStatus(
  status: string,
): status is OvernightOpenIsolationStatus {
  return (OVERNIGHT_OPEN_ISOLATION_STATUSES as readonly string[]).includes(status);
}

export type DaySecureCountersignDecision = {
  required: boolean;
  reasons: Array<'daily_audit' | 'open_isolations'>;
};

export function decideDaySecureCountersign(input: {
  dailyRevalidationRequired: boolean;
  openIsolationsRemain: boolean;
}): DaySecureCountersignDecision {
  const reasons: DaySecureCountersignDecision['reasons'] = [];
  if (input.dailyRevalidationRequired) {
    reasons.push('daily_audit');
  }
  if (input.openIsolationsRemain) {
    reasons.push('open_isolations');
  }
  return { required: reasons.length > 0, reasons };
}

/** Secure is complete when countersign is not required, or has been applied. */
export function isDaySecureComplete(row: {
  countersignedBy: string | null;
  checklist?: Record<string, unknown> | null;
}): boolean {
  const required = row.checklist?.countersignRequired === true;
  if (!required) {
    return true;
  }
  return row.countersignedBy != null;
}
