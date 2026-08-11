import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import { LOTOTO_WRITE_ROLES } from '../app/src/modules/lototo/lototo.constants';
import { mockRoleGuardReflector } from './helpers/role-guard-mock';

describe('LOTOTO role enforcement (PUS-151)', () => {
  const getAllAndOverride = jest.fn();
  const reflector = {
    getAllAndOverride,
  } as unknown as Reflector;

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
  });

  it('allows authorised LOTOTO configuration roles', () => {
    mockRoleGuardReflector(getAllAndOverride, LOTOTO_WRITE_ROLES);

    const result = guard.canActivate(buildContext({ roles: ['supervisor'] }));

    expect(result).toBe(true);
  });

  it('denies viewer role from modifying LOTOTO plans', () => {
    mockRoleGuardReflector(getAllAndOverride, LOTOTO_WRITE_ROLES);

    expect(() => guard.canActivate(buildContext({ roles: ['viewer'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies unauthenticated requests', () => {
    mockRoleGuardReflector(getAllAndOverride, LOTOTO_WRITE_ROLES);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
