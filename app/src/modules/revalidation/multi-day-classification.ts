import { operationalDateKey, toValidDate } from './permit-validity.service';
import {
  DEFAULT_OPERATIONAL_DAY_CUTOFF,
  cutoffToMinutes,
  type OperationalDayCutoff,
} from './multi-day.types';

export type ScheduleClassification = {
  /** True when start and end fall on different calendar dates in the site timezone. */
  isMultiDay: boolean;
  /** Calendar date (YYYY-MM-DD) of planned start in timezone. */
  startOperationalDate: string;
  /** Calendar date (YYYY-MM-DD) of planned end in timezone. */
  endOperationalDate: string;
  /**
   * True when the planned end is on the same operational date as start
   * but at or after the tenant cut-off (same-day overtime territory).
   */
  endPastCutoffSameDay: boolean;
};

type DateInput = Date | string | number | null | undefined;

function partsInTimeZone(
  at: Date,
  timezone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const tz = timezone.trim() || 'UTC';
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  }
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(at)) {
    if (part.type !== 'literal') {
      bag[part.type] = part.value;
    }
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  };
}

/** Minutes from local midnight for `at` in `timezone`. */
export function localMinutesOfDay(at: Date | string | number, timezone: string): number {
  const date = toValidDate(at);
  if (!date) {
    return 0;
  }
  const parts = partsInTimeZone(date, timezone);
  return parts.hour * 60 + parts.minute;
}

export function isPastOperationalCutoff(
  at: Date | string | number,
  timezone: string,
  cutoff: OperationalDayCutoff = DEFAULT_OPERATIONAL_DAY_CUTOFF,
): boolean {
  return localMinutesOfDay(at, timezone) >= cutoffToMinutes(cutoff);
}

/**
 * Classify a planned schedule for multi-day vs same-day (with optional overtime).
 * Cut-off does not create a new operational day; it only flags same-day overtime territory.
 * Accepts Date or ISO strings (Redis-cached permits).
 */
export function classifySchedule(
  plannedStartAt: DateInput,
  plannedEndAt: DateInput,
  timezone = 'UTC',
  cutoff: OperationalDayCutoff = DEFAULT_OPERATIONAL_DAY_CUTOFF,
): ScheduleClassification | null {
  const start = toValidDate(plannedStartAt);
  const end = toValidDate(plannedEndAt);
  if (!start || !end) {
    return null;
  }

  const startOperationalDate = operationalDateKey(start, timezone);
  const endOperationalDate = operationalDateKey(end, timezone);
  const isMultiDay = startOperationalDate !== endOperationalDate;
  const endPastCutoffSameDay =
    !isMultiDay && isPastOperationalCutoff(end, timezone, cutoff);

  return {
    isMultiDay,
    startOperationalDate,
    endOperationalDate,
    endPastCutoffSameDay,
  };
}

export function isMultiDay(
  plannedStartAt: DateInput,
  plannedEndAt: DateInput,
  timezone = 'UTC',
  _cutoff: OperationalDayCutoff = DEFAULT_OPERATIONAL_DAY_CUTOFF,
): boolean {
  const classification = classifySchedule(
    plannedStartAt,
    plannedEndAt,
    timezone,
    _cutoff,
  );
  return classification?.isMultiDay === true;
}
