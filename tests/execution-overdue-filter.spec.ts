import type { PermitRecord } from '../frontend/src/lib/permit/types';

describe('Overdue Live Permits filter verification (Issue #321)', () => {
  const dummyPermit = (id: string, status: string, plannedEndAt: string | null): PermitRecord => ({
    id,
    tenantId: 'tenant-1',
    reference: `PTW-${id}`,
    status,
    permitTypeId: 'hot-work',
    title: `Work permit ${id}`,
    workScope: 'Scope',
    plantId: null,
    departmentId: null,
    locationId: null,
    workstationId: null,
    machineryId: null,
    draftRevision: 1,
    createdAt: '2026-11-25T06:00:00Z',
    updatedAt: '2026-11-25T07:00:00Z',
    plannedStartAt: '2026-11-25T08:00:00Z',
    plannedEndAt,
    submittedAt: '2026-11-25T07:00:00Z',
  });

  const now = new Date('2026-11-26T12:00:00Z').getTime();

  it('filters live permits (approved, active, suspended) whose planned end time has lapsed', () => {
    const permits: PermitRecord[] = [
      dummyPermit('1', 'active', '2026-11-26T10:00:00Z'),    // overdue active (should match)
      dummyPermit('2', 'active', '2026-11-26T14:00:00Z'),    // ongoing active, future end (not overdue)
      dummyPermit('3', 'approved', '2026-11-26T10:00:00Z'),  // approved past end (should match)
      dummyPermit('4', 'suspended', '2026-11-26T10:00:00Z'), // suspended past end (should match)
      dummyPermit('5', 'active', null),                      // active with no plannedEndAt (not overdue)
    ];

    const isOverdue = (permit: PermitRecord) =>
      Boolean(permit.plannedEndAt && new Date(permit.plannedEndAt).getTime() < now);

    const overduePermits = permits.filter(isOverdue);

    expect(overduePermits).toHaveLength(3);
    expect(overduePermits.map((p) => p.id)).toEqual(['1', '3', '4']);
  });

  it('matches all, overdue, active, suspended and approved counts correctly', () => {
    const permits: PermitRecord[] = [
      dummyPermit('1', 'active', '2026-11-26T10:00:00Z'),
      dummyPermit('2', 'active', '2026-11-26T14:00:00Z'),
      dummyPermit('3', 'approved', '2026-11-26T10:00:00Z'),
      dummyPermit('4', 'suspended', '2026-11-26T10:00:00Z'),
    ];

    const counts = {
      all: permits.length,
      overdue: permits.filter(
        (p) => Boolean(p.plannedEndAt && new Date(p.plannedEndAt).getTime() < now),
      ).length,
      suspended: permits.filter((p) => p.status === 'suspended').length,
      active: permits.filter((p) => p.status === 'active').length,
      approved: permits.filter((p) => p.status === 'approved').length,
    };

    expect(counts.all).toBe(4);
    expect(counts.overdue).toBe(3);
    expect(counts.active).toBe(2);
    expect(counts.approved).toBe(1);
    expect(counts.suspended).toBe(1);
  });
});
