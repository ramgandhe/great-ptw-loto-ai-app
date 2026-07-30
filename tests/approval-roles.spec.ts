import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import { APPROVAL_ACTION_ROLES } from '../app/src/modules/approval/approval.constants';

describe('Approval role enforcement (PUS-140)', () => {
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

  it('allows authorised approver roles', () => {
    getAllAndOverride.mockReturnValue([...APPROVAL_ACTION_ROLES]);

    const result = guard.canActivate(
      buildContext({ roles: ['supervisor'] }),
    );

    expect(result).toBe(true);
  });

  it('denies non-approver roles attempting approval actions', () => {
    getAllAndOverride.mockReturnValue([...APPROVAL_ACTION_ROLES]);

    expect(() =>
      guard.canActivate(buildContext({ roles: ['viewer'] })),
    ).toThrow(ForbiddenException);
  });

  it('denies unauthenticated requests', () => {
    getAllAndOverride.mockReturnValue([...APPROVAL_ACTION_ROLES]);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
