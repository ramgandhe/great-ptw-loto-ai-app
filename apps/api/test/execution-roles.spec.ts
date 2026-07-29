import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/common/guards/roles.guard';
import {
  EXECUTION_ACTION_ROLES,
  EXECUTION_READ_ROLES,
  EXECUTION_UPDATE_ROLES,
} from '../src/modules/execution/execution.constants';

describe('Execution role enforcement (PUS-145)', () => {
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

  it('allows authorised execution action roles for suspend/resume', () => {
    getAllAndOverride.mockReturnValue([...EXECUTION_ACTION_ROLES]);

    const result = guard.canActivate(buildContext({ roles: ['supervisor'] }));
    expect(result).toBe(true);
  });

  it('denies viewer attempting suspend or resume', () => {
    getAllAndOverride.mockReturnValue([...EXECUTION_ACTION_ROLES]);

    expect(() => guard.canActivate(buildContext({ roles: ['viewer'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows operator for progress and evidence updates', () => {
    getAllAndOverride.mockReturnValue([...EXECUTION_UPDATE_ROLES]);

    const result = guard.canActivate(buildContext({ roles: ['operator'] }));
    expect(result).toBe(true);
  });

  it('allows viewer for execution read endpoints', () => {
    getAllAndOverride.mockReturnValue([...EXECUTION_READ_ROLES]);

    const result = guard.canActivate(buildContext({ roles: ['viewer'] }));
    expect(result).toBe(true);
  });

  it('denies job-issuer for execution action endpoints', () => {
    getAllAndOverride.mockReturnValue([...EXECUTION_ACTION_ROLES]);

    expect(() => guard.canActivate(buildContext({ roles: ['job-issuer'] }))).toThrow(
      ForbiddenException,
    );
  });
});
