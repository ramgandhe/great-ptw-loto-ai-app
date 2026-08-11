export const VALIDITY_DECISIONS = [
  'ok_gt_48h',
  'renew_notify_lte_48h',
  'expired',
  'out_of_range',
] as const;
export type ValidityDecision = (typeof VALIDITY_DECISIONS)[number];

/** Hours remaining until planned end. Negative means already expired. */
export function remainingHoursUntil(endAt: Date, now: Date): number {
  return (endAt.getTime() - now.getTime()) / (60 * 60 * 1000);
}

/**
 * FR-MDP-009 — validity branches against approved end.
 * `= 48h` is treated as renew-notify (`<= 48`).
 */
export function evaluateValidityDecision(
  plannedStartAt: Date | null,
  plannedEndAt: Date | null,
  now: Date,
): { decision: ValidityDecision; remainingHours: number | null } {
  if (!plannedEndAt) {
    return { decision: 'out_of_range', remainingHours: null };
  }

  if (plannedStartAt && now < plannedStartAt) {
    // Before approved window — still within upcoming range; treat by end distance.
  }

  const remainingHours = remainingHoursUntil(plannedEndAt, now);

  if (remainingHours < 0) {
    return { decision: 'expired', remainingHours };
  }

  if (remainingHours <= 48) {
    return { decision: 'renew_notify_lte_48h', remainingHours };
  }

  return { decision: 'ok_gt_48h', remainingHours };
}

export function isExpiredOrOutOfRange(decision: ValidityDecision): boolean {
  return decision === 'expired' || decision === 'out_of_range';
}

/**
 * Calendar operational date (YYYY-MM-DD) in an IANA timezone.
 * Falls back to UTC if the timezone is invalid.
 */
export function operationalDateInTimezone(now: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (!year || !month || !day) {
      return now.toISOString().slice(0, 10);
    }
    return `${year}-${month}-${day}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export const DEFAULT_TENANT_TIMEZONE = 'UTC';
export const VALIDITY_RENEW_NOTIFY_HOURS = 48;
