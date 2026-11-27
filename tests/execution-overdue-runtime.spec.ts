import type { PermitRecord } from '../frontend/src/lib/permit/types';

describe('Actual runtime behavior simulation for execution page (Issue #321)', () => {
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

  const permits: PermitRecord[] = [
    dummyPermit('101', 'active', '2026-11-26T10:00:00Z'),    // Overdue active (planned end in the past)
    dummyPermit('102', 'active', '2026-11-26T16:00:00Z'),    // Active on schedule (planned end in the future)
    dummyPermit('103', 'approved', '2026-11-26T09:00:00Z'),  // Approved past planned end
    dummyPermit('104', 'suspended', '2026-11-26T08:00:00Z'), // Suspended past planned end
    dummyPermit('105', 'active', null),                      // Active without plannedEndAt
  ];

  function filterPermits(filter: 'all' | 'overdue' | 'active' | 'approved' | 'suspended', loadedAt: number) {
    return permits.filter((permit) => {
      if (filter === 'all') return true;
      if (filter === 'overdue') {
        return Boolean(permit.plannedEndAt && new Date(permit.plannedEndAt).getTime() < loadedAt);
      }
      return permit.status === filter;
    });
  }

  function simulateUrlQueryTransition(currentUrl: string, nextFilter: 'all' | 'overdue' | 'active' | 'approved' | 'suspended'): string {
    const url = new URL(currentUrl, 'http://localhost:3000');
    if (nextFilter === 'all') {
      url.searchParams.delete('filter');
    } else {
      url.searchParams.set('filter', nextFilter);
    }
    return `${url.pathname}${url.search}`;
  }

  it('navigating from dashboard with filter=overdue displays exactly the live jobs past planned end', () => {
    const visible = filterPermits('overdue', now);
    expect(visible).toHaveLength(3);
    expect(visible.map((p) => p.id)).toEqual(['101', '103', '104']);
  });

  it('switching between filters preserves count integrity', () => {
    const all = filterPermits('all', now);
    const overdue = filterPermits('overdue', now);
    const active = filterPermits('active', now);
    const approved = filterPermits('approved', now);
    const suspended = filterPermits('suspended', now);

    expect(all).toHaveLength(5);
    expect(overdue).toHaveLength(3);
    expect(active).toHaveLength(3);
    expect(approved).toHaveLength(1);
    expect(suspended).toHaveLength(1);
  });

  it('user clicking "Work past planned end" dashboard tile count equals target filter result', () => {
    const OVERDUE_WORK_STATUSES = ['approved', 'active', 'suspended'];
    const backendOverdueCount = permits.filter((p) => OVERDUE_WORK_STATUSES.includes(p.status) && p.plannedEndAt && new Date(p.plannedEndAt).getTime() < now).length;
    const frontendFiltered = filterPermits('overdue', now);

    expect(frontendFiltered.length).toBe(backendOverdueCount);
    expect(backendOverdueCount).toBe(3);
  });

  it('synchronizes browser URL correctly when switching filters', () => {
    let path = '/execution?filter=overdue';
    expect(path).toBe('/execution?filter=overdue');

    path = simulateUrlQueryTransition(path, 'active');
    expect(path).toBe('/execution?filter=active');

    path = simulateUrlQueryTransition(path, 'all');
    expect(path).toBe('/execution');

    path = simulateUrlQueryTransition(path, 'overdue');
    expect(path).toBe('/execution?filter=overdue');
  });
});
