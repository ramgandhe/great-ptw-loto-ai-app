import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import {
  EXECUTION_ACTION_ROLES,
  EXECUTION_READ_ROLES,
  EXECUTION_RELEASE_ROLES,
  EXECUTION_UPDATE_ROLES,
} from '../app/src/modules/execution/execution.constants';
import { mockRoleGuardReflector } from './helpers/role-guard-mock';

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
    mockRoleGuardReflector(getAllAndOverride, EXECUTION_ACTION_ROLES);

    const result = guard.canActivate(buildContext({ roles: ['permit-approver'] }));
    expect(result).toBe(true);
  });

  it('denies viewer attempting suspend or resume', () => {
    mockRoleGuardReflector(getAllAndOverride, EXECUTION_ACTION_ROLES);

    expect(() => guard.canActivate(buildContext({ roles: ['viewer'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows operator for progress and evidence updates', () => {
    mockRoleGuardReflector(getAllAndOverride, EXECUTION_UPDATE_ROLES);

    const result = guard.canActivate(buildContext({ roles: ['permit-operator'] }));
    expect(result).toBe(true);
  });

  it('allows viewer for execution read endpoints', () => {
    mockRoleGuardReflector(getAllAndOverride, EXECUTION_READ_ROLES);

    const result = guard.canActivate(buildContext({ roles: ['viewer'] }));
    expect(result).toBe(true);
  });

  it('denies permit-receiver for execution action endpoints', () => {
    mockRoleGuardReflector(getAllAndOverride, EXECUTION_ACTION_ROLES);

    expect(() => guard.canActivate(buildContext({ roles: ['permit-receiver'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows release roles for execution release endpoint', () => {
    mockRoleGuardReflector(getAllAndOverride, EXECUTION_RELEASE_ROLES);

    expect(guard.canActivate(buildContext({ roles: ['platform-admin'] }))).toBe(true);
    expect(guard.canActivate(buildContext({ roles: ['tenant-admin'] }))).toBe(true);
    expect(guard.canActivate(buildContext({ roles: ['tenant-owner'] }))).toBe(true);
    expect(guard.canActivate(buildContext({ roles: ['permit-receiver'] }))).toBe(true);
  });

  it('denies operator or viewer for execution release endpoint', () => {
    mockRoleGuardReflector(getAllAndOverride, EXECUTION_RELEASE_ROLES);

    expect(() => guard.canActivate(buildContext({ roles: ['permit-operator'] }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(buildContext({ roles: ['viewer'] }))).toThrow(
      ForbiddenException,
    );
  });
});
