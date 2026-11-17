import { inclusiveOperationalDaySpan } from './multi-day-schedule-rules';

/** Hours remaining below which the issuer must be notified to renew (FR-MDP-009). */
export const PERMIT_RENEWAL_THRESHOLD_MS = 48 * 60 * 60 * 1000;

export type PermitValidityState = 'within_validity' | 'renewal_due' | 'expired';

/** Tenant max-validity window relative to planned start (Slice I1). */
export type MaxValidityState = 'within_max' | 'max_validity_due';

export function classifyPermitValidity(
  plannedEndAt: Date | string | null | undefined,
  now: Date = new Date(),
): PermitValidityState {
  const end = toValidDate(plannedEndAt);
  if (!end) {
    return 'within_validity';
  }

  const remainingMs = end.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return 'expired';
  }

  if (remainingMs < PERMIT_RENEWAL_THRESHOLD_MS) {
    return 'renewal_due';
  }

  return 'within_validity';
}

/**
 * True when the permit has run past the tenant max multi-day window from planned start,
 * or the approved schedule itself already exceeds that max (legacy / drift).
 */
export function classifyMaxValidity(input: {
  plannedStartAt: Date | string | null | undefined;
  plannedEndAt?: Date | string | null | undefined;
  now?: Date;
  timezone?: string;
  maxMultiDayValidityDays: number;
}): MaxValidityState {
  const {
    plannedStartAt,
    plannedEndAt,
    now = new Date(),
    timezone = 'UTC',
    maxMultiDayValidityDays,
  } = input;

  const start = toValidDate(plannedStartAt);
  if (!start || maxMultiDayValidityDays < 1) {
    return 'within_max';
  }

  const startKey = operationalDateKey(start, timezone);
  const todayKey = operationalDateKey(now, timezone);
  const elapsed = inclusiveOperationalDaySpan(startKey, todayKey);
  if (elapsed > maxMultiDayValidityDays) {
    return 'max_validity_due';
  }

  const end = toValidDate(plannedEndAt);
  if (end) {
    const endKey = operationalDateKey(end, timezone);
    const scheduleSpan = inclusiveOperationalDaySpan(startKey, endKey);
    if (scheduleSpan > maxMultiDayValidityDays) {
      return 'max_validity_due';
    }
  }

  return 'within_max';
}

export function hoursRemaining(
  plannedEndAt: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  const end = toValidDate(plannedEndAt);
  if (!end) {
    return null;
  }

  return (end.getTime() - now.getTime()) / (60 * 60 * 1000);
}

/** Coerce cache/JSON string dates and Date instances into a valid Date. */
export function toValidDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Operational date key for tenant-local day-transition idempotency (YYYY-MM-DD).
 * Accepts Date or ISO strings (Redis-cached permits store dates as strings).
 */
export function operationalDateKey(
  now: Date | string | number,
  timezone = 'UTC',
): string {
  const date = toValidDate(now);
  if (!date) {
    throw new RangeError('Invalid time value');
  }
  const tz = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}
