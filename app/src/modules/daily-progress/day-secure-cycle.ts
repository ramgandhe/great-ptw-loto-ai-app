/**
 * Late secure + final-day helpers (Slice B5–B7).
 * Day-cycle state resolution for secure-due signalling (Wave 1 / B7).
 */

import type { DayCycleState } from '../revalidation/multi-day.types';
import { isDaySecureComplete } from './day-secure-countersign';

/** Shift YYYY-MM-DD by `deltaDays` (calendar arithmetic in UTC date parts). */
export function shiftOperationalDate(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function previousOperationalDate(dateKey: string): string {
  return shiftOperationalDate(dateKey, -1);
}

/** Inclusive list of YYYY-MM-DD keys from start through end. */
export function eachOperationalDateInclusive(start: string, end: string): string[] {
  if (start > end) {
    return [];
  }
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    cursor = shiftOperationalDate(cursor, 1);
    if (out.length > 400) {
      break;
    }
  }
  return out;
}

/** Securing a day earlier than the current operational day is a late secure. */
export function isLateSecure(
  operationalDate: string,
  currentOperationalDate: string,
): boolean {
  return operationalDate < currentOperationalDate;
}

/** Final planned operational day — secure OK; no next-day reopen expected. */
export function isFinalDaySecure(
  operationalDate: string,
  endOperationalDate: string | null | undefined,
): boolean {
  return Boolean(endOperationalDate && operationalDate === endOperationalDate);
}

export type DaySecureRowLike = {
  operationalDate: string;
  countersignedBy: string | null;
  checklist?: Record<string, unknown> | null;
  status?: string;
};

/**
 * Prior work days (from start through yesterday) that lack a complete secure.
 * Empty → no late secure outstanding.
 */
export function missingPriorSecureDates(input: {
  startOperationalDate: string;
  endOperationalDate: string;
  currentOperationalDate: string;
  secures: DaySecureRowLike[];
}): string[] {
  const yesterday = previousOperationalDate(input.currentOperationalDate);
  const windowEnd =
    yesterday < input.endOperationalDate ? yesterday : input.endOperationalDate;
  if (windowEnd < input.startOperationalDate) {
    return [];
  }

  const complete = new Set(
    input.secures
      .filter((row) => isDaySecureComplete(row) && row.status !== 'pending_countersign')
      .map((row) => row.operationalDate),
  );

  return eachOperationalDateInclusive(input.startOperationalDate, windowEnd).filter(
    (day) => !complete.has(day),
  );
}

export function hasOutstandingLateSecure(input: {
  startOperationalDate: string;
  endOperationalDate: string;
  currentOperationalDate: string;
  secures: DaySecureRowLike[];
}): boolean {
  return missingPriorSecureDates(input).length > 0;
}

/** True when a complete (countersigned if required) secure exists for the date. */
export function hasCompleteSecureForDate(
  secures: DaySecureRowLike[],
  operationalDate: string,
): boolean {
  return secures.some(
    (row) =>
      row.operationalDate === operationalDate &&
      isDaySecureComplete(row) &&
      row.status !== 'pending_countersign',
  );
}

/**
 * Resolve board/badge day-cycle state.
 * Work clearance (reopen/first day) is separate from EOD secure signalling:
 * after work is allowed, move to `secure_due` once progress is in or past cut-off.
 */
export function resolveMultiDayCycleState(input: {
  lateSecureRequired: boolean;
  overrideUsedToday: boolean;
  todayReopenOutcome: 'passed' | 'failed' | null;
  dailyRevalidationRequired: boolean;
  isFirstOperationalDay: boolean;
  onFinalDay: boolean;
  todaySecureComplete: boolean;
  pastCutoff: boolean;
  progressSubmittedToday: boolean;
}): Exclude<DayCycleState, 'not_multi_day'> {
  if (input.lateSecureRequired) {
    return 'late_secure_required';
  }
  if (input.todayReopenOutcome === 'failed') {
    return 'failed_reopen';
  }

  const reopenSatisfied =
    !input.dailyRevalidationRequired ||
    input.isFirstOperationalDay ||
    input.todayReopenOutcome === 'passed' ||
    input.overrideUsedToday;

  if (!reopenSatisfied) {
    return 'reopen_due';
  }

  if (input.todaySecureComplete) {
    return input.onFinalDay ? 'closed_path' : 'cleared';
  }

  if (input.pastCutoff || input.progressSubmittedToday) {
    return 'secure_due';
  }

  if (input.overrideUsedToday) {
    return 'override_used';
  }

  return 'cleared';
}

export function isClearedForWorkToday(input: {
  lateSecureRequired: boolean;
  overrideUsedToday: boolean;
  todayReopenOutcome: 'passed' | 'failed' | null;
  dailyRevalidationRequired: boolean;
  isFirstOperationalDay: boolean;
}): boolean {
  if (input.lateSecureRequired) {
    return false;
  }
  if (input.todayReopenOutcome === 'failed') {
    return false;
  }
  if (!input.dailyRevalidationRequired) {
    return true;
  }
  return (
    input.isFirstOperationalDay ||
    input.todayReopenOutcome === 'passed' ||
    input.overrideUsedToday
  );
}
