import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import {
  CLOSURE_ARCHIVE_READ_ROLES,
  CLOSURE_CLOSE_ROLES,
  CLOSURE_VERIFY_ROLES,
} from '../app/src/modules/closure/closure.constants';

describe('Closure role enforcement (PUS-150)', () => {
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

  it('allows supervisor to verify and close permits', () => {
    getAllAndOverride.mockReturnValue([...CLOSURE_VERIFY_ROLES]);

    expect(guard.canActivate(buildContext({ roles: ['supervisor'] }))).toBe(true);

    getAllAndOverride.mockReturnValue([...CLOSURE_CLOSE_ROLES]);
    expect(guard.canActivate(buildContext({ roles: ['supervisor'] }))).toBe(true);
  });

  it('allows viewer to read archive endpoints', () => {
    getAllAndOverride.mockReturnValue([...CLOSURE_ARCHIVE_READ_ROLES]);

    expect(guard.canActivate(buildContext({ roles: ['viewer'] }))).toBe(true);
  });

  it('denies viewer from verify and close actions', () => {
    getAllAndOverride.mockReturnValue([...CLOSURE_VERIFY_ROLES]);

    expect(() => guard.canActivate(buildContext({ roles: ['viewer'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies operator from closure actions', () => {
    getAllAndOverride.mockReturnValue([...CLOSURE_CLOSE_ROLES]);

    expect(() => guard.canActivate(buildContext({ roles: ['operator'] }))).toThrow(
      ForbiddenException,
    );
  });
});
