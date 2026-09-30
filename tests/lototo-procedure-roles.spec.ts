import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import { LOTOTO_LIBRARY_WRITE_ROLES } from '../app/src/modules/lototo/lototo.constants';
import { mockRoleGuardReflector } from './helpers/role-guard-mock';

describe('LOTOTO library role enforcement', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoleGuardReflector(getAllAndOverride, LOTOTO_LIBRARY_WRITE_ROLES);
  });

  it('allows tenant-admin to manage procedures', () => {
    expect(guard.canActivate(buildContext({ roles: ['tenant-admin'] }))).toBe(true);
  });

  it('denies HOD from managing the procedure library', () => {
    expect(() => guard.canActivate(buildContext({ roles: ['hod'] }))).toThrow(ForbiddenException);
  });

  it('denies operator from managing the procedure library', () => {
    expect(() => guard.canActivate(buildContext({ roles: ['operator'] }))).toThrow(
      ForbiddenException,
    );
  });
});
