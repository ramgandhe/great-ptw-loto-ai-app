import { ForbiddenException, NotFoundException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { ROLES_KEY } from '../app/src/common/decorators/auth.decorators';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import { DASHBOARD_REPORT_ROLES } from '../app/src/modules/dashboards/dashboards.constants';
import { ReportingController } from '../app/src/modules/dashboards/reporting.controller';
import { ReportingService } from '../app/src/modules/dashboards/reporting.service';

describe('Issue #324 - Delete generated reports (ReportingService & ReportingController)', () => {
  const reflector = new Reflector();

  describe('ReportingController route and RBAC configuration', () => {
    it('decorates delete method with DELETE method metadata', () => {
      const method = Reflect.getMetadata(
        METHOD_METADATA,
        ReportingController.prototype.delete,
      );
      expect(method).toBe(RequestMethod.DELETE);
    });

    it('decorates delete method with :id path metadata', () => {
      const path = Reflect.getMetadata(
        PATH_METADATA,
        ReportingController.prototype.delete,
      );
      expect(path).toBe(':id');
    });

    it('protects delete method with DASHBOARD_REPORT_ROLES', () => {
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        ReportingController.prototype.delete,
      );
      expect(roles).toEqual(DASHBOARD_REPORT_ROLES);
      expect(roles).toContain('tenant-owner');
      expect(roles).toContain('tenant-admin');
      expect(roles).toContain('platform-admin');
      expect(roles).toContain('safety-officer');
      expect(roles).toContain('permit-approver');
    });

    it('delegates controller.delete to reportingService.delete', async () => {
      const reportingService = { delete: jest.fn().mockResolvedValue({ success: true, id: 'rep-1' }) };
      const controller = new ReportingController(reportingService as never, {} as never);
      const user: AuthenticatedUser = {
        id: randomUUID(),
        username: 'test-user',
        tenantId: randomUUID(),
        roles: ['tenant-owner'],
      };

      const result = await controller.delete('rep-1', user);
      expect(reportingService.delete).toHaveBeenCalledWith('rep-1', user);
      expect(result).toEqual({ success: true, id: 'rep-1' });
    });

    it('preserves existing controller routes and roles (view, list, generate)', () => {
      expect(Reflect.getMetadata(METHOD_METADATA, ReportingController.prototype.view)).toBe(RequestMethod.GET);
      expect(Reflect.getMetadata(PATH_METADATA, ReportingController.prototype.view)).toBe('view');
      expect(reflector.get(ROLES_KEY, ReportingController.prototype.view)).toEqual(DASHBOARD_REPORT_ROLES);

      expect(Reflect.getMetadata(METHOD_METADATA, ReportingController.prototype.list)).toBe(RequestMethod.GET);
      expect(reflector.get(ROLES_KEY, ReportingController.prototype.list)).toEqual(DASHBOARD_REPORT_ROLES);

      expect(Reflect.getMetadata(METHOD_METADATA, ReportingController.prototype.generate)).toBe(RequestMethod.POST);
      expect(Reflect.getMetadata(PATH_METADATA, ReportingController.prototype.generate)).toBe('generate');
      expect(reflector.get(ROLES_KEY, ReportingController.prototype.generate)).toEqual(DASHBOARD_REPORT_ROLES);
    });
  });

  describe('ReportingService.delete and remove authorization and storage cleanup', () => {
    const tenantId = randomUUID();
    const actorId = randomUUID();
    const otherUserId = randomUUID();
    const reportId = randomUUID();

    const createService = (existingReport: Record<string, unknown> | null, storageMock?: { deleteObject: jest.Mock }) => {
      const whereObj = {
        limit: jest.fn().mockResolvedValue(existingReport ? [existingReport] : []),
        orderBy: jest.fn().mockResolvedValue([]),
      };
      const dbSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(whereObj),
        }),
      });

      const dbDelete = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ id: reportId }]),
      });

      const db = {
        select: dbSelect,
        delete: dbDelete,
      };

      const storageService = storageMock ?? {
        deleteObject: jest.fn().mockResolvedValue(undefined),
      };

      const configService = {
        get: jest.fn().mockReturnValue('dashboards/reports'),
      };

      const logService = {
        logEvent: jest.fn(),
      };

      const auditService = {
        log: jest.fn().mockResolvedValue(undefined),
      };

      const service = new ReportingService(
        db as never,
        storageService as never,
        configService as never,
        logService as never,
        auditService as never,
        {} as never,
        {} as never,
      );

      return { service, db, storageService, logService, auditService };
    };

    it('allows report creator to delete report and removes storage object and database record', async () => {
      const existingReport = {
        id: reportId,
        tenantId,
        requestedBy: actorId,
        storageKey: 'dashboards/reports/t1/report-1.csv',
      };
      const { service, db, storageService, logService, auditService } = createService(existingReport);

      const user: AuthenticatedUser = {
        id: actorId,
        username: 'creator-user',
        tenantId,
        roles: ['safety-officer'],
      };

      const result = await service.delete(reportId, user);

      expect(result).toEqual({ success: true, id: reportId });
      expect(storageService.deleteObject).toHaveBeenCalledWith('dashboards/reports/t1/report-1.csv');
      expect(db.delete).toHaveBeenCalled();
      expect(logService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'dashboard.report-deleted',
          tenantId,
          userId: actorId,
          reportId,
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'dashboard.report-deleted',
          entityType: 'report_export',
          entityId: reportId,
          userId: actorId,
          tenantId,
        }),
      );
    });

    it('allows tenant-admin to delete report created by another user', async () => {
      const existingReport = {
        id: reportId,
        tenantId,
        requestedBy: otherUserId,
        storageKey: 'dashboards/reports/t1/report-2.pdf',
      };
      const { service, storageService, db } = createService(existingReport);

      const adminUser: AuthenticatedUser = {
        id: actorId,
        username: 'admin-user',
        tenantId,
        roles: ['tenant-admin'],
      };

      const result = await service.delete(reportId, adminUser);
      expect(result).toEqual({ success: true, id: reportId });
      expect(storageService.deleteObject).toHaveBeenCalledWith('dashboards/reports/t1/report-2.pdf');
      expect(db.delete).toHaveBeenCalled();
    });

    it('allows platform-admin to delete report created by another user', async () => {
      const existingReport = {
        id: reportId,
        tenantId,
        requestedBy: otherUserId,
        storageKey: 'dashboards/reports/t1/report-3.xlsx',
      };
      const { service, storageService } = createService(existingReport);

      const platformUser: AuthenticatedUser = {
        id: actorId,
        username: 'platform-user',
        tenantId,
        roles: ['platform-admin'],
      };

      const result = await service.delete(reportId, platformUser);
      expect(result).toEqual({ success: true, id: reportId });
      expect(storageService.deleteObject).toHaveBeenCalled();
    });

    it('skips storage removal when report has null storageKey', async () => {
      const existingReport = {
        id: reportId,
        tenantId,
        requestedBy: actorId,
        storageKey: null,
      };
      const { service, storageService, db } = createService(existingReport);

      const user: AuthenticatedUser = {
        id: actorId,
        username: 'creator-user',
        tenantId,
        roles: ['permit-approver'],
      };

      const result = await service.delete(reportId, user);
      expect(result).toEqual({ success: true, id: reportId });
      expect(storageService.deleteObject).not.toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
    });

    it('safely catches storage deletion failure and completes database delete', async () => {
      const existingReport = {
        id: reportId,
        tenantId,
        requestedBy: actorId,
        storageKey: 'dashboards/reports/t1/missing-file.csv',
      };
      const failingStorage = {
        deleteObject: jest.fn().mockRejectedValue(new Error('MinIO connection refused')),
      };
      const { service, db, logService } = createService(existingReport, failingStorage);

      const user: AuthenticatedUser = {
        id: actorId,
        username: 'creator-user',
        tenantId,
        roles: ['safety-officer'],
      };

      const result = await service.delete(reportId, user);
      expect(result).toEqual({ success: true, id: reportId });
      expect(db.delete).toHaveBeenCalled();
      expect(logService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'dashboard.report-delete-storage-failed',
          reportId,
        }),
      );
    });

    it('throws NotFoundException when report does not exist or tenant mismatches', async () => {
      const { service } = createService(null);
      const user: AuthenticatedUser = {
        id: actorId,
        username: 'creator-user',
        tenantId,
        roles: ['tenant-owner'],
      };

      await expect(service.delete(reportId, user)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-admin user attempts to delete another user report', async () => {
      const existingReport = {
        id: reportId,
        tenantId,
        requestedBy: otherUserId,
        storageKey: 'dashboards/reports/t1/report-other.csv',
      };
      const { service } = createService(existingReport);

      const nonAdminUser: AuthenticatedUser = {
        id: actorId,
        username: 'non-admin',
        tenantId,
        roles: ['safety-officer'],
      };

      await expect(service.delete(reportId, nonAdminUser)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user context has no tenantId', async () => {
      const { service } = createService(null);
      const noTenantUser: AuthenticatedUser = {
        id: actorId,
        username: 'no-tenant',
        tenantId: '',
        roles: ['tenant-owner'],
      };

      await expect(service.delete(reportId, noTenantUser)).rejects.toThrow(ForbiddenException);
    });

    it('delegates remove method to delete method', async () => {
      const existingReport = {
        id: reportId,
        tenantId,
        requestedBy: actorId,
        storageKey: null,
      };
      const { service } = createService(existingReport);
      const user: AuthenticatedUser = {
        id: actorId,
        username: 'creator-user',
        tenantId,
        roles: ['tenant-owner'],
      };

      const deleteSpy = jest.spyOn(service, 'delete');
      const result = await service.remove(reportId, user);

      expect(deleteSpy).toHaveBeenCalledWith(reportId, user);
      expect(result).toEqual({ success: true, id: reportId });
    });

    it('throws ForbiddenException when user has empty or undefined roles and tries to delete another report', async () => {
      const existingReport = {
        id: reportId,
        tenantId,
        requestedBy: otherUserId,
        storageKey: null,
      };
      const { service } = createService(existingReport);
      const userWithoutRoles = {
        id: actorId,
        username: 'no-roles-user',
        tenantId,
        roles: [],
      } as AuthenticatedUser;

      await expect(service.delete(reportId, userWithoutRoles)).rejects.toThrow(ForbiddenException);
    });

    it('preserves existing list functionality on ReportingService', async () => {
      const { service, db } = createService(null);
      const user: AuthenticatedUser = {
        id: actorId,
        username: 'creator-user',
        tenantId,
        roles: ['tenant-owner'],
      };

      await service.list(user, {});
      expect(db.select).toHaveBeenCalled();
    });
  });
});
