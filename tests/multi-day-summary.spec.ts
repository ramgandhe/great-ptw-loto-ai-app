import { buildMultiDaySummary } from '../app/src/modules/revalidation/multi-day-summary';

describe('buildMultiDaySummary', () => {
  it('marks multi-day when dates span calendar days', () => {
    const summary = buildMultiDaySummary(
      {
        plannedStartAt: new Date('2026-08-03T02:30:00.000Z'), // Mon 08:00 IST
        plannedEndAt: new Date('2026-08-04T11:30:00.000Z'), // Tue 17:00 IST
        dailyRevalidationRequired: true,
        emergencyOverrideAllowed: false,
      },
      {
        timezone: 'Asia/Kolkata',
        maxMultiDayValidityDays: 5,
        operationalDayCutoff: '16:30',
      },
    );

    expect(summary.isMultiDay).toBe(true);
    expect(summary.startOperationalDate).toBe('2026-08-03');
    expect(summary.endOperationalDate).toBe('2026-08-04');
    expect(summary.endPastCutoffSameDay).toBe(false);
    expect(summary.dailyRevalidationRequired).toBe(true);
    expect(summary.emergencyOverrideAllowed).toBe(false);
    expect(summary.maxMultiDayValidityDays).toBe(5);
    expect(summary.timezone).toBe('Asia/Kolkata');
  });

  it('flags same-day overtime territory without multi-day', () => {
    const summary = buildMultiDaySummary(
      {
        plannedStartAt: new Date('2026-08-03T02:30:00.000Z'),
        plannedEndAt: new Date('2026-08-03T14:30:00.000Z'), // Mon 20:00 IST
      },
      { timezone: 'Asia/Kolkata', operationalDayCutoff: '16:30' },
    );

    expect(summary.isMultiDay).toBe(false);
    expect(summary.endPastCutoffSameDay).toBe(true);
    expect(summary.dailyRevalidationRequired).toBe(true);
    expect(summary.emergencyOverrideAllowed).toBe(true);
  });
});
