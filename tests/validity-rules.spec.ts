import {
  evaluateValidityDecision,
  operationalDateInTimezone,
} from '../app/src/modules/revalidation/validity-rules';

describe('FR-MDP-009 validity rules (PUS-242)', () => {
  const start = new Date('2026-08-01T00:00:00.000Z');

  it('returns ok_gt_48h when more than 48 hours remain', () => {
    const end = new Date('2026-08-10T00:00:00.000Z');
    const now = new Date('2026-08-05T00:00:00.000Z');
    expect(evaluateValidityDecision(start, end, now)).toEqual({
      decision: 'ok_gt_48h',
      remainingHours: 120,
    });
  });

  it('treats exactly 48h as renew_notify_lte_48h', () => {
    const end = new Date('2026-08-07T00:00:00.000Z');
    const now = new Date('2026-08-05T00:00:00.000Z');
    expect(evaluateValidityDecision(start, end, now).decision).toBe('renew_notify_lte_48h');
  });

  it('returns renew_notify_lte_48h when under 48 hours remain', () => {
    const end = new Date('2026-08-06T12:00:00.000Z');
    const now = new Date('2026-08-05T00:00:00.000Z');
    expect(evaluateValidityDecision(start, end, now).decision).toBe('renew_notify_lte_48h');
  });

  it('returns expired when past planned end', () => {
    const end = new Date('2026-08-04T00:00:00.000Z');
    const now = new Date('2026-08-05T00:00:00.000Z');
    const result = evaluateValidityDecision(start, end, now);
    expect(result.decision).toBe('expired');
    expect(result.remainingHours).toBeLessThan(0);
  });

  it('returns out_of_range when planned end is missing', () => {
    expect(evaluateValidityDecision(start, null, new Date()).decision).toBe('out_of_range');
  });

  it('computes operational date in tenant timezone around midnight', () => {
    // 2026-08-05 23:30 UTC = 2026-08-06 05:00 in Asia/Kolkata
    const nearMidnightUtc = new Date('2026-08-05T23:30:00.000Z');
    expect(operationalDateInTimezone(nearMidnightUtc, 'UTC')).toBe('2026-08-05');
    expect(operationalDateInTimezone(nearMidnightUtc, 'Asia/Kolkata')).toBe('2026-08-06');
  });

  it('falls back to UTC for invalid timezone', () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    expect(operationalDateInTimezone(now, 'Not/AZone')).toBe('2026-08-11');
  });
});
