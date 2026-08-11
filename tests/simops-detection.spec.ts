import { randomUUID } from 'crypto';
import {
  buildFingerprint,
  detectConflicts,
  detectPairConflict,
  emptyDetectionContext,
  schedulesOverlap,
  type DetectionContext,
  type PermitForAnalysis,
} from '../app/src/modules/simops/conflict-detection.service';

function permit(overrides: Partial<PermitForAnalysis> = {}): PermitForAnalysis {
  const start = new Date('2026-08-01T08:00:00.000Z');
  const end = new Date('2026-08-01T16:00:00.000Z');

  return {
    id: randomUUID(),
    reference: 'PTW-001',
    title: 'Hot work',
    permitTypeId: randomUUID(),
    workstationId: randomUUID(),
    locationId: null,
    machineryId: randomUUID(),
    departmentId: null,
    plannedStartAt: start,
    plannedEndAt: end,
    status: 'approved',
    submittedAt: start,
    createdAt: start,
    hazardCategoryCodes: [],
    ...overrides,
  };
}

describe('SIMOPS conflict detection (PUS-166 / PUS-246)', () => {
  it('detects schedule overlap including touching windows (FR-SIM-013)', () => {
    const a = permit({
      plannedEndAt: new Date('2026-08-01T12:00:00.000Z'),
    });
    const b = permit({
      id: randomUUID(),
      plannedStartAt: new Date('2026-08-01T12:00:00.000Z'),
      plannedEndAt: new Date('2026-08-01T18:00:00.000Z'),
      machineryId: a.machineryId,
    });

    expect(schedulesOverlap(a, b)).toBe(true);
  });

  it('detects equipment conflict with high severity', () => {
    const machineryId = randomUUID();
    const a = permit({ machineryId });
    const b = permit({
      id: randomUUID(),
      machineryId,
      workstationId: randomUUID(),
    });

    const conflict = detectPairConflict(a, b);
    expect(conflict).not.toBeNull();
    expect(conflict?.conflictType).toBe('equipment');
    expect(conflict?.severity).toBe('high');
  });

  it('detects workstation conflict with medium severity (FR-SIM-011)', () => {
    const workstationId = randomUUID();
    const a = permit({ workstationId, machineryId: randomUUID() });
    const b = permit({
      id: randomUUID(),
      workstationId,
      machineryId: randomUUID(),
    });

    const conflict = detectPairConflict(a, b);
    expect(conflict?.conflictType).toBe('location');
    expect(conflict?.severity).toBe('medium');
  });

  it('does not treat same plant location alone as a conflict (FR-SIM-011 negative)', () => {
    const locationId = randomUUID();
    const a = permit({
      locationId,
      workstationId: randomUUID(),
      machineryId: randomUUID(),
    });
    const b = permit({
      id: randomUUID(),
      locationId,
      workstationId: randomUUID(),
      machineryId: randomUUID(),
    });

    expect(detectPairConflict(a, b)).toBeNull();
  });

  it('detects configured adjacency conflicts (FR-SIM-012)', () => {
    const locA = randomUUID();
    const locB = randomUUID();
    const context: DetectionContext = {
      ...emptyDetectionContext(),
      adjacentLocationPairs: new Set([[locA, locB].sort().join(':')]),
    };

    const a = permit({
      locationId: locA,
      workstationId: randomUUID(),
      machineryId: randomUUID(),
    });
    const b = permit({
      id: randomUUID(),
      locationId: locB,
      workstationId: randomUUID(),
      machineryId: randomUUID(),
    });

    const conflict = detectPairConflict(a, b, context);
    expect(conflict?.conflictType).toBe('adjacency');
    expect(conflict?.severity).toBe('medium');
  });

  it('applies hazard interaction matrix severity (FR-SIM-014)', () => {
    const workstationId = randomUUID();
    const context: DetectionContext = {
      ...emptyDetectionContext(),
      hazardMatrix: new Map([[['HOT', 'CONFINED'].sort().join(':'), 'high']]),
    };

    const a = permit({
      workstationId,
      machineryId: randomUUID(),
      hazardCategoryCodes: ['HOT'],
    });
    const b = permit({
      id: randomUUID(),
      workstationId,
      machineryId: randomUUID(),
      hazardCategoryCodes: ['CONFINED'],
    });

    const conflict = detectPairConflict(a, b, context);
    expect(conflict?.conflictType).toBe('hazard');
    expect(conflict?.severity).toBe('high');
  });

  it('forces high severity for shared LOTOTO energy sources (FR-SIM-021)', () => {
    const a = permit({
      workstationId: randomUUID(),
      machineryId: randomUUID(),
      locationId: randomUUID(),
    });
    const b = permit({
      id: randomUUID(),
      workstationId: randomUUID(),
      machineryId: randomUUID(),
      locationId: randomUUID(),
    });
    const energyKey = `${randomUUID()}:electrical`;
    const context: DetectionContext = {
      ...emptyDetectionContext(),
      energyKeysByPermit: new Map([
        [a.id, new Set([energyKey])],
        [b.id, new Set([energyKey])],
      ]),
    };

    const conflict = detectPairConflict(a, b, context);
    expect(conflict?.conflictType).toBe('energy_source');
    expect(conflict?.severity).toBe('high');
  });

  it('covers multi-day schedule windows (FR-SIM-013)', () => {
    const machineryId = randomUUID();
    const a = permit({
      machineryId,
      plannedStartAt: new Date('2026-08-01T08:00:00.000Z'),
      plannedEndAt: new Date('2026-08-03T16:00:00.000Z'),
    });
    const b = permit({
      id: randomUUID(),
      machineryId,
      plannedStartAt: new Date('2026-08-02T08:00:00.000Z'),
      plannedEndAt: new Date('2026-08-02T16:00:00.000Z'),
    });

    expect(detectPairConflict(a, b)).not.toBeNull();
  });

  it('ignores non-overlapping permits', () => {
    const a = permit();
    const b = permit({
      id: randomUUID(),
      plannedStartAt: new Date('2026-08-02T08:00:00.000Z'),
      plannedEndAt: new Date('2026-08-02T16:00:00.000Z'),
      machineryId: a.machineryId,
    });

    expect(detectPairConflict(a, b)).toBeNull();
  });

  it('builds stable fingerprints', () => {
    const permitA = randomUUID();
    const permitB = randomUUID();
    expect(buildFingerprint(permitA, permitB, 'equipment')).toBe(
      buildFingerprint(permitB, permitA, 'equipment'),
    );
  });

  it('deduplicates conflicts in batch detection', () => {
    const machineryId = randomUUID();
    const a = permit({ machineryId });
    const b = permit({ id: randomUUID(), machineryId });
    const c = permit({ id: randomUUID(), machineryId });

    const conflicts = detectConflicts([a, b, c]);
    expect(conflicts).toHaveLength(3);
  });
});
