export const WORKFORCE_WRITE_ROLES = ['tenant-owner', 'tenant-admin', 'platform-admin'] as const;

export const WORKFORCE_READ_ROLES = [
  ...WORKFORCE_WRITE_ROLES,
  'permit-approver',
  'permit-operator',
  'permit-receiver',
  'safety-officer',
  'viewer',
] as const;

export {
  TENANT_ASSIGNABLE_ROLES,
  canActorAssignRole,
  isTenantAssignableRole,
  rolesAssignableBy,
} from '../../common/constants/tenant-roles';
