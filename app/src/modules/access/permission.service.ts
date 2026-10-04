import { Injectable } from '@nestjs/common';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { Permission } from '@ptw/shared';
import type { Tx } from '../../database/context';
import { adminAssignments, people, plantAssignments, roles } from '../../database/schema';

@Injectable()
export class PermissionService {
  /**
   * Whether a person holds a permit permission at a plant, for a permit in the given department.
   * Only plant role assignments grant permit permissions; admin assignments never do (FR-ROL-007).
   * A department-scoped assignment counts only for its own department.
   */
  async holds(tx: Tx, personId: string, permission: Permission, plantId: string, departmentId: string | null): Promise<boolean> {
    const rows = await tx
      .select({ id: plantAssignments.id })
      .from(plantAssignments)
      .innerJoin(roles, eq(roles.id, plantAssignments.roleId))
      .innerJoin(people, eq(people.id, plantAssignments.personId))
      .where(
        and(
          eq(plantAssignments.personId, personId),
          eq(plantAssignments.plantId, plantId),
          eq(roles.status, 'active'),
          eq(people.status, 'active'),
          sql`${permission} = any(${roles.permissions})`,
          departmentId === null
            ? isNull(plantAssignments.departmentId)
            : or(isNull(plantAssignments.departmentId), eq(plantAssignments.departmentId, departmentId)),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /** The admin of a legal entity: manages its people and sees their full records (FR-PRV-005). */
  async isLegalEntityAdmin(tx: Tx, personId: string, legalEntityId: string): Promise<boolean> {
    const rows = await tx
      .select({ id: adminAssignments.id })
      .from(adminAssignments)
      .innerJoin(people, eq(people.id, adminAssignments.personId))
      .where(
        and(
          eq(adminAssignments.personId, personId),
          eq(adminAssignments.role, 'LEGAL_ORG_ADMIN'),
          eq(adminAssignments.legalEntityId, legalEntityId),
          eq(people.status, 'active'),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
}
