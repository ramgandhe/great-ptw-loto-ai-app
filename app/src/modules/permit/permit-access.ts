import { ForbiddenException } from '@nestjs/common';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { Database } from '../../database/database.module';
import {
  permitExecutors,
  permitSafetyOfficers,
  permitViewers,
  permits,
  siteMembers,
  workLocationApprovers,
  workLocations,
} from '../../database/schema';
import { approverLocationScope } from '../place/place-rules';
import type { PermitDetail } from './permit.service';

const AREA_AUTHORITY_ROLES = ['permit-approver', 'hod'] as const;

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

  if (!(await permitIsOnUserSite(db, user, detail.permit.siteId))) {
    return false;
  }

  if (user.roles.includes('permit-approver')) {
    if (await approverCoversLocation(db, user, detail.permit.workLocationId)) {
      return true;
    }
  }

  if (user.roles.includes('permit-receiver') && detail.permit.createdBy === user.id) {
    return true;
  }

  if (
    user.roles.includes('permit-operator') &&
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

  const clauses = [];

  if (user.roles.includes('permit-approver')) {
    const scope = await loadApproverScope(db, user);
    if (scope.allLocations) {
      clauses.push(sql`true`);
    } else if (scope.locationIds.length > 0) {
      clauses.push(or(isNull(permits.workLocationId), inArray(permits.workLocationId, scope.locationIds)));
    } else {
      clauses.push(isNull(permits.workLocationId));
    }
  }

  if (user.roles.includes('permit-receiver')) {
    clauses.push(eq(permits.createdBy, user.id));
  }

  if (user.roles.includes('permit-operator')) {
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

  const roleClause =
    clauses.length === 0
      ? eq(permits.id, '00000000-0000-4000-8000-000000000000')
      : clauses.length === 1
        ? clauses[0]
        : or(...clauses);
  const siteIds = await memberSiteIds(db, user);
  const siteClause =
    siteIds.length === 0
      ? isNull(permits.siteId)
      : or(isNull(permits.siteId), inArray(permits.siteId, siteIds));
  return and(roleClause, siteClause);
}

export function isAreaAuthorityRole(role: string): boolean {
  return (AREA_AUTHORITY_ROLES as readonly string[]).includes(role);
}

/** Approver ids for a work location, walking up to the first list. Null means any approver. */
export async function areaAuthorityIds(
  db: Pick<Database, 'select'>,
  tenantId: string,
  workLocationId: string | null,
): Promise<string[] | null> {
  if (!workLocationId) return null;
  const seen = new Set<string>();
  let current: string | null = workLocationId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const approvers = await db
      .select({ userId: workLocationApprovers.userId })
      .from(workLocationApprovers)
      .where(and(eq(workLocationApprovers.tenantId, tenantId), eq(workLocationApprovers.workLocationId, current)));
    if (approvers.length > 0) return approvers.map((row) => row.userId);
    const [location] = await db
      .select({ parentId: workLocations.parentId })
      .from(workLocations)
      .where(and(eq(workLocations.id, current), eq(workLocations.tenantId, tenantId)));
    current = location?.parentId ?? null;
  }
  return null;
}

async function permitIsOnUserSite(
  db: Pick<Database, 'select'>,
  user: AuthenticatedUser,
  siteId: string | null,
): Promise<boolean> {
  if (!siteId) return true;
  const siteIds = await memberSiteIds(db, user);
  return siteIds.includes(siteId);
}

async function memberSiteIds(db: Pick<Database, 'select'>, user: AuthenticatedUser): Promise<string[]> {
  if (!user.tenantId) return [];
  const rows = await db
    .select({ siteId: siteMembers.siteId })
    .from(siteMembers)
    .where(and(eq(siteMembers.tenantId, user.tenantId), eq(siteMembers.userId, user.id)));
  return rows.map((row) => row.siteId);
}

async function approverCoversLocation(
  db: Pick<Database, 'select'>,
  user: AuthenticatedUser,
  workLocationId: string | null,
): Promise<boolean> {
  const scope = await loadApproverScope(db, user);
  if (scope.allLocations || !workLocationId) return true;
  return scope.locationIds.includes(workLocationId);
}

async function loadApproverScope(db: Pick<Database, 'select'>, user: AuthenticatedUser) {
  if (!user.tenantId) return { allLocations: true, locationIds: [] as string[] };
  const locations = await db
    .select({ id: workLocations.id, parentId: workLocations.parentId })
    .from(workLocations)
    .where(eq(workLocations.tenantId, user.tenantId));
  const approverRows = locations.length
    ? await db
        .select({ workLocationId: workLocationApprovers.workLocationId, userId: workLocationApprovers.userId })
        .from(workLocationApprovers)
        .where(
          and(
            eq(workLocationApprovers.tenantId, user.tenantId),
            inArray(
              workLocationApprovers.workLocationId,
              locations.map((row) => row.id),
            ),
          ),
        )
    : [];
  const parentOf = new Map(locations.map((row) => [row.id, row.parentId]));
  const approversOf = new Map<string, string[]>();
  for (const row of approverRows) {
    const list = approversOf.get(row.workLocationId) ?? [];
    list.push(row.userId);
    approversOf.set(row.workLocationId, list);
  }
  return approverLocationScope(user.id, parentOf, approversOf);
}

export function isPrimaryExecutor(detail: PermitDetail, userId: string): boolean {
  return detail.executors.some((row) => row.workforceUserId === userId && row.isPrimary);
}

export function isAssignedSafetyOfficer(detail: PermitDetail, userId: string): boolean {
  return detail.safetyOfficers?.some((row) => row.workforceUserId === userId) === true;
}

export function isPermitIssuer(detail: PermitDetail, userId: string): boolean {
  return detail.permit.createdBy === userId || detail.permit.submittedBy === userId;
}
