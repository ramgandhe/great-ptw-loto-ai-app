/**
 * Cleared-for-work + suspend/resume ladder (Slice C2–C7, C10).
 */

export const MDP_SUSPENSION_SOURCES = [
  'manual',
  'failed_revalidation',
  'execution',
  'simops',
  'incident',
] as const;

export type MdpSuspensionSource = (typeof MDP_SUSPENSION_SOURCES)[number];

/** Sources that MDP reopen/clear may resume. SIMOPS + incident need their own path. */
export const MDP_RESUMABLE_SUSPENSION_SOURCES: readonly MdpSuspensionSource[] = [
  'manual',
  'failed_revalidation',
  'execution',
];

export function isSimopsRejectionReason(reason: string | null | undefined): boolean {
  return Boolean(reason?.startsWith('SIMOPS conflict rejected:'));
}

export function canClearSuspensionViaMdpReopen(input: {
  source: string;
  reason: string;
}): boolean {
  if (input.source === 'simops' || isSimopsRejectionReason(input.reason)) {
    return false;
  }
  if (input.source === 'incident') {
    return false;
  }
  return (MDP_RESUMABLE_SUSPENSION_SOURCES as readonly string[]).includes(input.source);
}

export type RevalidationClearanceRow = {
  operationalDate: string;
  outcome: string;
  checklist?: Record<string, unknown> | null;
};

/** Passed reopen/revalidation for the operational date = cleared for work that day. */
export function isClearedForOperationalDate(
  row: RevalidationClearanceRow | null | undefined,
  operationalDate: string,
): boolean {
  return Boolean(row && row.operationalDate === operationalDate && row.outcome === 'passed');
}

/**
 * Hard gate: when multi-day + daily audit ON, work needs a passed reopen for today.
 * Audit OFF → gate open (overnight secure still enforced elsewhere).
 * First planned operational day is cleared by approval/activation — reopen starts the morning after overnight secure.
 */
export function requiresClearedForWorkToday(input: {
  isMultiDay: boolean;
  dailyRevalidationRequired: boolean;
}): boolean {
  return input.isMultiDay && input.dailyRevalidationRequired;
}

/** Approval covers day-1 work; reopen is for subsequent operational days. */
export function isFirstOperationalDay(input: {
  operationalDate: string;
  startOperationalDate?: string | null;
}): boolean {
  return Boolean(
    input.startOperationalDate && input.operationalDate === input.startOperationalDate,
  );
}

export function evaluateClearanceGate(input: {
  isMultiDay: boolean;
  dailyRevalidationRequired: boolean;
  operationalDate: string;
  todayRevalidation: RevalidationClearanceRow | null;
  /** Day-scoped emergency override present for this operational date (Slice D). */
  overrideUsedToday?: boolean;
  /** Permit planned start operational date (YYYY-MM-DD). */
  startOperationalDate?: string | null;
}): {
  allowed: boolean;
  reason: 'not_required' | 'cleared' | 'override' | 'first_day' | 'reopen_due';
} {
  if (!requiresClearedForWorkToday(input)) {
    return { allowed: true, reason: 'not_required' };
  }
  if (input.overrideUsedToday) {
    return { allowed: true, reason: 'override' };
  }
  if (isClearedForOperationalDate(input.todayRevalidation, input.operationalDate)) {
    return { allowed: true, reason: 'cleared' };
  }
  if (isFirstOperationalDay(input)) {
    return { allowed: true, reason: 'first_day' };
  }
  return { allowed: false, reason: 'reopen_due' };
}
