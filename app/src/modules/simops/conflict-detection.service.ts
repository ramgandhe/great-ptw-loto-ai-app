import type { ConflictSeverity, ConflictType } from '../../database/schema';

export type PermitForAnalysis = {
  id: string;
  reference: string | null;
  title: string;
  permitTypeId: string;
  workstationId: string | null;
  locationId: string | null;
  machineryId: string | null;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  status: string;
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

function sharesLocation(a: PermitForAnalysis, b: PermitForAnalysis): boolean {
  if (a.workstationId && b.workstationId && a.workstationId === b.workstationId) {
    return true;
  }

  return Boolean(a.locationId && b.locationId && a.locationId === b.locationId);
}

function sharesEquipment(a: PermitForAnalysis, b: PermitForAnalysis): boolean {
  return Boolean(a.machineryId && b.machineryId && a.machineryId === b.machineryId);
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
  const permitTypeConflict = a.permitTypeId !== b.permitTypeId && (locationConflict || equipmentConflict);

  if (!equipmentConflict && !locationConflict && !permitTypeConflict) {
    return null;
  }

  let conflictType: ConflictType;
  let severity: ConflictSeverity;

  if (equipmentConflict) {
    conflictType = 'equipment';
    severity = 'high';
  } else if (locationConflict) {
    conflictType = 'location';
    severity = 'medium';
  } else {
    conflictType = 'permit_type';
    severity = 'low';
  }

  const overlapStart = new Date(
    Math.max(a.plannedStartAt!.getTime(), b.plannedStartAt!.getTime()),
  );
  const overlapEnd = new Date(Math.min(a.plannedEndAt!.getTime(), b.plannedEndAt!.getTime()));

  const summary = equipmentConflict
    ? 'Overlapping permits share equipment during the same schedule window.'
    : locationConflict
      ? 'Overlapping permits share a work location during the same schedule window.'
      : 'Overlapping permits with different types share operational scope during the same schedule window.';

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
        ...(permitTypeConflict ? ['permit_type'] : []),
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
