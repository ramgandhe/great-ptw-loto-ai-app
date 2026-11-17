import { HANDOVER_ACCEPT_ROLES } from '../app/src/modules/revalidation/revalidation.constants';
import { MDP_AUDIT_ACTIONS } from '../app/src/modules/revalidation/mdp-audit-events';
import {
  assertCanDecideHandover,
  canCancelHandover,
  handoverBlocksNewSubmit,
  isHandoverPending,
  normalizeHandoverStatus,
} from '../app/src/modules/daily-progress/shift-handover';

describe('MDP dual handover (Slice E)', () => {
  it('exposes accept RBAC and audit actions (E1/E2)', () => {
    expect(HANDOVER_ACCEPT_ROLES).toContain('permit-operator');
    expect(HANDOVER_ACCEPT_ROLES).not.toContain('viewer');
    expect(MDP_AUDIT_ACTIONS.handoverCompleted).toBe('mdp.handover.completed');
    expect(MDP_AUDIT_ACTIONS.handoverAccepted).toBe('mdp.handover.accepted');
    expect(MDP_AUDIT_ACTIONS.handoverRejected).toBe('mdp.handover.rejected');
    expect(MDP_AUDIT_ACTIONS.handoverCancelled).toBe('mdp.handover.cancelled');
  });

  it('normalizes legacy submitted status to accepted (E4)', () => {
    expect(normalizeHandoverStatus('submitted')).toBe('accepted');
    expect(normalizeHandoverStatus('pending_acceptance')).toBe('pending_acceptance');
    expect(normalizeHandoverStatus('accepted')).toBe('accepted');
    expect(normalizeHandoverStatus('rejected')).toBe('rejected');
    expect(normalizeHandoverStatus('cancelled')).toBe('cancelled');
  });

  it('pending blocks new submit until decide (E2 custody)', () => {
    expect(isHandoverPending('pending_acceptance')).toBe(true);
    expect(handoverBlocksNewSubmit('pending_acceptance')).toBe(true);
    expect(handoverBlocksNewSubmit('accepted')).toBe(false);
    expect(handoverBlocksNewSubmit('rejected')).toBe(false);
    expect(handoverBlocksNewSubmit('cancelled')).toBe(false);
    expect(handoverBlocksNewSubmit('submitted')).toBe(false);
  });

  it('only incoming may accept or reject while pending', () => {
    const base = {
      status: 'pending_acceptance',
      outgoingUserId: 'out',
      incomingUserId: 'in',
    };
    expect(assertCanDecideHandover({ ...base, actorId: 'in' })).toEqual({ ok: true });
    expect(assertCanDecideHandover({ ...base, actorId: 'out' })).toEqual({
      ok: false,
      reason: 'self_outgoing',
    });
    expect(assertCanDecideHandover({ ...base, actorId: 'other' })).toEqual({
      ok: false,
      reason: 'not_incoming',
    });
    expect(
      assertCanDecideHandover({
        ...base,
        status: 'accepted',
        actorId: 'in',
      }),
    ).toEqual({ ok: false, reason: 'not_pending' });
  });

  it('only outgoing may cancel a pending handover', () => {
    expect(
      canCancelHandover({
        status: 'pending_acceptance',
        outgoingUserId: 'out',
        actorId: 'out',
      }),
    ).toBe(true);
    expect(
      canCancelHandover({
        status: 'pending_acceptance',
        outgoingUserId: 'out',
        actorId: 'in',
      }),
    ).toBe(false);
    expect(
      canCancelHandover({ status: 'accepted', outgoingUserId: 'out', actorId: 'out' }),
    ).toBe(false);
  });
});
