import {
  canClearSuspensionViaMdpReopen,
  evaluateClearanceGate,
  isClearedForOperationalDate,
  isSimopsRejectionReason,
  requiresClearedForWorkToday,
} from '../app/src/modules/revalidation/multi-day-clearance';
import {
  bindTodayOperationalDate,
  isDailyReopenRequired,
  resolveReopenDayContext,
} from '../app/src/modules/revalidation/multi-day-reopen';

describe('multi-day clearance (C2–C12)', () => {
  it('treats passed today reopen as cleared', () => {
    expect(
      isClearedForOperationalDate(
        { operationalDate: '2026-08-04', outcome: 'passed' },
        '2026-08-04',
      ),
    ).toBe(true);
    expect(
      isClearedForOperationalDate(
        { operationalDate: '2026-08-04', outcome: 'failed' },
        '2026-08-04',
      ),
    ).toBe(false);
    expect(
      isClearedForOperationalDate(
        { operationalDate: '2026-08-03', outcome: 'passed' },
        '2026-08-04',
      ),
    ).toBe(false);
  });

  it('requires cleared-for-work only when multi-day + daily audit ON (C4/C6)', () => {
    expect(
      requiresClearedForWorkToday({ isMultiDay: true, dailyRevalidationRequired: true }),
    ).toBe(true);
    expect(
      requiresClearedForWorkToday({ isMultiDay: true, dailyRevalidationRequired: false }),
    ).toBe(false);
    expect(
      requiresClearedForWorkToday({ isMultiDay: false, dailyRevalidationRequired: true }),
    ).toBe(false);
  });

  it('evaluates clearance gate', () => {
    expect(
      evaluateClearanceGate({
        isMultiDay: true,
        dailyRevalidationRequired: false,
        operationalDate: '2026-08-04',
        todayRevalidation: null,
      }).allowed,
    ).toBe(true);

    expect(
      evaluateClearanceGate({
        isMultiDay: true,
        dailyRevalidationRequired: true,
        operationalDate: '2026-08-04',
        todayRevalidation: null,
        startOperationalDate: '2026-08-03',
      }),
    ).toEqual({ allowed: false, reason: 'reopen_due' });

    expect(
      evaluateClearanceGate({
        isMultiDay: true,
        dailyRevalidationRequired: true,
        operationalDate: '2026-08-04',
        todayRevalidation: null,
        startOperationalDate: '2026-08-04',
      }),
    ).toEqual({ allowed: true, reason: 'first_day' });

    expect(
      evaluateClearanceGate({
        isMultiDay: true,
        dailyRevalidationRequired: true,
        operationalDate: '2026-08-04',
        todayRevalidation: { operationalDate: '2026-08-04', outcome: 'passed' },
      }),
    ).toEqual({ allowed: true, reason: 'cleared' });

    expect(
      evaluateClearanceGate({
        isMultiDay: true,
        dailyRevalidationRequired: true,
        operationalDate: '2026-08-04',
        todayRevalidation: null,
        overrideUsedToday: true,
      }),
    ).toEqual({ allowed: true, reason: 'override' });
  });

  it('blocks SIMOPS and incident suspensions from MDP clear (C7/C10)', () => {
    expect(
      canClearSuspensionViaMdpReopen({
        source: 'simops',
        reason: 'SIMOPS conflict rejected:abc',
      }),
    ).toBe(false);
    expect(
      canClearSuspensionViaMdpReopen({
        source: 'manual',
        reason: 'SIMOPS conflict rejected:abc',
      }),
    ).toBe(false);
    expect(canClearSuspensionViaMdpReopen({ source: 'incident', reason: 'linked' })).toBe(false);
    expect(
      canClearSuspensionViaMdpReopen({ source: 'failed_revalidation', reason: 'Failed daily reopen' }),
    ).toBe(true);
    expect(canClearSuspensionViaMdpReopen({ source: 'execution', reason: 'paused' })).toBe(true);
    expect(isSimopsRejectionReason('SIMOPS conflict rejected:x')).toBe(true);
  });

  it('keeps reopen today-bound across timezones (C1/C12)', () => {
    const ctx = resolveReopenDayContext(
      new Date('2026-08-03T12:30:00.000Z'),
      'Asia/Kolkata',
      '16:30',
    );
    expect(ctx.operationalDate).toBe('2026-08-03');
    expect(ctx.pastCutoff).toBe(true);
    expect(bindTodayOperationalDate('2026-08-02', ctx).ok).toBe(false);
    expect(
      isDailyReopenRequired({
        isMultiDay: true,
        dailyRevalidationRequired: true,
        endOperationalDate: '2026-08-06',
        currentOperationalDate: '2026-08-03',
      }),
    ).toBe(true);
  });
});
