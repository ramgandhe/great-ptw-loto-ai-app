import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import {
  CLOSURE_ARCHIVE_READ_ROLES,
  CLOSURE_CLOSE_ROLES,
  CLOSURE_VERIFY_ROLES,
} from '../app/src/modules/closure/closure.constants';
import { mockRoleGuardReflector } from './helpers/role-guard-mock';

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
    mockRoleGuardReflector(getAllAndOverride, CLOSURE_VERIFY_ROLES);

    expect(guard.canActivate(buildContext({ roles: ['hod'] }))).toBe(true);

    mockRoleGuardReflector(getAllAndOverride, CLOSURE_CLOSE_ROLES);
    expect(guard.canActivate(buildContext({ roles: ['hod'] }))).toBe(true);
  });

  it('allows viewer to read archive endpoints', () => {
    mockRoleGuardReflector(getAllAndOverride, CLOSURE_ARCHIVE_READ_ROLES);

    expect(guard.canActivate(buildContext({ roles: ['viewer'] }))).toBe(true);
  });

  it('denies viewer from verify and close actions', () => {
    mockRoleGuardReflector(getAllAndOverride, CLOSURE_VERIFY_ROLES);

    expect(() => guard.canActivate(buildContext({ roles: ['viewer'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies operator from closure actions', () => {
    mockRoleGuardReflector(getAllAndOverride, CLOSURE_CLOSE_ROLES);

    expect(() => guard.canActivate(buildContext({ roles: ['operator'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies administrators from verify and close actions (FR-ROL-003)', () => {
    mockRoleGuardReflector(getAllAndOverride, CLOSURE_VERIFY_ROLES);

    expect(() => guard.canActivate(buildContext({ roles: ['org-admin'] }))).toThrow(
      ForbiddenException,
    );

    mockRoleGuardReflector(getAllAndOverride, CLOSURE_CLOSE_ROLES);

    expect(() => guard.canActivate(buildContext({ roles: ['platform-admin'] }))).toThrow(
      ForbiddenException,
    );
  });
});
