import { BadRequestException } from '@nestjs/common';
import {
  assertMultiDayClaimMatchesSchedule,
  inclusiveOperationalDaySpan,
  multiDayScheduleErrors,
} from '../app/src/modules/revalidation/multi-day-schedule-rules';

describe('multi-day schedule rules', () => {
  const tz = 'Asia/Kolkata';
  const monMorning = new Date('2026-08-03T02:30:00.000Z');
  const monEvening = new Date('2026-08-03T14:30:00.000Z');
  const nextWeek = new Date('2026-08-11T11:30:00.000Z'); // Tue week later
  const tueSameWeek = new Date('2026-08-04T11:30:00.000Z');

  it('counts inclusive operational days', () => {
    expect(inclusiveOperationalDaySpan('2026-08-03', '2026-08-03')).toBe(1);
    expect(inclusiveOperationalDaySpan('2026-08-03', '2026-08-09')).toBe(7);
  });

  it('rejects clearing multi-day while dates span days', () => {
    expect(() =>
      assertMultiDayClaimMatchesSchedule(monMorning, tueSameWeek, false, tz, '16:30'),
    ).toThrow(BadRequestException);
  });

  it('allows matching multi-day claim', () => {
    expect(() =>
      assertMultiDayClaimMatchesSchedule(monMorning, tueSameWeek, true, tz, '16:30'),
    ).not.toThrow();
  });

  it('allows same-day schedule with isMultiDay false', () => {
    expect(() =>
      assertMultiDayClaimMatchesSchedule(monMorning, monEvening, false, tz, '16:30'),
    ).not.toThrow();
  });

  it('errors when multi-day span exceeds tenant max', () => {
    const errors = multiDayScheduleErrors(monMorning, nextWeek, {
      timezone: tz,
      operationalDayCutoff: '16:30',
      maxMultiDayValidityDays: 7,
    });
    expect(errors.some((msg) => /maximum is 7/i.test(msg))).toBe(true);
  });

  it('allows multi-day within max days', () => {
    const errors = multiDayScheduleErrors(monMorning, tueSameWeek, {
      timezone: tz,
      operationalDayCutoff: '16:30',
      maxMultiDayValidityDays: 7,
    });
    expect(errors).toEqual([]);
  });
});
