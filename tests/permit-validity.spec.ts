import {
  classifyPermitValidity,
  hoursRemaining,
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
});
