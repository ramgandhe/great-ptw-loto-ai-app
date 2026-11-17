/**
 * Today-bound reopen helpers (Slice C1).
 * Operational date is always the current calendar day in the organisation timezone.
 * Cut-off flags same-day overtime territory; it does not roll the reopen day.
 */

import { isPastOperationalCutoff } from './multi-day-classification';
import {
  DEFAULT_OPERATIONAL_DAY_CUTOFF,
  type OperationalDayCutoff,
} from './multi-day.types';
import { operationalDateKey } from './permit-validity.service';

export type ReopenDayContext = {
  operationalDate: string;
  timezone: string;
  operationalDayCutoff: OperationalDayCutoff;
  /** True when local time is at/after cut-off on this operational date. */
  pastCutoff: boolean;
};

export function resolveReopenDayContext(
  now: Date,
  timezone = 'UTC',
  cutoff: OperationalDayCutoff = DEFAULT_OPERATIONAL_DAY_CUTOFF,
): ReopenDayContext {
  const tz = timezone.trim() || 'UTC';
  const operationalDayCutoff = cutoff || DEFAULT_OPERATIONAL_DAY_CUTOFF;
  return {
    operationalDate: operationalDateKey(now, tz),
    timezone: tz,
    operationalDayCutoff,
    pastCutoff: isPastOperationalCutoff(now, tz, operationalDayCutoff),
  };
}

/**
 * Bind reopen/revalidation to today.
 * Returns today's key; if `requested` is provided and differs, returns null (caller rejects).
 */
export function bindTodayOperationalDate(
  requested: string | null | undefined,
  context: ReopenDayContext,
): { ok: true; operationalDate: string } | { ok: false; expected: string; requested: string } {
  const today = context.operationalDate;
  if (requested == null || requested.trim() === '') {
    return { ok: true, operationalDate: today };
  }
  const normalized = requested.slice(0, 10);
  if (normalized !== today) {
    return { ok: false, expected: today, requested: normalized };
  }
  return { ok: true, operationalDate: today };
}

/** Whether multi-day daily audit requires a reopen for the current operational day. */
export function isDailyReopenRequired(input: {
  isMultiDay: boolean;
  dailyRevalidationRequired: boolean;
  /** Final planned day — reopen may still apply that morning; next-day reopen does not. */
  endOperationalDate: string | null;
  currentOperationalDate: string;
}): boolean {
  if (!input.isMultiDay || !input.dailyRevalidationRequired) {
    return false;
  }
  if (
    input.endOperationalDate &&
    input.currentOperationalDate > input.endOperationalDate
  ) {
    return false;
  }
  return true;
}
