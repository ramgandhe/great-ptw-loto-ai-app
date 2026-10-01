import { fromStoredStep, toDateInputValue, toStoredStep } from '../mobile/src/lib/permit/form';

describe('mobile permit form (S0a)', () => {
  it('round-trips a stored instant through the local date field without shifting it', () => {
    // Fails with the old UTC slice in any time zone other than UTC (this machine runs IST).
    const stored = '2026-10-02T02:30:00.000Z';
    expect(new Date(toDateInputValue(stored)).toISOString()).toBe(stored);
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('not a date')).toBe('');
  });

  it('maps the web step index the server stores onto the steps this app renders, and back', () => {
    // Web: 0 basic, 1 location, 2 on-site, 3 crew, 4 forms, 5 review. Mobile: 0-3 the same, 4 review.
    expect([0, 1, 2, 3, 4, 5].map(fromStoredStep)).toEqual([0, 1, 2, 3, 4, 4]);
    expect([0, 1, 2, 3, 4].map(toStoredStep)).toEqual([0, 1, 2, 3, 5]);
  });
});
