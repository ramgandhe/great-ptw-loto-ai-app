import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import {
  SIMOPS_READ_ROLES,
  SIMOPS_RESOLVE_ROLES,
} from '../app/src/modules/simops/simops.constants';

describe('SIMOPS resolution role enforcement (PUS-171)', () => {
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
  });

  it('allows supervisors to assess and approve', () => {
    getAllAndOverride.mockReturnValue([...SIMOPS_RESOLVE_ROLES]);
    expect(guard.canActivate(buildContext({ roles: ['supervisor'] }))).toBe(true);
  });

  it('denies viewers from resolving conflicts', () => {
    getAllAndOverride.mockReturnValue([...SIMOPS_RESOLVE_ROLES]);
    expect(() => guard.canActivate(buildContext({ roles: ['viewer'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows viewers to read history', () => {
    getAllAndOverride.mockReturnValue([...SIMOPS_READ_ROLES]);
    expect(guard.canActivate(buildContext({ roles: ['viewer'] }))).toBe(true);
  });
});
