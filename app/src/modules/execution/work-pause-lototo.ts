/**
 * Pause overnight LOTOTO rules (locked):
 * - hold (default): keep isolations; no restore on Pause
 * - restore_allowed: optional overnight restore → reisolate on Resume
 * - any marked removals → reisolate on Resume
 */

import type { OvernightIsolationPolicy } from '../../database/schema';

export type LototoOvernightItem = {
  id: string;
  kind: 'crew_lock' | 'isolation_point';
  label: string;
};

export function decidePauseLototoOutcome(input: {
  overnightIsolationPolicy: OvernightIsolationPolicy;
  overnightRestoreChosen: boolean;
  lototoRemovals: string[];
}): {
  overnightRestoreChosen: boolean;
  reisolateRequiredOnResume: boolean;
  rejected?: string;
} {
  const removals = [...new Set(input.lototoRemovals.filter(Boolean))];
  const wantsRestore = input.overnightRestoreChosen === true;

  if (wantsRestore && input.overnightIsolationPolicy !== 'restore_allowed') {
    return {
      overnightRestoreChosen: false,
      reisolateRequiredOnResume: removals.length > 0,
      rejected: 'Overnight energy restore is not allowed for this organisation (policy: hold)',
    };
  }

  return {
    overnightRestoreChosen: wantsRestore,
    reisolateRequiredOnResume: wantsRestore || removals.length > 0,
  };
}

export function assertLototoRemovalsKnown(
  removals: string[],
  knownIds: Iterable<string>,
): string | null {
  const known = new Set(knownIds);
  const unknown = removals.filter((id) => !known.has(id));
  if (unknown.length === 0) {
    return null;
  }
  return `Unknown LOTOTO removal id(s): ${unknown.join(', ')}`;
}
