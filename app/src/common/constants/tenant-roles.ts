export const TENANT_OWNER_ROLE = 'tenant-owner';
export const TENANT_ADMIN_ROLE = 'tenant-admin';

export const PERMIT_RECEIVER_ROLE = 'permit-receiver';
export const PERMIT_APPROVER_ROLE = 'permit-approver';
export const PERMIT_OPERATOR_ROLE = 'permit-operator';

/** Previous Keycloak / stored role names → canonical names. */
export const LEGACY_TENANT_ROLE_MAP: Record<string, string> = {
  'org-admin': TENANT_OWNER_ROLE,
  'job-issuer': PERMIT_RECEIVER_ROLE,
  hod: PERMIT_APPROVER_ROLE,
  operator: PERMIT_OPERATOR_ROLE,
};

export function canonicalizeTenantRole(role: string): string {
  return LEGACY_TENANT_ROLE_MAP[role] ?? role;
}

export function canonicalizeTenantRoles(roles: readonly string[]): string[] {
  return [...new Set(roles.map(canonicalizeTenantRole))];
}

export const TENANT_PRIVILEGED_ROLES = [TENANT_OWNER_ROLE, TENANT_ADMIN_ROLE] as const;

export const TENANT_ASSIGNABLE_ROLES = [
  TENANT_OWNER_ROLE,
  TENANT_ADMIN_ROLE,
  PERMIT_APPROVER_ROLE,
  PERMIT_RECEIVER_ROLE,
  PERMIT_OPERATOR_ROLE,
  'safety-officer',
  'viewer',
] as const;

export type TenantAssignableRole = (typeof TENANT_ASSIGNABLE_ROLES)[number];

const ROLES_ASSIGNABLE_BY_PLATFORM = [...TENANT_ASSIGNABLE_ROLES] as const;
const ROLES_ASSIGNABLE_BY_OWNER = [
  TENANT_ADMIN_ROLE,
  PERMIT_APPROVER_ROLE,
  PERMIT_RECEIVER_ROLE,
  PERMIT_OPERATOR_ROLE,
  'safety-officer',
  'viewer',
] as const;
const ROLES_ASSIGNABLE_BY_ADMIN = [
  PERMIT_APPROVER_ROLE,
  PERMIT_RECEIVER_ROLE,
  PERMIT_OPERATOR_ROLE,
  'safety-officer',
  'viewer',
] as const;

export function isTenantAssignableRole(role: string): role is TenantAssignableRole {
  return (TENANT_ASSIGNABLE_ROLES as readonly string[]).includes(canonicalizeTenantRole(role));
}

export function isTenantPrivileged(roles: readonly string[]): boolean {
  const canonical = canonicalizeTenantRoles(roles);
  return canonical.includes(TENANT_OWNER_ROLE) || canonical.includes(TENANT_ADMIN_ROLE);
}

export function rolesAssignableBy(actorRoles: readonly string[]): readonly string[] {
  const canonical = canonicalizeTenantRoles(actorRoles);
  if (canonical.includes('platform-admin')) {
    return ROLES_ASSIGNABLE_BY_PLATFORM;
  }
  if (canonical.includes(TENANT_OWNER_ROLE)) {
    return ROLES_ASSIGNABLE_BY_OWNER;
  }
  if (canonical.includes(TENANT_ADMIN_ROLE)) {
    return ROLES_ASSIGNABLE_BY_ADMIN;
  }
  return [];
}

export function canActorAssignRole(actorRoles: readonly string[], role: string): boolean {
  return rolesAssignableBy(actorRoles).includes(canonicalizeTenantRole(role));
}

export function normalizeAssignedRoles(input: {
  role?: string;
  roles?: readonly string[];
}): string[] {
  const raw = input.roles?.length ? input.roles : input.role ? [input.role] : [];
  return [...new Set(raw.map(canonicalizeTenantRole))];
}

export function storedUserRoles(row: { role: string; roles?: string[] | null }): string[] {
  return row.roles?.length ? row.roles : [row.role];
}

export function userHasStoredRole(
  row: { role: string; roles?: string[] | null },
  role: string,
): boolean {
  return storedUserRoles(row).includes(canonicalizeTenantRole(role));
}

/** Same hierarchy as role assignment: Owner→Admin+ops, Admin→ops only. */
export function canActorManageTargetUser(
  actorRoles: readonly string[],
  targetRole: string | readonly string[],
): boolean {
  const targets = typeof targetRole === 'string' ? [targetRole] : targetRole;
  return targets.length > 0 && targets.every((role) => canActorAssignRole(actorRoles, role));
}
