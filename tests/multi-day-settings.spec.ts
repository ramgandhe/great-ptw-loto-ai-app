import { resolveMultiDayTenantSettings } from '../app/src/modules/revalidation/multi-day-settings';
import { DEFAULT_MULTI_DAY_TENANT_SETTINGS } from '../app/src/modules/revalidation/multi-day.types';

describe('resolveMultiDayTenantSettings', () => {
  it('returns defaults when org is missing', () => {
    expect(resolveMultiDayTenantSettings(null)).toEqual(DEFAULT_MULTI_DAY_TENANT_SETTINGS);
  });

  it('normalises valid org values', () => {
    expect(
      resolveMultiDayTenantSettings({
        maxMultiDayValidityDays: 5,
        operationalDayCutoff: '18:00',
        overtimeApproverRole: 'area-authority',
      }),
    ).toEqual({
      maxMultiDayValidityDays: 5,
      operationalDayCutoff: '18:00',
      overtimeApproverRole: 'area-authority',
    });
  });

  it('falls back on invalid values', () => {
    expect(
      resolveMultiDayTenantSettings({
        maxMultiDayValidityDays: 0,
        operationalDayCutoff: '25:99',
        overtimeApproverRole: 'nobody',
      }),
    ).toEqual(DEFAULT_MULTI_DAY_TENANT_SETTINGS);
  });
});
