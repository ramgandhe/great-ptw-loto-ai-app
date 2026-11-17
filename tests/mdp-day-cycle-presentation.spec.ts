import {
  buildDayCycleAction,
  DAY_CYCLE_ACTION_HASHES,
  dayCycleStateLabel,
  dayNumberOfWindow,
} from '../app/src/modules/daily-progress/day-cycle-presentation';
import { DAY_CYCLE_STATES } from '../app/src/modules/revalidation/multi-day.types';

describe('MDP day-cycle presentation (Slice F)', () => {
  it('labels every day-cycle state', () => {
    for (const state of DAY_CYCLE_STATES) {
      expect(dayCycleStateLabel(state).length).toBeGreaterThan(0);
      expect(DAY_CYCLE_ACTION_HASHES[state]).toBeTruthy();
    }
  });

  it('builds deep-link action for late secure (F4)', () => {
    const action = buildDayCycleAction('permit-1', 'late_secure_required');
    expect(action.hash).toBe('late-secure');
    expect(action.href).toBe('/permits/permit-1?tab=work');
    expect(action.label).toBe('Late secure');
  });

  it('computes Day N of window (F5)', () => {
    expect(
      dayNumberOfWindow({
        startOperationalDate: '2026-08-01',
        currentOperationalDate: '2026-08-01',
        maxDays: 7,
      }),
    ).toBe(1);
    expect(
      dayNumberOfWindow({
        startOperationalDate: '2026-08-01',
        currentOperationalDate: '2026-08-03',
        maxDays: 7,
      }),
    ).toBe(3);
    expect(
      dayNumberOfWindow({
        startOperationalDate: '2026-08-01',
        currentOperationalDate: '2026-08-20',
        maxDays: 7,
      }),
    ).toBe(7);
    expect(
      dayNumberOfWindow({
        startOperationalDate: null,
        currentOperationalDate: '2026-08-03',
      }),
    ).toBeNull();
  });
});
