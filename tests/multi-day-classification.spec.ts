import {
  classifySchedule,
  isMultiDay,
  isPastOperationalCutoff,
} from '../app/src/modules/revalidation/multi-day-classification';
import { cutoffToMinutes } from '../app/src/modules/revalidation/multi-day.types';

describe('multi-day classification', () => {
  const tz = 'Asia/Kolkata';

  // Mon 3 Aug 2026 08:00 IST
  const monMorning = new Date('2026-08-03T02:30:00.000Z');
  // Mon 3 Aug 2026 20:00 IST (past 16:30 cut-off, same calendar day)
  const monEvening = new Date('2026-08-03T14:30:00.000Z');
  // Tue 4 Aug 2026 17:00 IST
  const tueAfternoon = new Date('2026-08-04T11:30:00.000Z');
  // Mon 3 Aug 2026 16:30 IST (exactly at cut-off)
  const monCutoff = new Date('2026-08-03T11:00:00.000Z');
  // Mon 3 Aug 2026 16:29 IST
  const monBeforeCutoff = new Date('2026-08-03T10:59:00.000Z');

  it('parses default cut-off 16:30 as minutes', () => {
    expect(cutoffToMinutes('16:30')).toBe(16 * 60 + 30);
    expect(cutoffToMinutes('invalid')).toBe(16 * 60 + 30);
  });

  it('treats same calendar day past cut-off as single-day overtime territory', () => {
    const result = classifySchedule(monMorning, monEvening, tz, '16:30');
    expect(result).toEqual({
      isMultiDay: false,
      startOperationalDate: '2026-08-03',
      endOperationalDate: '2026-08-03',
      endPastCutoffSameDay: true,
    });
    expect(isMultiDay(monMorning, monEvening, tz, '16:30')).toBe(false);
  });

  it('treats spans across calendar days as multi-day', () => {
    const result = classifySchedule(monMorning, tueAfternoon, tz, '16:30');
    expect(result?.isMultiDay).toBe(true);
    expect(result?.startOperationalDate).toBe('2026-08-03');
    expect(result?.endOperationalDate).toBe('2026-08-04');
    expect(result?.endPastCutoffSameDay).toBe(false);
    expect(isMultiDay(monMorning, tueAfternoon, tz, '16:30')).toBe(true);
  });

  it('does not flag overtime when end is before cut-off same day', () => {
    const result = classifySchedule(monMorning, monBeforeCutoff, tz, '16:30');
    expect(result?.isMultiDay).toBe(false);
    expect(result?.endPastCutoffSameDay).toBe(false);
  });

  it('treats end exactly at cut-off as past cut-off', () => {
    expect(isPastOperationalCutoff(monCutoff, tz, '16:30')).toBe(true);
    expect(isPastOperationalCutoff(monBeforeCutoff, tz, '16:30')).toBe(false);
  });

  it('returns null when start or end is missing', () => {
    expect(classifySchedule(null, monEvening, tz)).toBeNull();
    expect(isMultiDay(monMorning, undefined, tz)).toBe(false);
  });
});
