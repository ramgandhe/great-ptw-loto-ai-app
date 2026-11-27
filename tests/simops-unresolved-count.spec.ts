import { OPEN_CONFLICT_STATUSES, workCountsByRoute, type WorkItem } from '../frontend/src/lib/work-queue';
import type { SimopsConflict } from '../frontend/src/lib/simops/types';
import type { PermitRecord } from '../frontend/src/lib/permit/types';
import { canAccessPath } from '../frontend/src/lib/auth/rbac';
import { NAV_SIMOPS_ROLES } from '../frontend/src/lib/auth/roles';

describe('SIMOPS unresolved conflict badge and navigation verification (Issue #316)', () => {
  const dummyConflict = (
    id: string,
    status: SimopsConflict['status'],
    severity: SimopsConflict['severity'] = 'medium',
    overrides: Partial<SimopsConflict> = {},
  ): SimopsConflict => ({
    id,
    tenantId: 'tenant-1',
    status,
    severity,
    conflictType: 'location',
    summary: `Conflict ${id}`,
    detectedAt: '2026-11-27T08:00:00Z',
    fingerprint: `fp-${id}`,
    createdAt: '2026-11-27T08:00:00Z',
    updatedAt: '2026-11-27T08:00:00Z',
    ...overrides,
  });

  describe('Positive Test Scenarios', () => {
    it('Scenario 1: Correctly counts unresolved conflicts across all open statuses (open, assessed, mitigation_planned)', () => {
      expect(OPEN_CONFLICT_STATUSES).toEqual(['open', 'assessed', 'mitigation_planned']);
      const conflicts: SimopsConflict[] = [
        dummyConflict('1', 'open'),
        dummyConflict('2', 'assessed'),
        dummyConflict('3', 'mitigation_planned'),
        dummyConflict('4', 'approved'),
        dummyConflict('5', 'rejected'),
      ];

      const counts = workCountsByRoute([], [], conflicts);

      expect(counts['/simops']).toBe(3);
    });

    it('Scenario 2: Count updates dynamically when conflicts resolve or are created', () => {
      const conflictsBefore: SimopsConflict[] = [
        dummyConflict('1', 'open'),
        dummyConflict('2', 'assessed'),
      ];
      expect(workCountsByRoute([], [], conflictsBefore)['/simops']).toBe(2);

      // One conflict resolved (approved), new one created
      const conflictsAfter: SimopsConflict[] = [
        dummyConflict('1', 'approved'),
        dummyConflict('2', 'assessed'),
        dummyConflict('3', 'open'),
      ];
      expect(workCountsByRoute([], [], conflictsAfter)['/simops']).toBe(2);

      // Both resolved
      const allResolved: SimopsConflict[] = [
        dummyConflict('1', 'approved'),
        dummyConflict('2', 'rejected'),
      ];
      expect(workCountsByRoute([], [], allResolved)['/simops']).toBeUndefined();
    });

    it('Scenario 3: Correctly maintains /simops, /permits, and /execution badges concurrently', () => {
      const conflicts: SimopsConflict[] = [dummyConflict('1', 'open')];
      const permits: PermitRecord[] = [
        {
          id: 'p-1',
          tenantId: 'tenant-1',
          reference: 'PTW-1',
          status: 'approved',
          permitTypeId: 'hot-work',
          title: 'Permit 1',
          workScope: 'Scope',
          plantId: null,
          departmentId: null,
          locationId: null,
          workstationId: null,
          machineryId: null,
          draftRevision: 1,
          createdAt: '2026-11-27T06:00:00Z',
          updatedAt: '2026-11-27T07:00:00Z',
          plannedStartAt: '2026-11-27T08:00:00Z',
          plannedEndAt: '2026-11-27T18:00:00Z',
          submittedAt: '2026-11-27T07:00:00Z',
        },
      ];
      const items: WorkItem[] = [
        {
          key: 'review:p-1',
          action: 'review',
          label: 'Review',
          href: '/permits/p-1',
          permit: permits[0],
          title: permits[0].title,
          urgent: false,
        },
      ];

      const counts = workCountsByRoute(items, permits, conflicts);

      expect(counts['/simops']).toBe(1);
      expect(counts['/execution']).toBe(1);
      expect(counts['/permits']).toBe(1);
    });
  });

  describe('Negative & Boundary Test Scenarios', () => {
    it('Scenario 4: Empty conflict array returns no badge count for /simops', () => {
      const counts = workCountsByRoute([], [], []);
      expect(counts['/simops']).toBeUndefined();
    });

    it('Scenario 5: Resolved statuses (approved, rejected) do not show badge count for /simops', () => {
      const conflicts: SimopsConflict[] = [
        dummyConflict('1', 'approved'),
        dummyConflict('2', 'rejected'),
      ];

      const counts = workCountsByRoute([], [], conflicts);
      expect(counts['/simops']).toBeUndefined();
    });

    it('Scenario 6: Tolerates missing or undefined conflicts parameter without crashing', () => {
      const counts = workCountsByRoute([]);
      expect(counts['/simops']).toBeUndefined();
    });
  });

  describe('Permissions & RBAC Checks', () => {
    it('Scenario 7: Confirms all NAV_SIMOPS_ROLES have permission to access /simops', () => {
      for (const role of NAV_SIMOPS_ROLES) {
        expect(canAccessPath('/simops', [role])).toBe(true);
      }
    });

    it('Scenario 8: Denies /simops access for unauthorized roles', () => {
      expect(canAccessPath('/simops', ['unauthorized-role'])).toBe(false);
    });
  });
});

