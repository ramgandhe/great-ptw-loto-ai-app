export interface AuthenticatedUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  tenantId?: string;
}
