import { BadRequestException } from '@nestjs/common';
import { classifySchedule, isMultiDay } from './multi-day-classification';
import {
  DEFAULT_MAX_MULTI_DAY_VALIDITY_DAYS,
  DEFAULT_OPERATIONAL_DAY_CUTOFF,
  type OperationalDayCutoff,
} from './multi-day.types';

/** Inclusive count of calendar dates from start YYYY-MM-DD through end YYYY-MM-DD. */
export function inclusiveOperationalDaySpan(
  startOperationalDate: string,
  endOperationalDate: string,
): number {
  const startMs = Date.parse(`${startOperationalDate}T00:00:00.000Z`);
  const endMs = Date.parse(`${endOperationalDate}T00:00:00.000Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return 0;
  }
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

/**
 * Rejects a client claim that disagrees with date-derived multi-day classification.
 * Multi-day cannot be manually cleared while the schedule spans multiple operational days.
 */
export function assertMultiDayClaimMatchesSchedule(
  plannedStartAt: Date | null | undefined,
  plannedEndAt: Date | null | undefined,
  claimedIsMultiDay: boolean | undefined,
  timezone = 'UTC',
  cutoff: OperationalDayCutoff = DEFAULT_OPERATIONAL_DAY_CUTOFF,
): void {
  if (claimedIsMultiDay === undefined) {
    return;
  }

  const actual = isMultiDay(plannedStartAt, plannedEndAt, timezone, cutoff);
  if (claimedIsMultiDay === actual) {
    return;
  }

  if (claimedIsMultiDay === false && actual) {
    throw new BadRequestException(
      'Multi-day is determined by the planned dates and cannot be cleared while the schedule spans more than one operational day. Shorten the planned end date instead.',
    );
  }

  throw new BadRequestException(
    'Multi-day is determined automatically from the planned start and end dates.',
  );
}

export type ScheduleMultiDayValidation = {
  timezone?: string;
  operationalDayCutoff?: OperationalDayCutoff;
  maxMultiDayValidityDays?: number;
  /** Optional client claim; omit when the client does not send isMultiDay. */
  claimedIsMultiDay?: boolean;
};

/** Returns human-readable schedule errors (empty when valid). */
export function multiDayScheduleErrors(
  plannedStartAt: Date | null | undefined,
  plannedEndAt: Date | null | undefined,
  options: ScheduleMultiDayValidation = {},
): string[] {
  const errors: string[] = [];
  if (!plannedStartAt || !plannedEndAt) {
    return errors;
  }

  const timezone = options.timezone ?? 'UTC';
  const cutoff = options.operationalDayCutoff ?? DEFAULT_OPERATIONAL_DAY_CUTOFF;
  const maxDays = options.maxMultiDayValidityDays ?? DEFAULT_MAX_MULTI_DAY_VALIDITY_DAYS;

  try {
    assertMultiDayClaimMatchesSchedule(
      plannedStartAt,
      plannedEndAt,
      options.claimedIsMultiDay,
      timezone,
      cutoff,
    );
  } catch (err) {
    if (err instanceof BadRequestException) {
      const response = err.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : typeof response === 'object' && response && 'message' in response
            ? String((response as { message: unknown }).message)
            : err.message;
      errors.push(message);
    } else {
      throw err;
    }
  }

  const classification = classifySchedule(plannedStartAt, plannedEndAt, timezone, cutoff);
  if (!classification?.isMultiDay) {
    return errors;
  }

  const span = inclusiveOperationalDaySpan(
    classification.startOperationalDate,
    classification.endOperationalDate,
  );
  if (span > maxDays) {
    errors.push(
      `Multi-day schedule spans ${span} operational days; the tenant maximum is ${maxDays}. Shorten the planned end or use renewal after the maximum.`,
    );
  }

  return errors;
}
