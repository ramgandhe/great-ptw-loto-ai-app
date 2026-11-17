import {
  decideDaySecureCountersign,
  isDaySecureComplete,
} from '../app/src/modules/daily-progress/day-secure-countersign';
import {
  eachOperationalDateInclusive,
  hasCompleteSecureForDate,
  hasOutstandingLateSecure,
  isClearedForWorkToday,
  isFinalDaySecure,
  isLateSecure,
  missingPriorSecureDates,
  previousOperationalDate,
  resolveMultiDayCycleState,
  shiftOperationalDate,
} from '../app/src/modules/daily-progress/day-secure-cycle';
import {
  missingDaySecureChecklistKeys,
  resolveDaySecureChecklistMode,
} from '../app/src/modules/daily-progress/day-secure-checklist';

describe('day-secure cycle (B5–B7 / B10)', () => {
  it('shifts and lists operational dates', () => {
    expect(previousOperationalDate('2026-08-04')).toBe('2026-08-03');
    expect(shiftOperationalDate('2026-08-31', 1)).toBe('2026-09-01');
    expect(eachOperationalDateInclusive('2026-08-03', '2026-08-05')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ]);
  });

  it('flags late secure when operational date is before current day', () => {
    expect(isLateSecure('2026-08-03', '2026-08-04')).toBe(true);
    expect(isLateSecure('2026-08-04', '2026-08-04')).toBe(false);
  });

  it('flags final day against end operational date', () => {
    expect(isFinalDaySecure('2026-08-05', '2026-08-05')).toBe(true);
    expect(isFinalDaySecure('2026-08-04', '2026-08-05')).toBe(false);
    expect(isFinalDaySecure('2026-08-05', null)).toBe(false);
  });

  it('reports missing prior secures (late_secure_required)', () => {
    const missing = missingPriorSecureDates({
      startOperationalDate: '2026-08-03',
      endOperationalDate: '2026-08-06',
      currentOperationalDate: '2026-08-05',
      secures: [
        {
          operationalDate: '2026-08-03',
          countersignedBy: null,
          checklist: { countersignRequired: false },
          status: 'submitted',
        },
      ],
    });
    expect(missing).toEqual(['2026-08-04']);
    expect(
      hasOutstandingLateSecure({
        startOperationalDate: '2026-08-03',
        endOperationalDate: '2026-08-06',
        currentOperationalDate: '2026-08-05',
        secures: [
          {
            operationalDate: '2026-08-03',
            countersignedBy: null,
            checklist: { countersignRequired: false },
            status: 'submitted',
          },
        ],
      }),
    ).toBe(true);
  });

  it('treats pending countersign as incomplete for late gate', () => {
    const missing = missingPriorSecureDates({
      startOperationalDate: '2026-08-03',
      endOperationalDate: '2026-08-05',
      currentOperationalDate: '2026-08-04',
      secures: [
        {
          operationalDate: '2026-08-03',
          countersignedBy: null,
          checklist: { countersignRequired: true },
          status: 'pending_countersign',
        },
      ],
    });
    expect(missing).toEqual(['2026-08-03']);
    expect(
      isDaySecureComplete({
        countersignedBy: null,
        checklist: { countersignRequired: true },
      }),
    ).toBe(false);
  });

  it('clears late gate when all prior days have complete secures', () => {
    expect(
      hasOutstandingLateSecure({
        startOperationalDate: '2026-08-03',
        endOperationalDate: '2026-08-06',
        currentOperationalDate: '2026-08-05',
        secures: [
          {
            operationalDate: '2026-08-03',
            countersignedBy: 'a',
            checklist: { countersignRequired: true },
            status: 'submitted',
          },
          {
            operationalDate: '2026-08-04',
            countersignedBy: null,
            checklist: { countersignRequired: false },
            status: 'submitted',
          },
        ],
      }),
    ).toBe(false);
  });

  it('keeps progress-first + countersign + checklist rules coherent', () => {
    expect(resolveDaySecureChecklistMode(true)).toBe('full');
    expect(missingDaySecureChecklistKeys(true, {}, false)).toContain('personnelCleared');
    expect(
      decideDaySecureCountersign({
        dailyRevalidationRequired: false,
        openIsolationsRemain: true,
      }).required,
    ).toBe(true);
  });

  it('B7: shows secure_due when work cleared but EOD secure outstanding', () => {
    const base: Parameters<typeof resolveMultiDayCycleState>[0] = {
      lateSecureRequired: false,
      overrideUsedToday: false,
      todayReopenOutcome: 'passed',
      dailyRevalidationRequired: true,
      isFirstOperationalDay: false,
      onFinalDay: false,
      todaySecureComplete: false,
      pastCutoff: false,
      progressSubmittedToday: false,
    };

    // Morning after reopen: still cleared until progress or cut-off.
    expect(resolveMultiDayCycleState(base)).toBe('cleared');
    expect(
      isClearedForWorkToday({
        lateSecureRequired: false,
        overrideUsedToday: false,
        todayReopenOutcome: 'passed',
        dailyRevalidationRequired: true,
        isFirstOperationalDay: false,
      }),
    ).toBe(true);

    expect(
      resolveMultiDayCycleState({ ...base, progressSubmittedToday: true }),
    ).toBe('secure_due');
    expect(resolveMultiDayCycleState({ ...base, pastCutoff: true })).toBe('secure_due');

    expect(
      resolveMultiDayCycleState({
        ...base,
        pastCutoff: true,
        todaySecureComplete: true,
      }),
    ).toBe('cleared');

    expect(
      resolveMultiDayCycleState({
        ...base,
        todayReopenOutcome: null,
        isFirstOperationalDay: true,
        pastCutoff: true,
      }),
    ).toBe('secure_due');
    expect(
      isClearedForWorkToday({
        lateSecureRequired: false,
        overrideUsedToday: false,
        todayReopenOutcome: null,
        dailyRevalidationRequired: true,
        isFirstOperationalDay: true,
      }),
    ).toBe(true);
  });

  it('B7: reopen_due still wins before secure signalling', () => {
    expect(
      resolveMultiDayCycleState({
        lateSecureRequired: false,
        overrideUsedToday: false,
        todayReopenOutcome: null,
        dailyRevalidationRequired: true,
        isFirstOperationalDay: false,
        onFinalDay: false,
        todaySecureComplete: false,
        pastCutoff: true,
        progressSubmittedToday: true,
      }),
    ).toBe('reopen_due');
  });

  it('detects complete secure for operational date', () => {
    expect(
      hasCompleteSecureForDate(
        [
          {
            operationalDate: '2026-08-04',
            countersignedBy: null,
            checklist: { countersignRequired: false },
            status: 'submitted',
          },
        ],
        '2026-08-04',
      ),
    ).toBe(true);
    expect(
      hasCompleteSecureForDate(
        [
          {
            operationalDate: '2026-08-04',
            countersignedBy: null,
            checklist: { countersignRequired: true },
            status: 'pending_countersign',
          },
        ],
        '2026-08-04',
      ),
    ).toBe(false);
  });
});
