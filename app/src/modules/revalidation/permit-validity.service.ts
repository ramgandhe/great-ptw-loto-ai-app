/** Hours remaining below which the issuer must be notified to renew (FR-MDP-009). */
export const PERMIT_RENEWAL_THRESHOLD_MS = 48 * 60 * 60 * 1000;

export type PermitValidityState = 'within_validity' | 'renewal_due' | 'expired';

export function classifyPermitValidity(
  plannedEndAt: Date | null | undefined,
  now: Date = new Date(),
): PermitValidityState {
  if (!plannedEndAt) {
    return 'within_validity';
  }

  const remainingMs = plannedEndAt.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return 'expired';
  }

  if (remainingMs < PERMIT_RENEWAL_THRESHOLD_MS) {
    return 'renewal_due';
  }

  return 'within_validity';
}

export function hoursRemaining(
  plannedEndAt: Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!plannedEndAt) {
    return null;
  }

  return (plannedEndAt.getTime() - now.getTime()) / (60 * 60 * 1000);
}

/** Operational date key for tenant-local day-transition idempotency (YYYY-MM-DD). */
export function operationalDateKey(now: Date, timezone = 'UTC'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
