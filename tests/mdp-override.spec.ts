import { DAY_CYCLE_STATES } from '../app/src/modules/revalidation/multi-day.types';
import { evaluateClearanceGate } from '../app/src/modules/revalidation/multi-day-clearance';
import { MDP_AUDIT_ACTIONS } from '../app/src/modules/revalidation/mdp-audit-events';
import { MDP_OVERRIDE_ROLES } from '../app/src/modules/revalidation/revalidation.constants';

describe('MDP emergency override (Slice D)', () => {
  it('exposes override RBAC and audit action', () => {
    expect(MDP_OVERRIDE_ROLES).toContain('permit-approver');
    expect(MDP_OVERRIDE_ROLES).not.toContain('viewer');
    expect(MDP_AUDIT_ACTIONS.overrideUsed).toBe('mdp.override_used');
  });

  it('includes override_used in day-cycle states (D4 badge)', () => {
    expect(DAY_CYCLE_STATES).toContain('override_used');
  });

  it('allows clearance gate via day-scoped override (D1)', () => {
    const gate = evaluateClearanceGate({
      isMultiDay: true,
      dailyRevalidationRequired: true,
      operationalDate: '2026-08-05',
      todayRevalidation: null,
      overrideUsedToday: true,
    });
    expect(gate).toEqual({ allowed: true, reason: 'override' });
  });

  it('still blocks when override not used and reopen missing (D2 path leaves gate hard)', () => {
    expect(
      evaluateClearanceGate({
        isMultiDay: true,
        dailyRevalidationRequired: true,
        operationalDate: '2026-08-05',
        todayRevalidation: null,
        overrideUsedToday: false,
      }).allowed,
    ).toBe(false);
  });
});
