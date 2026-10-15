import type { ConflictSeverity, ConflictType } from '../../database/schema';

export type PermitForAnalysis = {
  id: string;
  reference: string | null;
  title: string;
  permitTypeId: string;
  workstationId: string | null;
  locationId: string | null;
  machineryId: string | null;
  /** Chosen work location. Falls back to the old workstation or location id. */
  workLocationId?: string | null;
  assetIds?: string[];
  /** This location and its ancestors. Used to tell a parent/child pair from a clash. */
  locationChain?: string[];
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  status: string;
};

export type LocationWarning = {
  permitIds: [string, string];
  summary: string;
};

export type DetectedConflict = {
  permitIds: [string, string];
  conflictType: ConflictType;
  severity: ConflictSeverity;
  summary: string;
  fingerprint: string;
  details: Record<string, unknown>;
};

function intervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && startB < endA;
}

export function schedulesOverlap(a: PermitForAnalysis, b: PermitForAnalysis): boolean {
  if (!a.plannedStartAt || !a.plannedEndAt || !b.plannedStartAt || !b.plannedEndAt) {
    return false;
  }

  return intervalsOverlap(a.plannedStartAt, a.plannedEndAt, b.plannedStartAt, b.plannedEndAt);
}

function placeId(permit: PermitForAnalysis): string | null {
  return permit.workLocationId ?? permit.workstationId ?? permit.locationId ?? null;
}

function assetSet(permit: PermitForAnalysis): Set<string> {
  return new Set([...(permit.assetIds ?? []), ...(permit.machineryId ? [permit.machineryId] : [])]);
}

function sharesLocation(a: PermitForAnalysis, b: PermitForAnalysis): boolean {
  const left = placeId(a);
  const right = placeId(b);
  return Boolean(left && right && left === right);
}

function sharesEquipment(a: PermitForAnalysis, b: PermitForAnalysis): boolean {
  const right = assetSet(b);
  for (const id of assetSet(a)) {
    if (right.has(id)) return true;
  }
  return false;
}

/** One permit's location sits inside the other's. The exact same location is a conflict, not a warning. */
export function isParentChildLocation(a: PermitForAnalysis, b: PermitForAnalysis): boolean {
  const left = placeId(a);
  const right = placeId(b);
  if (!left || !right || left === right) return false;
  return (a.locationChain ?? []).includes(right) || (b.locationChain ?? []).includes(left);
}

export function buildFingerprint(permitIdA: string, permitIdB: string, conflictType: ConflictType): string {
  const [left, right] = [permitIdA, permitIdB].sort();
  return `${left}:${right}:${conflictType}`;
}

export function detectPairConflict(
  a: PermitForAnalysis,
  b: PermitForAnalysis,
): DetectedConflict | null {
  if (a.id === b.id) {
    return null;
  }

  if (!schedulesOverlap(a, b)) {
    return null;
  }

  const equipmentConflict = sharesEquipment(a, b);
  const locationConflict = sharesLocation(a, b);

  if (!equipmentConflict && !locationConflict) {
    return null;
  }

  const conflictType: ConflictType = equipmentConflict ? 'equipment' : 'location';
  const severity: ConflictSeverity = equipmentConflict ? 'high' : 'medium';

  const overlapStart = new Date(
    Math.max(a.plannedStartAt!.getTime(), b.plannedStartAt!.getTime()),
  );
  const overlapEnd = new Date(Math.min(a.plannedEndAt!.getTime(), b.plannedEndAt!.getTime()));

  const summary = equipmentConflict
    ? 'Overlapping permits share equipment during the same schedule window.'
    : 'Overlapping permits share a work location during the same schedule window.';

  const fingerprint = buildFingerprint(a.id, b.id, conflictType);

  return {
    permitIds: [a.id, b.id],
    conflictType,
    severity,
    summary,
    fingerprint,
    details: {
      overlapStart: overlapStart.toISOString(),
      overlapEnd: overlapEnd.toISOString(),
      reasons: [
        'schedule',
        ...(equipmentConflict ? ['equipment'] : []),
        ...(locationConflict ? ['location'] : []),
      ],
      permits: [
        { id: a.id, reference: a.reference, title: a.title },
        { id: b.id, reference: b.reference, title: b.title },
      ],
    },
  };
}

export function detectConflicts(permits: PermitForAnalysis[]): DetectedConflict[] {
  const results: DetectedConflict[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < permits.length; i += 1) {
    for (let j = i + 1; j < permits.length; j += 1) {
      const conflict = detectPairConflict(permits[i], permits[j]);
      if (!conflict || seen.has(conflict.fingerprint)) {
        continue;
      }

      seen.add(conflict.fingerprint);
      results.push(conflict);
    }
  }

  return results;
}

/** Parent and child locations overlap in time. This is a warning, not a review case. */
export function detectLocationWarnings(permits: PermitForAnalysis[], focusId?: string): LocationWarning[] {
  const warnings: LocationWarning[] = [];
  for (let i = 0; i < permits.length; i += 1) {
    for (let j = i + 1; j < permits.length; j += 1) {
      const a = permits[i];
      const b = permits[j];
      if (focusId && a.id !== focusId && b.id !== focusId) continue;
      if (!schedulesOverlap(a, b) || sharesEquipment(a, b) || sharesLocation(a, b)) continue;
      if (!isParentChildLocation(a, b)) continue;
      warnings.push({
        permitIds: [a.id, b.id],
        summary: `Overlapping permits are on a work location and one of its sub-locations (${a.title} and ${b.title}).`,
      });
    }
  }
  return warnings;
}

export function clusterConflicts(conflicts: DetectedConflict[]): Array<{
  permitIds: string[];
  interactions: DetectedConflict[];
}> {
  const parent = new Map<string, string>();

  function find(id: string): string {
    if (!parent.has(id)) {
      parent.set(id, id);
    }
    const current = parent.get(id)!;
    if (current !== id) {
      parent.set(id, find(current));
    }
    return parent.get(id)!;
  }

  function union(left: string, right: string) {
    const a = find(left);
    const b = find(right);
    if (a !== b) {
      parent.set(a, b);
    }
  }

  for (const item of conflicts) {
    union(item.permitIds[0], item.permitIds[1]);
  }

  const groups = new Map<string, { permitIds: Set<string>; interactions: DetectedConflict[] }>();
  for (const item of conflicts) {
    const root = find(item.permitIds[0]);
    let group = groups.get(root);
    if (!group) {
      group = { permitIds: new Set(), interactions: [] };
      groups.set(root, group);
    }
    group.permitIds.add(item.permitIds[0]);
    group.permitIds.add(item.permitIds[1]);
    group.interactions.push(item);
  }

  return [...groups.values()].map((group) => ({
    permitIds: [...group.permitIds].sort(),
    interactions: group.interactions,
  }));
}

export function clusterFingerprint(permitIds: string[]): string {
  return [...permitIds].sort().join(':');
}

/** Skip a pair already decided together on a resolved case. */
export function excludeResolvedOverlaps(
  conflicts: DetectedConflict[],
  resolvedPermitSets: string[][],
): DetectedConflict[] {
  return conflicts.filter((item) => {
    const [left, right] = item.permitIds;
    return !resolvedPermitSets.some((set) => set.includes(left) && set.includes(right));
  });
}
