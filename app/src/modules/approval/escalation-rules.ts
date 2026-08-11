import type { RiskLevel } from './workflow-rules';

/** FR-PTW-022 — max escalation levels before Administrator blocked flag. */
export const MAX_APPROVAL_ESCALATION_LEVELS = 3;

export type EscalationEvaluation = {
  action: 'none' | 'escalate' | 'block';
  nextLevel: number;
  fallbackRole: string | null;
  reason: string;
};

/**
 * Pure SLA escalation policy (FR-PTW-019–022).
 * Levels 1..3 escalate to configured fallback roles; attempting level 4 blocks.
 */
export function evaluateEscalation(input: {
  now: Date;
  slaDueAt: Date | null;
  slaPausedAt: Date | null;
  escalationLevel: number;
  fallbackRoles: string[] | null | undefined;
}): EscalationEvaluation {
  if (!input.slaDueAt) {
    return { action: 'none', nextLevel: input.escalationLevel, fallbackRole: null, reason: 'no_sla' };
  }
  if (input.slaPausedAt) {
    return {
      action: 'none',
      nextLevel: input.escalationLevel,
      fallbackRole: null,
      reason: 'sla_paused',
    };
  }
  if (input.now.getTime() < input.slaDueAt.getTime()) {
    return {
      action: 'none',
      nextLevel: input.escalationLevel,
      fallbackRole: null,
      reason: 'within_sla',
    };
  }

  const nextLevel = input.escalationLevel + 1;
  if (nextLevel > MAX_APPROVAL_ESCALATION_LEVELS) {
    return {
      action: 'block',
      nextLevel: input.escalationLevel,
      fallbackRole: null,
      reason: 'max_escalation_exceeded',
    };
  }

  const roles = input.fallbackRoles ?? [];
  const fallbackRole = roles[nextLevel - 1] ?? roles[roles.length - 1] ?? null;

  return {
    action: 'escalate',
    nextLevel,
    fallbackRole,
    reason: 'sla_breached',
  };
}

export function isDelegationActive(
  delegation: { startsAt: Date; endsAt: Date; revokedAt: Date | null },
  now: Date,
): boolean {
  if (delegation.revokedAt) {
    return false;
  }
  return now >= delegation.startsAt && now <= delegation.endsAt;
}

export type { RiskLevel };
