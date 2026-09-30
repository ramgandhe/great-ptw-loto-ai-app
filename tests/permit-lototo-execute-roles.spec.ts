import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import { LOTOTO_EXECUTE_ROLES } from '../app/src/modules/permit/permit.constants';
import { mockRoleGuardReflector } from './helpers/role-guard-mock';

describe('LOTOTO permit execution role enforcement', () => {
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
    mockRoleGuardReflector(getAllAndOverride, LOTOTO_EXECUTE_ROLES);
  });

  it('allows operators and safety officers to record isolation', () => {
    expect(guard.canActivate(buildContext({ roles: ['operator'] }))).toBe(true);
    expect(guard.canActivate(buildContext({ roles: ['safety-officer'] }))).toBe(true);
  });

  it('denies HOD from recording isolation or restoration', () => {
    expect(() => guard.canActivate(buildContext({ roles: ['hod'] }))).toThrow(ForbiddenException);
  });
});
