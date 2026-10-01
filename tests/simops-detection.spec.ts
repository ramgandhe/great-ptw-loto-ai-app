import { randomUUID } from 'crypto';
import {
  buildFingerprint,
  clusterConflicts,
  detectConflicts,
  detectPairConflict,
  excludeResolvedOverlaps,
  schedulesOverlap,
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
    plannedStartAt: start,
    plannedEndAt: end,
    status: 'approved',
    ...overrides,
  };
}

describe('SIMOPS conflict detection (PUS-166)', () => {
  it('detects schedule overlap', () => {
    const a = permit();
    const b = permit({
      id: randomUUID(),
      plannedStartAt: new Date('2026-08-01T10:00:00.000Z'),
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

  it('detects location conflict with medium severity', () => {
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
    const clusters = clusterConflicts(conflicts);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].permitIds).toHaveLength(3);
  });

  it('does not reopen a pair already on a resolved case', () => {
    const machineryId = randomUUID();
    const a = permit({ machineryId });
    const b = permit({ id: randomUUID(), machineryId });
    const d = permit({ id: randomUUID(), machineryId });
    const remaining = excludeResolvedOverlaps(detectConflicts([a, b, d]), [[a.id, b.id]]);
    expect(remaining.every((item) => !(item.permitIds.includes(a.id) && item.permitIds.includes(b.id)))).toBe(
      true,
    );
    expect(remaining.some((item) => item.permitIds.includes(d.id))).toBe(true);
  });
});
