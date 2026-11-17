import {
  decideDaySecureCountersign,
  isDaySecureComplete,
  isOvernightOpenIsolationStatus,
} from '../app/src/modules/daily-progress/day-secure-countersign';

describe('day-secure countersign (B4)', () => {
  it('requires countersign when daily audit ON', () => {
    expect(
      decideDaySecureCountersign({
        dailyRevalidationRequired: true,
        openIsolationsRemain: false,
      }),
    ).toEqual({ required: true, reasons: ['daily_audit'] });
  });

  it('requires countersign when open isolations remain (even if audit OFF)', () => {
    expect(
      decideDaySecureCountersign({
        dailyRevalidationRequired: false,
        openIsolationsRemain: true,
      }),
    ).toEqual({ required: true, reasons: ['open_isolations'] });
  });

  it('allows executor-only when audit OFF and no open isolations', () => {
    expect(
      decideDaySecureCountersign({
        dailyRevalidationRequired: false,
        openIsolationsRemain: false,
      }),
    ).toEqual({ required: false, reasons: [] });
  });

  it('lists both reasons when both apply', () => {
    expect(
      decideDaySecureCountersign({
        dailyRevalidationRequired: true,
        openIsolationsRemain: true,
      }).reasons,
    ).toEqual(['daily_audit', 'open_isolations']);
  });

  it('recognises overnight open isolation statuses', () => {
    expect(isOvernightOpenIsolationStatus('isolated_verified')).toBe(true);
    expect(isOvernightOpenIsolationStatus('restoration_in_progress')).toBe(true);
    expect(isOvernightOpenIsolationStatus('restored_verified')).toBe(false);
    expect(isOvernightOpenIsolationStatus('closed')).toBe(false);
  });

  it('treats secure complete when countersign not required or applied', () => {
    expect(isDaySecureComplete({ countersignedBy: null, checklist: {} })).toBe(true);
    expect(
      isDaySecureComplete({
        countersignedBy: null,
        checklist: { countersignRequired: true },
      }),
    ).toBe(false);
    expect(
      isDaySecureComplete({
        countersignedBy: 'user-2',
        checklist: { countersignRequired: true },
      }),
    ).toBe(true);
  });
});
