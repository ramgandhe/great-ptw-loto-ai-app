/**
 * Same-day overtime bounds (Slice H1).
 * Overtime may run past the operational-day cut-off but must not spill into the next operational day.
 */

import type { OperationalDayCutoff } from './multi-day.types';
import { operationalDateKey } from './permit-validity.service';

export type OvertimeBoundResult =
  | { ok: true; operationalDate: string }
  | {
      ok: false;
      reason: 'wrong_day' | 'not_after_now';
      expectedOperationalDate: string;
      requestedOperationalDate: string;
    };

/**
 * requestedUntil must be after now and still on today's operational date
 * (org timezone calendar day). Cut-off marks overtime territory; it does not
 * extend the day into tomorrow.
 */
export function validateOvertimeRequestedUntil(input: {
  requestedUntil: Date;
  now: Date;
  timezone: string;
  /** Retained for callers / UI; cut-off does not roll the overtime day. */
  operationalDayCutoff: OperationalDayCutoff;
}): OvertimeBoundResult {
  void input.operationalDayCutoff;
  const expectedOperationalDate = operationalDateKey(input.now, input.timezone);
  const requestedOperationalDate = operationalDateKey(input.requestedUntil, input.timezone);

  if (requestedOperationalDate !== expectedOperationalDate) {
    return {
      ok: false,
      reason: 'wrong_day',
      expectedOperationalDate,
      requestedOperationalDate,
    };
  }

  if (input.requestedUntil.getTime() <= input.now.getTime()) {
    return {
      ok: false,
      reason: 'not_after_now',
      expectedOperationalDate,
      requestedOperationalDate,
    };
  }

  return { ok: true, operationalDate: expectedOperationalDate };
}

export function overtimeApproverRolesFor(
  setting: 'permit-approver' | 'area-authority' | 'shift-in-charge',
): readonly string[] {
  if (setting === 'area-authority') {
    return ['permit-approver', 'area-authority', 'tenant-owner', 'tenant-admin', 'platform-admin'];
  }
  if (setting === 'shift-in-charge') {
    return [
      'shift-in-charge',
      'permit-approver',
      'permit-operator',
      'tenant-owner',
      'tenant-admin',
      'platform-admin',
    ];
  }
  return ['permit-approver', 'tenant-owner', 'tenant-admin', 'platform-admin'];
}

export function actorMayApproveOvertime(input: {
  actorRoles: string[];
  actorId: string;
  setting: 'permit-approver' | 'area-authority' | 'shift-in-charge';
  areaAuthorityUserIds: string[] | null;
}): boolean {
  const allowed = overtimeApproverRolesFor(input.setting);
  const hasRole = input.actorRoles.some((role) => allowed.includes(role));
  if (!hasRole) {
    return false;
  }
  if (input.setting === 'area-authority' && input.areaAuthorityUserIds) {
    return (
      input.areaAuthorityUserIds.includes(input.actorId) ||
      input.actorRoles.some((role) =>
        ['tenant-owner', 'tenant-admin', 'platform-admin'].includes(role),
      )
    );
  }
  return true;
}

/** True when requestedEnd would exceed tenant max multi-day validity from planned start. */
export function extensionExceedsMaxValidity(input: {
  plannedStartAt: Date | null | undefined;
  requestedEndAt: Date;
  maxMultiDayValidityDays: number;
  timezone: string;
}): boolean {
  if (!input.plannedStartAt) {
    return false;
  }
  const startKey = operationalDateKey(input.plannedStartAt, input.timezone);
  const endKey = operationalDateKey(input.requestedEndAt, input.timezone);
  const startMs = Date.parse(`${startKey}T00:00:00.000Z`);
  const endMs = Date.parse(`${endKey}T00:00:00.000Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return false;
  }
  const span = Math.round((endMs - startMs) / 86_400_000) + 1;
  return span > input.maxMultiDayValidityDays;
}
