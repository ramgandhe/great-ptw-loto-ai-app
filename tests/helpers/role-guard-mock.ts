import { AUTHENTICATED_KEY, IS_PUBLIC_KEY, ROLES_KEY } from '../../app/src/common/decorators/auth.decorators';

export function mockRoleGuardReflector(
  getAllAndOverride: jest.Mock,
  requiredRoles: readonly string[],
): void {
  getAllAndOverride.mockImplementation((key: string) => {
    if (key === IS_PUBLIC_KEY) return false;
    if (key === AUTHENTICATED_KEY) return false;
    if (key === ROLES_KEY) return [...requiredRoles];
    return undefined;
  });
}
