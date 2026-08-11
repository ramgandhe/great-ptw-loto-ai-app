import type { ConflictSeverity, ConflictType } from '../../database/schema';

export type PermitForAnalysis = {
  id: string;
  reference: string | null;
  title: string;
  permitTypeId: string;
  workstationId: string | null;
  locationId: string | null;
  machineryId: string | null;
  departmentId: string | null;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
  hazardCategoryCodes: string[];
};

export type DetectionContext = {
  /** Sorted "locationA:locationB" pairs marked operationally adjacent (FR-SIM-012). */
  adjacentLocationPairs: Set<string>;
  /** Locations sharing the same adjacency_zone key. */
  adjacencyZoneByLocation: Map<string, string>;
  /** Sorted "hazardA:hazardB" → severity (FR-SIM-014). */
  hazardMatrix: Map<string, ConflictSeverity>;
  /** permitId → set of "machineryId:energySourceType" for active LOTOTO (FR-SIM-021). */
  energyKeysByPermit: Map<string, Set<string>>;
};

export type DetectedConflict = {
  permitIds: [string, string];
  conflictType: ConflictType;
  severity: ConflictSeverity;
  summary: string;
  fingerprint: string;
  details: Record<string, unknown>;
};

export function pairKey(left: string, right: string): string {
  return [left, right].sort().join(':');
}

/** FR-SIM-013 — any intersection of planned windows, including touching endpoints. */
export function intervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA <= endB && startB <= endA;
}

export function schedulesOverlap(a: PermitForAnalysis, b: PermitForAnalysis): boolean {
  if (!a.plannedStartAt || !a.plannedEndAt || !b.plannedStartAt || !b.plannedEndAt) {
    return false;
  }

  return intervalsOverlap(a.plannedStartAt, a.plannedEndAt, b.plannedStartAt, b.plannedEndAt);
}

/** FR-SIM-011 — workstation/machine only; bare locationId is not a conflict. */
export function sharesWorkstationOrMachine(a: PermitForAnalysis, b: PermitForAnalysis): boolean {
  if (a.workstationId && b.workstationId && a.workstationId === b.workstationId) {
    return true;
  }

  return Boolean(a.machineryId && b.machineryId && a.machineryId === b.machineryId);
}

export function sharesEquipment(a: PermitForAnalysis, b: PermitForAnalysis): boolean {
  return Boolean(a.machineryId && b.machineryId && a.machineryId === b.machineryId);
}

/** FR-SIM-012 — configured adjacency pairs or shared adjacency zone. */
export function isAdjacent(
  a: PermitForAnalysis,
  b: PermitForAnalysis,
  context: DetectionContext,
): boolean {
  // Adjacency only applies across distinct location records (FR-SIM-011/012).
  if (!a.locationId || !b.locationId || a.locationId === b.locationId) {
    return false;
  }

  if (context.adjacentLocationPairs.has(pairKey(a.locationId, b.locationId))) {
    return true;
  }

  const zoneA = context.adjacencyZoneByLocation.get(a.locationId);
  const zoneB = context.adjacencyZoneByLocation.get(b.locationId);
  return Boolean(zoneA && zoneB && zoneA === zoneB);
}

export function sharesOperationalScope(
  a: PermitForAnalysis,
  b: PermitForAnalysis,
  context: DetectionContext,
): { workstationOrMachine: boolean; adjacent: boolean } {
  return {
    workstationOrMachine: sharesWorkstationOrMachine(a, b),
    adjacent: isAdjacent(a, b, context),
  };
}

export function sharedEnergyKeys(
  a: PermitForAnalysis,
  b: PermitForAnalysis,
  context: DetectionContext,
): string[] {
  const left = context.energyKeysByPermit.get(a.id) ?? new Set<string>();
  const right = context.energyKeysByPermit.get(b.id) ?? new Set<string>();
  const shared: string[] = [];
  for (const key of left) {
    if (right.has(key)) {
      shared.push(key);
    }
  }
  return shared;
}

const SEVERITY_RANK: Record<ConflictSeverity, number> = { low: 1, medium: 2, high: 3 };

export function matrixSeverity(
  a: PermitForAnalysis,
  b: PermitForAnalysis,
  context: DetectionContext,
): ConflictSeverity | null {
  let max: ConflictSeverity | null = null;
  for (const codeA of a.hazardCategoryCodes) {
    for (const codeB of b.hazardCategoryCodes) {
      const severity = context.hazardMatrix.get(pairKey(codeA, codeB));
      if (!severity) {
        continue;
      }
      if (!max || SEVERITY_RANK[severity] > SEVERITY_RANK[max]) {
        max = severity;
      }
    }
  }
  return max;
}

export function buildFingerprint(
  permitIdA: string,
  permitIdB: string,
  conflictType: ConflictType,
): string {
  return `${pairKey(permitIdA, permitIdB)}:${conflictType}`;
}

export function newerPermitId(a: PermitForAnalysis, b: PermitForAnalysis): string {
  const timeA = (a.submittedAt ?? a.createdAt).getTime();
  const timeB = (b.submittedAt ?? b.createdAt).getTime();
  if (timeA === timeB) {
    return a.id < b.id ? b.id : a.id;
  }
  return timeA > timeB ? a.id : b.id;
}

export function detectPairConflict(
  a: PermitForAnalysis,
  b: PermitForAnalysis,
  context: DetectionContext = emptyDetectionContext(),
): DetectedConflict | null {
  if (a.id === b.id) {
    return null;
  }

  if (!schedulesOverlap(a, b)) {
    return null;
  }

  const scope = sharesOperationalScope(a, b, context);
  const energyShared = sharedEnergyKeys(a, b, context);
  const equipmentConflict = sharesEquipment(a, b);

  // FR-SIM-021 — shared energy source is always High, even without location match.
  if (energyShared.length > 0) {
    return buildDetected(a, b, 'energy_source', 'high', {
      reasons: ['schedule', 'energy_source'],
      sharedEnergyKeys: energyShared,
      summary:
        'Overlapping permits share an active LOTOTO energy source (automatic high-severity conflict).',
    });
  }

  if (!scope.workstationOrMachine && !scope.adjacent) {
    return null;
  }

  const fromMatrix = matrixSeverity(a, b, context);

  let conflictType: ConflictType;
  let severity: ConflictSeverity;
  let summary: string;
  const reasons = ['schedule'];

  if (equipmentConflict) {
    conflictType = 'equipment';
    severity = fromMatrix ?? 'high';
    summary = 'Overlapping permits share equipment during the same schedule window.';
    reasons.push('equipment');
  } else if (scope.adjacent && !scope.workstationOrMachine) {
    conflictType = 'adjacency';
    severity = fromMatrix ?? 'medium';
    summary =
      'Overlapping permits are on operationally adjacent locations during the same schedule window.';
    reasons.push('adjacency');
  } else if (fromMatrix) {
    conflictType = 'hazard';
    severity = fromMatrix;
    summary =
      'Overlapping permits at the same workstation/machine have a configured hazard interaction.';
    reasons.push('hazard', 'workstation_or_machine');
  } else {
    conflictType = 'location';
    severity = 'medium';
    summary =
      'Overlapping permits share a workstation or machine during the same schedule window.';
    reasons.push('workstation_or_machine');
  }

  return buildDetected(a, b, conflictType, severity, { reasons, summary });
}

function buildDetected(
  a: PermitForAnalysis,
  b: PermitForAnalysis,
  conflictType: ConflictType,
  severity: ConflictSeverity,
  options: { reasons: string[]; summary: string; sharedEnergyKeys?: string[] },
): DetectedConflict {
  const overlapStart = new Date(
    Math.max(a.plannedStartAt!.getTime(), b.plannedStartAt!.getTime()),
  );
  const overlapEnd = new Date(Math.min(a.plannedEndAt!.getTime(), b.plannedEndAt!.getTime()));

  return {
    permitIds: [a.id, b.id],
    conflictType,
    severity,
    summary: options.summary,
    fingerprint: buildFingerprint(a.id, b.id, conflictType),
    details: {
      overlapStart: overlapStart.toISOString(),
      overlapEnd: overlapEnd.toISOString(),
      reasons: options.reasons,
      sharedEnergyKeys: options.sharedEnergyKeys ?? [],
      newerPermitId: newerPermitId(a, b),
      departments: [a.departmentId, b.departmentId],
      permits: [
        { id: a.id, reference: a.reference, title: a.title, status: a.status },
        { id: b.id, reference: b.reference, title: b.title, status: b.status },
      ],
    },
  };
}

export function emptyDetectionContext(): DetectionContext {
  return {
    adjacentLocationPairs: new Set(),
    adjacencyZoneByLocation: new Map(),
    hazardMatrix: new Map(),
    energyKeysByPermit: new Map(),
  };
}

export function detectConflicts(
  permits: PermitForAnalysis[],
  context: DetectionContext = emptyDetectionContext(),
): DetectedConflict[] {
  const results: DetectedConflict[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < permits.length; i += 1) {
    for (let j = i + 1; j < permits.length; j += 1) {
      const conflict = detectPairConflict(permits[i], permits[j], context);
      if (!conflict || seen.has(conflict.fingerprint)) {
        continue;
      }

      seen.add(conflict.fingerprint);
      results.push(conflict);
    }
  }

  return results;
}
