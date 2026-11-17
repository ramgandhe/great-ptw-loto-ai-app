import {
  DAY_CYCLE_STATES,
  DEFAULT_MULTI_DAY_PERMIT_POLICY,
  DEFAULT_MULTI_DAY_TENANT_SETTINGS,
  isDayCycleState,
  isTimeFlowKind,
} from '../app/src/modules/revalidation/multi-day.types';
import { MDP_AUDIT_ACTIONS } from '../app/src/modules/revalidation/mdp-audit-events';
import {
  DAY_SECURE_WRITE_ROLES,
  MDP_OVERRIDE_ROLES,
  OVERTIME_APPROVE_ROLES,
  OVERTIME_REQUEST_ROLES,
} from '../app/src/modules/revalidation/revalidation.constants';

describe('MDP Slice A constants', () => {
  it('exposes day-cycle and time-flow guards', () => {
    expect(isDayCycleState('cleared')).toBe(true);
    expect(isDayCycleState('nope')).toBe(false);
    expect(isTimeFlowKind('overtime')).toBe(true);
    expect(DAY_CYCLE_STATES).toContain('late_secure_required');
  });

  it('keeps hard-gate defaults', () => {
    expect(DEFAULT_MULTI_DAY_PERMIT_POLICY).toEqual({
      dailyRevalidationRequired: true,
      emergencyOverrideAllowed: true,
    });
    expect(DEFAULT_MULTI_DAY_TENANT_SETTINGS.operationalDayCutoff).toBe('16:30');
    expect(DEFAULT_MULTI_DAY_TENANT_SETTINGS.maxMultiDayValidityDays).toBe(7);
  });

  it('lists required audit actions for later slices', () => {
    expect(MDP_AUDIT_ACTIONS.daySecured).toBe('mdp.day_secured');
    expect(MDP_AUDIT_ACTIONS.daySecureCountersigned).toBe('mdp.day_secure_countersigned');
    expect(MDP_AUDIT_ACTIONS.lateSecureRecorded).toBe('mdp.late_secure_recorded');
    expect(MDP_AUDIT_ACTIONS.permitCleared).toBe('mdp.permit_cleared');
    expect(MDP_AUDIT_ACTIONS.overrideUsed).toBe('mdp.override_used');
    expect(MDP_AUDIT_ACTIONS.overtimeRequested).toBe('mdp.overtime_requested');
    expect(MDP_AUDIT_ACTIONS.handoverAccepted).toBe('mdp.handover.accepted');
  });

  it('defines RBAC role sets for secure, override and overtime', () => {
    expect(DAY_SECURE_WRITE_ROLES).toContain('permit-operator');
    expect(MDP_OVERRIDE_ROLES).toContain('permit-approver');
    expect(OVERTIME_REQUEST_ROLES).toContain('permit-receiver');
    expect(OVERTIME_APPROVE_ROLES).toContain('permit-approver');
  });
});
