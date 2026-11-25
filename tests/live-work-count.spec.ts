import { LIVE_WORK_STATUSES, workCountsByRoute, type WorkItem } from '../frontend/src/lib/work-queue';
import type { PermitRecord } from '../frontend/src/lib/permit/types';
import { canAccessPath } from '../frontend/src/lib/auth/rbac';
import { NAV_EXECUTION_ROLES } from '../frontend/src/lib/auth/roles';

describe('Live work count and execution navigation verification', () => {
  const dummyPermit = (id: string, status: string, overrides: Partial<PermitRecord> = {}): PermitRecord => ({
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
    plannedEndAt: '2026-11-25T18:00:00Z',
    submittedAt: '2026-11-25T07:00:00Z',
    ...overrides,
  });

  describe('Positive Test Scenarios', () => {
    it('Scenario 1: Correctly counts permits across all live statuses (approved, active, suspended)', () => {
      expect(LIVE_WORK_STATUSES).toEqual(['approved', 'active', 'suspended']);
      const permits: PermitRecord[] = [
        dummyPermit('1', 'approved'),
        dummyPermit('2', 'active'),
        dummyPermit('3', 'suspended'),
        dummyPermit('4', 'draft'),
        dummyPermit('5', 'closed'),
      ];

      const counts = workCountsByRoute([], permits);

      expect(counts['/execution']).toBe(3);
    });

    it('Scenario 2: Matches the active count when permits change status or are created', () => {
      const permitsBefore = [dummyPermit('1', 'pending_approval')];
      expect(workCountsByRoute([], permitsBefore)['/execution']).toBeUndefined();

      // Permit gets approved and starts work
      const permitsAfter = [dummyPermit('1', 'approved'), dummyPermit('2', 'active')];
      expect(workCountsByRoute([], permitsAfter)['/execution']).toBe(2);
    });

    it('Scenario 3: Correctly maintains both /permits and /execution badges concurrently', () => {
      const permits = [
        dummyPermit('1', 'approved'),
        dummyPermit('2', 'draft'),
      ];

      const items: WorkItem[] = [
        {
          key: 'finish-draft:2',
          action: 'finish-draft',
          label: 'Continue',
          href: '/permits/2/edit',
          permit: permits[1],
          title: permits[1].title,
          urgent: false,
        },
      ];

      const counts = workCountsByRoute(items, permits);

      expect(counts['/execution']).toBe(1);
      expect(counts['/permits']).toBe(1);
    });
  });

  describe('Negative & Boundary Test Scenarios', () => {
    it('Scenario 4: Empty permit array returns no badge count for /execution', () => {
      const counts = workCountsByRoute([], []);
      expect(counts['/execution']).toBeUndefined();
    });

    it('Scenario 5: Non-live statuses (draft, pending_approval, rejected, closed, expired) do not inflate live count', () => {
      const permits = [
        dummyPermit('1', 'draft'),
        dummyPermit('2', 'pending_approval'),
        dummyPermit('3', 'deferred'),
        dummyPermit('4', 'rejected'),
        dummyPermit('5', 'closed'),
        dummyPermit('6', 'expired'),
        dummyPermit('7', 'cancelled'),
      ];

      const counts = workCountsByRoute([], permits);
      expect(counts['/execution']).toBeUndefined();
    });

    it('Scenario 6: Tolerates missing or undefined permits parameter without crashing', () => {
      const counts = workCountsByRoute([]);
      expect(counts['/execution']).toBeUndefined();
    });
  });

  describe('Permissions & RBAC Checks', () => {
    it('Scenario 7: Confirms all NAV_EXECUTION_ROLES have permission to access /execution', () => {
      for (const role of NAV_EXECUTION_ROLES) {
        expect(canAccessPath('/execution', [role])).toBe(true);
      }
    });

    it('Scenario 8: Denies /execution access for unauthorized roles', () => {
      expect(canAccessPath('/execution', ['unauthorized-role'])).toBe(false);
    });
  });
});
