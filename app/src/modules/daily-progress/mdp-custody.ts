/**
 * Wave 3 D4: hard MDP custody after shift handover.
 * Soft presentation already exposes custodyHeldBy; this enforces write gates.
 */

import { normalizeHandoverStatus } from './shift-handover';

/** Roles that may act without being the custody holder (supervision / admin). */
export const MDP_CUSTODY_BYPASS_ROLES = [
  'permit-approver',
  'tenant-owner',
  'tenant-admin',
  'platform-admin',
] as const;

export type HandoverCustodyRow = {
  status: string;
  outgoingUserId: string;
  incomingUserId: string;
  handedOverAt: Date | string;
};

export function custodyHeldByFromHandover(
  row: HandoverCustodyRow | null | undefined,
): string | null {
  if (!row) {
    return null;
  }
  const status = normalizeHandoverStatus(row.status);
  if (status === 'pending_acceptance') {
    return row.outgoingUserId;
  }
  if (status === 'accepted') {
    return row.incomingUserId;
  }
  // Rejected — custody stays with outgoing (no transfer).
  return row.outgoingUserId;
}

/** Latest non-rejected handover drives custody; pending blocks transfer. */
export function resolveActiveCustodyHolder(
  handovers: HandoverCustodyRow[],
): string | null {
  const ordered = [...handovers].sort((a, b) => {
    const aAt = new Date(a.handedOverAt).getTime();
    const bAt = new Date(b.handedOverAt).getTime();
    return bAt - aAt;
  });

  for (const row of ordered) {
    const status = normalizeHandoverStatus(row.status);
    if (status === 'rejected') {
      continue;
    }
    return custodyHeldByFromHandover(row);
  }
  return null;
}

export function actorHasCustodyBypass(roles: string[] | null | undefined): boolean {
  const set = new Set(roles ?? []);
  return MDP_CUSTODY_BYPASS_ROLES.some((role) => set.has(role));
}

export function canMutateUnderCustody(input: {
  actorId: string;
  roles: string[] | null | undefined;
  custodyHeldBy: string | null;
  hardCustodyEnforced: boolean;
}): boolean {
  if (!input.hardCustodyEnforced) {
    return true;
  }
  if (!input.custodyHeldBy) {
    // No handover chain yet — any authorised MDP writer may act.
    return true;
  }
  if (input.actorId === input.custodyHeldBy) {
    return true;
  }
  return actorHasCustodyBypass(input.roles);
}
