import type { DayCycleState } from '../revalidation/multi-day.types';
import { isDayCycleState } from '../revalidation/multi-day.types';

/** Multi-day workspace section anchors (Slice F3/F4). */
export const DAY_CYCLE_ACTION_HASHES = {
  late_secure_required: 'late-secure',
  secure_due: 'day-secure',
  reopen_due: 'reopen',
  failed_reopen: 'reopen',
  override_used: 'reopen',
  cleared: 'progress',
  closed_path: 'day-secure',
  not_multi_day: 'progress',
} as const satisfies Record<DayCycleState, string>;

export type DayCycleAction = {
  key: DayCycleState;
  hash: string;
  label: string;
  href: string;
};

const STATE_LABELS: Record<DayCycleState, string> = {
  not_multi_day: 'Single-day',
  secure_due: 'Secure due',
  late_secure_required: 'Late secure',
  reopen_due: 'Reopen due',
  cleared: 'Cleared today',
  failed_reopen: 'Failed reopen',
  override_used: 'Override used',
  closed_path: 'Final day',
};

export function dayCycleStateLabel(state: string): string {
  if (isDayCycleState(state)) {
    return STATE_LABELS[state];
  }
  return state.replace(/_/g, ' ');
}

/**
 * 1-based day index within the multi-day window (inclusive of start).
 * Clamped to [1, maxDays] when maxDays is provided.
 */
export function dayNumberOfWindow(params: {
  startOperationalDate: string | null | undefined;
  currentOperationalDate: string | null | undefined;
  maxDays?: number | null;
}): number | null {
  const { startOperationalDate, currentOperationalDate, maxDays } = params;
  if (!startOperationalDate || !currentOperationalDate) {
    return null;
  }
  const start = Date.parse(`${startOperationalDate}T00:00:00Z`);
  const current = Date.parse(`${currentOperationalDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(current) || current < start) {
    return null;
  }
  const day = Math.floor((current - start) / 86_400_000) + 1;
  if (maxDays && maxDays > 0) {
    return Math.min(Math.max(day, 1), maxDays);
  }
  return day;
}

export function buildDayCycleAction(
  permitId: string,
  state: string,
): DayCycleAction {
  const key: DayCycleState = isDayCycleState(state) ? state : 'not_multi_day';
  const hash = DAY_CYCLE_ACTION_HASHES[key];
  return {
    key,
    hash,
    label: dayCycleStateLabel(key),
    href: `/permits/${permitId}?tab=work`,
  };
}
