import {
  classifyMaxValidity,
  classifyPermitValidity,
  hoursRemaining,
  operationalDateKey,
  PERMIT_RENEWAL_THRESHOLD_MS,
} from '../app/src/modules/revalidation/permit-validity.service';

describe('Permit validity classification (FR-MDP-009)', () => {
  const endAt = new Date('2026-08-01T12:00:00.000Z');

  it('returns within_validity when more than 48 hours remain', () => {
    const now = new Date(endAt.getTime() - PERMIT_RENEWAL_THRESHOLD_MS - 60_000);
    expect(classifyPermitValidity(endAt, now)).toBe('within_validity');
    expect(hoursRemaining(endAt, now)).toBeGreaterThan(48);
  });

  it('returns renewal_due when less than 48 hours remain', () => {
    const now = new Date(endAt.getTime() - 24 * 60 * 60 * 1000);
    expect(classifyPermitValidity(endAt, now)).toBe('renewal_due');
    expect(hoursRemaining(endAt, now)).toBe(24);
  });

  it('returns expired when planned end is in the past', () => {
    const now = new Date(endAt.getTime() + 1_000);
    expect(classifyPermitValidity(endAt, now)).toBe('expired');
    expect(hoursRemaining(endAt, now)).toBeLessThanOrEqual(0);
  });

  it('treats missing end date as within validity', () => {
    expect(classifyPermitValidity(null)).toBe('within_validity');
    expect(hoursRemaining(null)).toBeNull();
  });

  it('formats operational date in tenant timezone', () => {
    const utcMidnight = new Date('2026-08-01T00:30:00.000Z');
    expect(operationalDateKey(utcMidnight, 'UTC')).toBe('2026-08-01');
    expect(operationalDateKey(utcMidnight, 'Asia/Kolkata')).toBe('2026-08-01');
  });

  it('accepts ISO strings from Redis-cached permits', () => {
    expect(operationalDateKey('2026-08-01T00:30:00.000Z', 'UTC')).toBe('2026-08-01');
    expect(operationalDateKey('2026-11-13T11:30:00.000Z', 'Asia/Kolkata')).toBe('2026-11-13');
  });
});

describe('Max validity classification (Slice I1)', () => {
  const start = new Date('2026-08-01T08:00:00.000Z');

  it('stays within_max while elapsed days are at or under the tenant max', () => {
    const day7 = new Date('2026-08-07T10:00:00.000Z');
    expect(
      classifyMaxValidity({
        plannedStartAt: start,
        now: day7,
        timezone: 'UTC',
        maxMultiDayValidityDays: 7,
      }),
    ).toBe('within_max');
  });

  it('flags max_validity_due when elapsed days exceed the tenant max', () => {
    const day8 = new Date('2026-08-08T10:00:00.000Z');
    expect(
      classifyMaxValidity({
        plannedStartAt: start,
        now: day8,
        timezone: 'UTC',
        maxMultiDayValidityDays: 7,
      }),
    ).toBe('max_validity_due');
  });

  it('flags max_validity_due when the planned schedule itself exceeds max', () => {
    const endBeyond = new Date('2026-08-12T16:00:00.000Z');
    expect(
      classifyMaxValidity({
        plannedStartAt: start,
        plannedEndAt: endBeyond,
        now: new Date('2026-08-02T10:00:00.000Z'),
        timezone: 'UTC',
        maxMultiDayValidityDays: 7,
      }),
    ).toBe('max_validity_due');
  });

  it('treats missing start as within_max', () => {
    expect(
      classifyMaxValidity({
        plannedStartAt: null,
        maxMultiDayValidityDays: 7,
      }),
    ).toBe('within_max');
  });
});
