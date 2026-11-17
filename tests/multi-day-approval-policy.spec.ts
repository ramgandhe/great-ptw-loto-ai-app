import { resolveApprovalMultiDayPolicy } from '../app/src/modules/approval/multi-day-approval-policy';

describe('resolveApprovalMultiDayPolicy', () => {
  it('returns null when permit is not multi-day', () => {
    expect(
      resolveApprovalMultiDayPolicy(false, {
        dailyRevalidationRequired: false,
        emergencyOverrideAllowed: false,
      }),
    ).toBeNull();
  });

  it('defaults both flags to true for multi-day', () => {
    expect(resolveApprovalMultiDayPolicy(true, {})).toEqual({
      dailyRevalidationRequired: true,
      emergencyOverrideAllowed: true,
    });
  });

  it('honours explicit multi-day choices', () => {
    expect(
      resolveApprovalMultiDayPolicy(true, {
        dailyRevalidationRequired: false,
        emergencyOverrideAllowed: false,
      }),
    ).toEqual({
      dailyRevalidationRequired: false,
      emergencyOverrideAllowed: false,
    });
  });
});
