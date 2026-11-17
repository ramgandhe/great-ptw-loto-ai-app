import type { HandoverStatus } from '../../database/schema/multi-day';

/** Legacy one-way rows used `submitted`; treat as accepted (E4). */
export function normalizeHandoverStatus(status: string): Exclude<HandoverStatus, 'submitted'> {
  if (status === 'submitted') {
    return 'accepted';
  }
  if (
    status === 'pending_acceptance' ||
    status === 'accepted' ||
    status === 'rejected' ||
    status === 'cancelled'
  ) {
    return status;
  }
  return 'accepted';
}

export function canCancelHandover(input: {
  status: string;
  outgoingUserId: string;
  actorId: string;
}): boolean {
  return isHandoverPending(input.status) && input.outgoingUserId === input.actorId;
}

export function isHandoverPending(status: string): boolean {
  return normalizeHandoverStatus(status) === 'pending_acceptance';
}

/** Custody stays with outgoing until incoming accepts. */
export function handoverBlocksNewSubmit(status: string): boolean {
  return isHandoverPending(status);
}

export type HandoverDecisionContext = {
  status: string;
  outgoingUserId: string;
  incomingUserId: string;
  actorId: string;
};

export function assertCanDecideHandover(
  ctx: HandoverDecisionContext,
): { ok: true } | { ok: false; reason: 'not_pending' | 'not_incoming' | 'self_outgoing' } {
  if (!isHandoverPending(ctx.status)) {
    return { ok: false, reason: 'not_pending' };
  }
  if (ctx.actorId === ctx.outgoingUserId) {
    return { ok: false, reason: 'self_outgoing' };
  }
  if (ctx.actorId !== ctx.incomingUserId) {
    return { ok: false, reason: 'not_incoming' };
  }
  return { ok: true };
}
