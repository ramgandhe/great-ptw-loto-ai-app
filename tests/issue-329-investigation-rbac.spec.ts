import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../app/src/common/decorators/auth.decorators';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import { INCIDENT_ARCHIVE_READ_ROLES } from '../app/src/modules/incident-closure/incident-closure.constants';
import { IncidentClosureController } from '../app/src/modules/incident-closure/incident-closure.controller';
import {
  CORRECTIVE_ACTION_UPDATE_ROLES,
  INVESTIGATION_ASSIGN_ROLES,
  INVESTIGATION_READ_ROLES,
  INVESTIGATION_WRITE_ROLES,
} from '../app/src/modules/investigation/investigation.constants';
import { InvestigationController } from '../app/src/modules/investigation/investigation.controller';
import {
  INCIDENT_ARCHIVE_READ_ROLES as FE_INCIDENT_ARCHIVE_READ_ROLES,
  INVESTIGATION_READ_ROLES as FE_INVESTIGATION_READ_ROLES,
} from '../frontend/src/lib/auth/roles';

describe('Issue #329 - Assigned investigator in Issuer view (RBAC)', () => {
  const reflector = new Reflector();

  describe('Positive scenarios - Read permission inclusion', () => {
    it('includes permit-receiver (Issuer) and permit-operator in backend INVESTIGATION_READ_ROLES', () => {
      expect(INVESTIGATION_READ_ROLES).toContain('permit-receiver');
      expect(INVESTIGATION_READ_ROLES).toContain('permit-operator');
      expect(INVESTIGATION_READ_ROLES).toContain('safety-officer');
      expect(INVESTIGATION_READ_ROLES).toContain('tenant-owner');
      expect(INVESTIGATION_READ_ROLES).toContain('tenant-admin');
      expect(INVESTIGATION_READ_ROLES).toContain('platform-admin');
      expect(INVESTIGATION_READ_ROLES).toContain('permit-approver');
      expect(INVESTIGATION_READ_ROLES).toContain('viewer');
    });

    it('includes permit-receiver and permit-operator in backend INCIDENT_ARCHIVE_READ_ROLES', () => {
      expect(INCIDENT_ARCHIVE_READ_ROLES).toContain('permit-receiver');
      expect(INCIDENT_ARCHIVE_READ_ROLES).toContain('permit-operator');
      expect(INCIDENT_ARCHIVE_READ_ROLES).toContain('safety-officer');
      expect(INCIDENT_ARCHIVE_READ_ROLES).toContain('tenant-owner');
    });

    it('syncs frontend INVESTIGATION_READ_ROLES with backend constants', () => {
      expect([...FE_INVESTIGATION_READ_ROLES]).toEqual([...INVESTIGATION_READ_ROLES]);
    });

    it('syncs frontend INCIDENT_ARCHIVE_READ_ROLES with backend constants', () => {
      expect([...FE_INCIDENT_ARCHIVE_READ_ROLES]).toEqual([...INCIDENT_ARCHIVE_READ_ROLES]);
    });

    it('decorates InvestigationController.getInvestigation with updated INVESTIGATION_READ_ROLES', () => {
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        InvestigationController.prototype.getInvestigation,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain('permit-receiver');
      expect(roles).toContain('permit-operator');
    });

    it('decorates IncidentClosureController.history with updated INCIDENT_ARCHIVE_READ_ROLES', () => {
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        IncidentClosureController.prototype.history,
      );
      expect(roles).toBeDefined();
      expect(roles).toContain('permit-receiver');
      expect(roles).toContain('permit-operator');
    });

    it('allows permit-receiver user to fetch investigation with assigned investigator details', async () => {
      const mockInvestigationData = {
        investigation: {
          id: 'inv-123',
          incidentId: 'inc-123',
          investigatorId: 'user-investigator',
          status: 'in_progress',
          dueDate: '2026-12-01',
        },
        rootCauses: [],
        correctiveActions: [],
        preventiveActions: [],
        history: [],
      };

      const mockService = {
        getInvestigation: jest.fn().mockImplementation(async (_incidentId: string, user: AuthenticatedUser) => {
          if (!user.tenantId) {
            throw new Error('Tenant required');
          }
          return mockInvestigationData;
        }),
      };

      const controller = new InvestigationController(mockService as never);
      const issuerUser: AuthenticatedUser = {
        id: 'issuer-user-id',
        tenantId: 'tenant-123',
        username: 'issuer.user',
        email: 'issuer@example.com',
        roles: ['permit-receiver'],
      };

      const result = await controller.getInvestigation('inc-123', issuerUser);
      expect(result).toEqual(mockInvestigationData);
      expect(result.investigation.investigatorId).toBe('user-investigator');
    });

    it('allows permit-operator user to fetch investigation with assigned investigator details', async () => {
      const mockInvestigationData = {
        investigation: {
          id: 'inv-456',
          incidentId: 'inc-456',
          investigatorId: 'safety-officer-id',
          status: 'assigned',
          dueDate: '2026-12-15',
        },
        rootCauses: [],
        correctiveActions: [],
        preventiveActions: [],
        history: [],
      };

      const mockService = {
        getInvestigation: jest.fn().mockResolvedValue(mockInvestigationData),
      };

      const controller = new InvestigationController(mockService as never);
      const operatorUser: AuthenticatedUser = {
        id: 'operator-user-id',
        tenantId: 'tenant-123',
        username: 'operator.user',
        email: 'operator@example.com',
        roles: ['permit-operator'],
      };

      const result = await controller.getInvestigation('inc-456', operatorUser);
      expect(result.investigation.investigatorId).toBe('safety-officer-id');
      expect(result.investigation.status).toBe('assigned');
    });
  });

  describe('Negative scenarios - Least privilege and boundary preservation', () => {
    it('does not grant permit-receiver assignment permissions in INVESTIGATION_ASSIGN_ROLES', () => {
      expect(INVESTIGATION_ASSIGN_ROLES).not.toContain('permit-receiver');
      expect(INVESTIGATION_ASSIGN_ROLES).not.toContain('permit-operator');
    });

    it('does not grant permit-receiver root cause or preventive action creation in INVESTIGATION_WRITE_ROLES', () => {
      expect(INVESTIGATION_WRITE_ROLES).not.toContain('permit-receiver');
      expect(INVESTIGATION_WRITE_ROLES).not.toContain('permit-operator');
    });

    it('preserves permit-receiver permission to update assigned corrective actions', () => {
      expect(CORRECTIVE_ACTION_UPDATE_ROLES).toContain('permit-receiver');
      expect(CORRECTIVE_ACTION_UPDATE_ROLES).toContain('permit-operator');
    });

    it('excludes unauthorized roles from INVESTIGATION_READ_ROLES', () => {
      const readRoles = INVESTIGATION_READ_ROLES as readonly string[];
      expect(readRoles.includes('external-contractor')).toBe(false);
      expect(readRoles.includes('guest')).toBe(false);
      expect(readRoles.includes('unverified-role')).toBe(false);
    });

    it('excludes unauthorized roles from INCIDENT_ARCHIVE_READ_ROLES', () => {
      const archiveRoles = INCIDENT_ARCHIVE_READ_ROLES as readonly string[];
      expect(archiveRoles.includes('external-contractor')).toBe(false);
      expect(archiveRoles.includes('guest')).toBe(false);
    });

    it('enforces tenant boundary when calling getInvestigation', async () => {
      const mockService = {
        getInvestigation: jest.fn().mockImplementation(async (_incidentId: string, user: AuthenticatedUser) => {
          if (!user.tenantId) {
            throw new Error('Tenant context is required');
          }
        }),
      };

      const controller = new InvestigationController(mockService as never);
      const invalidUser: AuthenticatedUser = {
        id: 'user-no-tenant',
        tenantId: '',
        username: 'no.tenant',
        email: 'user@example.com',
        roles: ['permit-receiver'],
      };

      await expect(controller.getInvestigation('inc-123', invalidUser)).rejects.toThrow(
        'Tenant context is required',
      );
    });
  });
});
