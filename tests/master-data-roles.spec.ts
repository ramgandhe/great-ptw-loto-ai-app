import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import {
  MASTER_DATA_READ_ROLES,
  MASTER_DATA_WRITE_ROLES,
} from '../app/src/modules/master-data/master-data.constants';
import { mockRoleGuardReflector } from './helpers/role-guard-mock';

describe('Master data role enforcement (PUS-70)', () => {
  const getAllAndOverride = jest.fn();
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  const buildContext = (user?: { roles: string[] }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  it('allows org-admin to modify master data', () => {
    mockRoleGuardReflector(getAllAndOverride, MASTER_DATA_WRITE_ROLES);
    expect(guard.canActivate(buildContext({ roles: ['org-admin'] }))).toBe(true);
  });

  it('denies operator from modifying master data', () => {
    mockRoleGuardReflector(getAllAndOverride, MASTER_DATA_WRITE_ROLES);
    expect(() => guard.canActivate(buildContext({ roles: ['operator'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows viewer to read master data catalogues', () => {
    mockRoleGuardReflector(getAllAndOverride, MASTER_DATA_READ_ROLES);
    expect(guard.canActivate(buildContext({ roles: ['viewer'] }))).toBe(true);
  });
});
