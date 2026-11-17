import {
  actorMayApproveOvertime,
  extensionExceedsMaxValidity,
  overtimeApproverRolesFor,
  validateOvertimeRequestedUntil,
} from '../app/src/modules/revalidation/multi-day-overtime';
import { OVERTIME_APPROVE_ROLES, OVERTIME_REQUEST_ROLES } from '../app/src/modules/revalidation/revalidation.constants';
import { MDP_AUDIT_ACTIONS } from '../app/src/modules/revalidation/mdp-audit-events';

describe('MDP overtime / extension bounds (Slice H)', () => {
  it('exposes overtime RBAC and audit actions', () => {
    expect(OVERTIME_REQUEST_ROLES).toContain('permit-operator');
    expect(OVERTIME_APPROVE_ROLES).toContain('permit-approver');
    expect(MDP_AUDIT_ACTIONS.overtimeRequested).toBe('mdp.overtime_requested');
    expect(MDP_AUDIT_ACTIONS.extensionApproved).toBe('mdp.extension_approved');
  });

  it('H1: overtime must stay on today’s operational date', () => {
    const now = new Date('2026-08-05T10:00:00.000Z');
    const ok = validateOvertimeRequestedUntil({
      now,
      requestedUntil: new Date('2026-08-05T20:00:00.000Z'),
      timezone: 'UTC',
      operationalDayCutoff: '16:30',
    });
    expect(ok).toEqual({ ok: true, operationalDate: '2026-08-05' });

    const nextDay = validateOvertimeRequestedUntil({
      now,
      requestedUntil: new Date('2026-08-06T01:00:00.000Z'),
      timezone: 'UTC',
      operationalDayCutoff: '16:30',
    });
    expect(nextDay.ok).toBe(false);
    if (!nextDay.ok) {
      expect(nextDay.reason).toBe('wrong_day');
    }

    const past = validateOvertimeRequestedUntil({
      now,
      requestedUntil: new Date('2026-08-05T09:00:00.000Z'),
      timezone: 'UTC',
      operationalDayCutoff: '16:30',
    });
    expect(past.ok).toBe(false);
  });

  it('H2: overtime approver routing by tenant setting', () => {
    expect(overtimeApproverRolesFor('permit-approver')).toContain('permit-approver');
    expect(overtimeApproverRolesFor('shift-in-charge')).toContain('shift-in-charge');
    expect(
      actorMayApproveOvertime({
        actorRoles: ['permit-approver'],
        actorId: 'a1',
        setting: 'permit-approver',
        areaAuthorityUserIds: null,
      }),
    ).toBe(true);
    expect(
      actorMayApproveOvertime({
        actorRoles: ['permit-approver'],
        actorId: 'a1',
        setting: 'area-authority',
        areaAuthorityUserIds: ['other'],
      }),
    ).toBe(false);
    expect(
      actorMayApproveOvertime({
        actorRoles: ['permit-approver'],
        actorId: 'a1',
        setting: 'area-authority',
        areaAuthorityUserIds: ['a1'],
      }),
    ).toBe(true);
  });

  it('H5: extension past max validity is detected for renewal path', () => {
    expect(
      extensionExceedsMaxValidity({
        plannedStartAt: new Date('2026-08-01T08:00:00.000Z'),
        requestedEndAt: new Date('2026-08-10T18:00:00.000Z'),
        maxMultiDayValidityDays: 7,
        timezone: 'UTC',
      }),
    ).toBe(true);
    expect(
      extensionExceedsMaxValidity({
        plannedStartAt: new Date('2026-08-01T08:00:00.000Z'),
        requestedEndAt: new Date('2026-08-05T18:00:00.000Z'),
        maxMultiDayValidityDays: 7,
        timezone: 'UTC',
      }),
    ).toBe(false);
  });
});
