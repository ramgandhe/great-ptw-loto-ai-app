import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import {
  SIMOPS_ACTION_ROLES,
  SIMOPS_READ_ROLES,
} from '../app/src/modules/simops/simops.constants';

describe('SIMOPS role enforcement (PUS-166)', () => {
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

  it('allows viewers to read conflicts', () => {
    getAllAndOverride.mockReturnValue([...SIMOPS_READ_ROLES]);
    expect(guard.canActivate(buildContext({ roles: ['viewer'] }))).toBe(true);
  });

  it('allows supervisors to trigger analyse', () => {
    getAllAndOverride.mockReturnValue([...SIMOPS_ACTION_ROLES]);
    expect(guard.canActivate(buildContext({ roles: ['supervisor'] }))).toBe(true);
  });

  it('denies viewers from triggering analyse', () => {
    getAllAndOverride.mockReturnValue([...SIMOPS_ACTION_ROLES]);
    expect(() => guard.canActivate(buildContext({ roles: ['viewer'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies unauthenticated analyse requests', () => {
    getAllAndOverride.mockReturnValue([...SIMOPS_ACTION_ROLES]);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
