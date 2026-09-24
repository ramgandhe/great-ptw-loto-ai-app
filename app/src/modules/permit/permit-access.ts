import { ForbiddenException } from '@nestjs/common';
import { and, eq, inArray, or } from 'drizzle-orm';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { Database } from '../../database/database.module';
import {
  permitExecutors,
  permitSafetyOfficers,
  permitViewers,
  permits,
  tenantUsers,
} from '../../database/schema';
import type { PermitDetail } from './permit.service';

export function isPrivilegedPermitViewer(user: AuthenticatedUser): boolean {
  return isTenantPrivileged(user.roles) || user.roles.includes('platform-admin');
}

export async function assertPermitVisible(
  db: Pick<Database, 'select'>,
  user: AuthenticatedUser,
  detail: PermitDetail,
): Promise<void> {
  if (await canViewPermit(db, user, detail)) {
    return;
  }
  throw new ForbiddenException('You are not allowed to view this permit');
}

export async function canViewPermit(
  db: Pick<Database, 'select'>,
  user: AuthenticatedUser,
  detail: PermitDetail,
): Promise<boolean> {
  if (isPrivilegedPermitViewer(user)) {
    return true;
  }

  if (user.roles.includes('hod')) {
    const departmentId = await loadUserDepartment(db, user);
    if (!departmentId) {
      return true;
    }
    return detail.permit.departmentId === departmentId;
  }

  if (user.roles.includes('job-issuer') && detail.permit.createdBy === user.id) {
    return true;
  }

  if (
    user.roles.includes('operator') &&
    detail.executors.some((row) => row.workforceUserId === user.id)
  ) {
    return true;
  }

  if (
    user.roles.includes('safety-officer') &&
    detail.safetyOfficers?.some((row) => row.workforceUserId === user.id)
  ) {
    return true;
  }

  if (
    user.roles.includes('viewer') &&
    detail.viewers?.some((row) => row.workforceUserId === user.id)
  ) {
    return true;
  }

  return false;
}

export async function visiblePermitFilter(
  db: Pick<Database, 'select'>,
  user: AuthenticatedUser,
  _tenantId: string,
) {
  if (isPrivilegedPermitViewer(user)) {
    return null;
  }

  if (user.roles.includes('hod')) {
    const departmentId = await loadUserDepartment(db, user);
    if (!departmentId) {
      return null;
    }
    return eq(permits.departmentId, departmentId);
  }

  const clauses = [];

  if (user.roles.includes('job-issuer')) {
    clauses.push(eq(permits.createdBy, user.id));
  }

  if (user.roles.includes('operator')) {
    const assigned = await db
      .select({ permitId: permitExecutors.permitId })
      .from(permitExecutors)
      .where(eq(permitExecutors.workforceUserId, user.id));
    if (assigned.length > 0) {
      clauses.push(inArray(permits.id, assigned.map((row) => row.permitId)));
    }
  }

  if (user.roles.includes('safety-officer')) {
    const assigned = await db
      .select({ permitId: permitSafetyOfficers.permitId })
      .from(permitSafetyOfficers)
      .where(eq(permitSafetyOfficers.workforceUserId, user.id));
    if (assigned.length > 0) {
      clauses.push(inArray(permits.id, assigned.map((row) => row.permitId)));
    }
  }

  if (user.roles.includes('viewer')) {
    const assigned = await db
      .select({ permitId: permitViewers.permitId })
      .from(permitViewers)
      .where(eq(permitViewers.workforceUserId, user.id));
    if (assigned.length > 0) {
      clauses.push(inArray(permits.id, assigned.map((row) => row.permitId)));
    }
  }

  if (clauses.length === 0) {
    return eq(permits.id, '00000000-0000-4000-8000-000000000000');
  }

  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

async function loadUserDepartment(
  db: Pick<Database, 'select'>,
  user: AuthenticatedUser,
): Promise<string | null> {
  if (!user.tenantId) {
    return null;
  }
  const [row] = await db
    .select({ departmentId: tenantUsers.departmentId })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.tenantId, user.tenantId), eq(tenantUsers.keycloakUserId, user.id)));
  return row?.departmentId ?? null;
}

export function isPrimaryExecutor(detail: PermitDetail, userId: string): boolean {
  return detail.executors.some((row) => row.workforceUserId === userId && row.isPrimary);
}

export function isPermitIssuer(detail: PermitDetail, userId: string): boolean {
  return detail.permit.createdBy === userId || detail.permit.submittedBy === userId;
}
