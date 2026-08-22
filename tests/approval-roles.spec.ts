import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import { APPROVAL_ACTION_ROLES } from '../app/src/modules/approval/approval.constants';
import { mockRoleGuardReflector } from './helpers/role-guard-mock';

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
    mockRoleGuardReflector(getAllAndOverride, APPROVAL_ACTION_ROLES);

    const result = guard.canActivate(
      buildContext({ roles: ['hod'] }),
    );

    expect(result).toBe(true);
  });

  it('denies non-approver roles attempting approval actions', () => {
    mockRoleGuardReflector(getAllAndOverride, APPROVAL_ACTION_ROLES);

    expect(() =>
      guard.canActivate(buildContext({ roles: ['viewer'] })),
    ).toThrow(ForbiddenException);
  });

  it('denies administrators from approval actions (FR-ROL-003)', () => {
    mockRoleGuardReflector(getAllAndOverride, APPROVAL_ACTION_ROLES);

    expect(() =>
      guard.canActivate(buildContext({ roles: ['org-admin'] })),
    ).toThrow(ForbiddenException);

    expect(() =>
      guard.canActivate(buildContext({ roles: ['platform-admin'] })),
    ).toThrow(ForbiddenException);
  });

  it('denies unauthenticated requests', () => {
    mockRoleGuardReflector(getAllAndOverride, APPROVAL_ACTION_ROLES);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
