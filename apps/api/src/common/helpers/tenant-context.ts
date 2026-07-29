import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

export function requireTenant(user: AuthenticatedUser): string {
  if (!user.tenantId) {
    throw new ForbiddenException('Tenant context is required');
  }
  return user.tenantId;
}
