import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import { AUTHENTICATED_KEY, IS_PUBLIC_KEY } from '../app/src/common/decorators/auth.decorators';

describe('RolesGuard fail-closed enforcement (BUG-09)', () => {
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

  it('allows public routes without a user', () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });

    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('allows authenticated routes for signed-in users', () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === AUTHENTICATED_KEY) return true;
      return undefined;
    });

    expect(guard.canActivate(buildContext({ roles: ['viewer'] }))).toBe(true);
  });

  it('denies routes without explicit authorization metadata', () => {
    getAllAndOverride.mockReturnValue(undefined);

    expect(() => guard.canActivate(buildContext({ roles: ['platform-admin'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies authenticated routes without a user', () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === AUTHENTICATED_KEY) return true;
      return undefined;
    });

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
