import {
  bindTodayOperationalDate,
  isDailyReopenRequired,
  resolveReopenDayContext,
} from '../app/src/modules/revalidation/multi-day-reopen';

describe('multi-day reopen today-bound (C1)', () => {
  // Mon 3 Aug 2026 10:00 IST
  const monMorningIst = new Date('2026-08-03T04:30:00.000Z');
  // Mon 3 Aug 2026 18:00 IST (past 16:30 cut-off)
  const monEveningIst = new Date('2026-08-03T12:30:00.000Z');

  it('resolves operational date in organisation timezone', () => {
    const ctx = resolveReopenDayContext(monMorningIst, 'Asia/Kolkata', '16:30');
    expect(ctx.operationalDate).toBe('2026-08-03');
    expect(ctx.timezone).toBe('Asia/Kolkata');
    expect(ctx.pastCutoff).toBe(false);
  });

  it('flags past cut-off without rolling the operational date', () => {
    const ctx = resolveReopenDayContext(monEveningIst, 'Asia/Kolkata', '16:30');
    expect(ctx.operationalDate).toBe('2026-08-03');
    expect(ctx.pastCutoff).toBe(true);
  });

  it('binds reopen to today and rejects other dates', () => {
    const ctx = resolveReopenDayContext(monMorningIst, 'Asia/Kolkata', '16:30');
    expect(bindTodayOperationalDate(undefined, ctx)).toEqual({
      ok: true,
      operationalDate: '2026-08-03',
    });
    expect(bindTodayOperationalDate('2026-08-03', ctx)).toEqual({
      ok: true,
      operationalDate: '2026-08-03',
    });
    expect(bindTodayOperationalDate('2026-08-02', ctx)).toEqual({
      ok: false,
      expected: '2026-08-03',
      requested: '2026-08-02',
    });
  });

  it('requires daily reopen only for multi-day with audit ON', () => {
    expect(
      isDailyReopenRequired({
        isMultiDay: true,
        dailyRevalidationRequired: true,
        endOperationalDate: '2026-08-06',
        currentOperationalDate: '2026-08-04',
      }),
    ).toBe(true);

    expect(
      isDailyReopenRequired({
        isMultiDay: true,
        dailyRevalidationRequired: false,
        endOperationalDate: '2026-08-06',
        currentOperationalDate: '2026-08-04',
      }),
    ).toBe(false);

    expect(
      isDailyReopenRequired({
        isMultiDay: false,
        dailyRevalidationRequired: true,
        endOperationalDate: '2026-08-03',
        currentOperationalDate: '2026-08-03',
      }),
    ).toBe(false);

    expect(
      isDailyReopenRequired({
        isMultiDay: true,
        dailyRevalidationRequired: true,
        endOperationalDate: '2026-08-05',
        currentOperationalDate: '2026-08-06',
      }),
    ).toBe(false);
  });
});
