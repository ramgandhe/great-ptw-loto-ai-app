export const TENANT_OWNER_ROLE = 'tenant-owner';
export const TENANT_ADMIN_ROLE = 'tenant-admin';

export const TENANT_PRIVILEGED_ROLES = [TENANT_OWNER_ROLE, TENANT_ADMIN_ROLE] as const;

export const TENANT_ASSIGNABLE_ROLES = [
  TENANT_OWNER_ROLE,
  TENANT_ADMIN_ROLE,
  'hod',
  'job-issuer',
  'operator',
  'safety-officer',
  'viewer',
] as const;

export type TenantAssignableRole = (typeof TENANT_ASSIGNABLE_ROLES)[number];

const ROLES_ASSIGNABLE_BY_PLATFORM = [...TENANT_ASSIGNABLE_ROLES] as const;
const ROLES_ASSIGNABLE_BY_OWNER = [
  TENANT_ADMIN_ROLE,
  'hod',
  'job-issuer',
  'operator',
  'safety-officer',
  'viewer',
] as const;
const ROLES_ASSIGNABLE_BY_ADMIN = [
  'hod',
  'job-issuer',
  'operator',
  'safety-officer',
  'viewer',
] as const;

export function isTenantAssignableRole(role: string): role is TenantAssignableRole {
  return (TENANT_ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

export function isTenantPrivileged(roles: readonly string[]): boolean {
  return roles.includes(TENANT_OWNER_ROLE) || roles.includes(TENANT_ADMIN_ROLE);
}

export function rolesAssignableBy(actorRoles: readonly string[]): readonly string[] {
  if (actorRoles.includes('platform-admin')) {
    return ROLES_ASSIGNABLE_BY_PLATFORM;
  }
  if (actorRoles.includes(TENANT_OWNER_ROLE)) {
    return ROLES_ASSIGNABLE_BY_OWNER;
  }
  if (actorRoles.includes(TENANT_ADMIN_ROLE)) {
    return ROLES_ASSIGNABLE_BY_ADMIN;
  }
  return [];
}

export function canActorAssignRole(actorRoles: readonly string[], role: string): boolean {
  return rolesAssignableBy(actorRoles).includes(role);
}

/** Same hierarchy as role assignment: Owner→Admin+ops, Admin→ops only. */
export function canActorManageTargetUser(
  actorRoles: readonly string[],
  targetRole: string,
): boolean {
  return canActorAssignRole(actorRoles, targetRole);
}
