import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNotNull, ne } from 'drizzle-orm';
import {
  canActorAssignRole,
  canActorManageTargetUser,
  TENANT_OWNER_ROLE,
} from '../../common/constants/tenant-roles';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { requireTenant } from '../../common/helpers/tenant-context';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { agencies, contractors, tenantUsers } from '../../database/schema';
import { KeycloakAdminService } from '../../infrastructure/keycloak/keycloak-admin.service';
import { AuditService } from '../logging/audit.service';
import { AssignRoleDto, CreateTenantUserDto, UpdateTenantUserDto } from './dto/workforce.dto';

@Injectable()
export class TenantUsersService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async list(actor: AuthenticatedUser) {
    const tenantId = requireTenant(actor);
    const rows = await this.db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), ne(tenantUsers.status, 'archived')));

    return rows.map((row) => this.toListItem(row));
  }

  async listNames(actor: AuthenticatedUser) {
    const tenantId = requireTenant(actor);
    const rows = await this.db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), ne(tenantUsers.status, 'archived')));

    return rows
      .map((row) => this.toListItem(row))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async ensureWorkforceLogin(
    params: { name: string; email: string },
    actor: AuthenticatedUser,
  ): Promise<{ keycloakUserId: string; created: boolean; temporaryPassword: string | null }> {
    const tenantId = requireTenant(actor);
    const email = params.email.trim().toLowerCase();
    const actorId = optionalUuid(actor.id);
    const { firstName, lastName } = splitPersonName(params.name);

    const [existing] = await this.db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.email, email)));
    if (existing && existing.status !== 'archived') {
      return { keycloakUserId: existing.keycloakUserId, created: false, temporaryPassword: null };
    }

    const inspected = await this.keycloakAdmin.inspectLoginByEmail(email);
    if (inspected) {
      if (inspected.tenantId && inspected.tenantId !== tenantId) {
        throw new ConflictException('This email already belongs to another organisation');
      }
      const [byKeycloak] = await this.db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.keycloakUserId, inspected.id));
      if (byKeycloak && byKeycloak.tenantId !== tenantId) {
        throw new ConflictException('This email already belongs to another organisation');
      }
      if (!byKeycloak) {
        await this.db.insert(tenantUsers).values({
          tenantId,
          keycloakUserId: inspected.id,
          email,
          firstName,
          lastName,
          role: 'operator',
          createdBy: actorId,
          updatedBy: actorId,
        });
      }
      return { keycloakUserId: inspected.id, created: false, temporaryPassword: null };
    }

    const created = await this.create(
      { name: params.name, email, role: 'operator' },
      actor,
    );
    return {
      keycloakUserId: created.id,
      created: true,
      temporaryPassword: created.temporaryPassword,
    };
  }

  async listExecutors(actor: AuthenticatedUser) {
    const tenantId = requireTenant(actor);
    const rows = await this.db
      .select()
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.role, 'operator'),
          eq(tenantUsers.status, 'active'),
        ),
      );

    const contractorRows = await this.db
      .select({ keycloakUserId: contractors.keycloakUserId })
      .from(contractors)
      .where(
        and(
          eq(contractors.tenantId, tenantId),
          ne(contractors.status, 'archived'),
          isNotNull(contractors.keycloakUserId),
        ),
      );

    const agencyRows = await this.db
      .select({ keycloakUserId: agencies.keycloakUserId })
      .from(agencies)
      .where(
        and(
          eq(agencies.tenantId, tenantId),
          ne(agencies.status, 'archived'),
          isNotNull(agencies.keycloakUserId),
        ),
      );

    const contractorIds = new Set(
      contractorRows.map((row) => row.keycloakUserId).filter((id): id is string => Boolean(id)),
    );
    const agencyIds = new Set(
      agencyRows.map((row) => row.keycloakUserId).filter((id): id is string => Boolean(id)),
    );

    return rows
      .map((row) => ({
        ...this.toListItem(row),
        executorKind: executorKindFor(row.keycloakUserId, contractorIds, agencyIds),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  listViewers(actor: AuthenticatedUser) {
    return this.listByRole(actor, 'viewer');
  }

  listSafetyOfficers(actor: AuthenticatedUser) {
    return this.listByRole(actor, 'safety-officer');
  }

  private async listByRole(actor: AuthenticatedUser, role: string) {
    const tenantId = requireTenant(actor);
    const rows = await this.db
      .select()
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.role, role),
          eq(tenantUsers.status, 'active'),
        ),
      );
    return rows.map((row) => this.toListItem(row)).sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(dto: CreateTenantUserDto, actor: AuthenticatedUser) {
    const tenantId = requireTenant(actor);
    this.assertAssignable(dto.role, actor);
    const email = dto.email.trim().toLowerCase();
    const { firstName, lastName } = splitPersonName(dto.name);
    const actorId = optionalUuid(actor.id);
    const temporaryPassword = randomBytes(12).toString('base64url');

    const [existing] = await this.db
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.email, email)));
    if (existing) {
      throw new ConflictException('A user with this email already exists in the organisation');
    }

    const created = await this.keycloakAdmin.createTenantUser({
      email,
      tenantId,
      role: dto.role,
      firstName,
      lastName,
      temporaryPassword,
    });

    try {
      await this.db.insert(tenantUsers).values({
        tenantId,
        keycloakUserId: created.id,
        email,
        firstName,
        lastName,
        role: dto.role,
        departmentId: optionalUuid(dto.departmentId) ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      });
    } catch (error) {
      await this.keycloakAdmin.deleteUserById(created.id).catch(() => undefined);
      throw error;
    }

    await this.auditService.log({
      action: 'tenant.user.created',
      entityType: 'user',
      entityId: created.id,
      userId: actorId,
      tenantId,
      metadata: { email, role: dto.role },
    });

    const appPublicUrl = (
      this.configService.get<string>('appPublicUrl') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    return {
      id: created.id,
      name: [firstName, lastName].filter(Boolean).join(' '),
      email,
      role: dto.role,
      temporaryPassword,
      signInUrl: `${appPublicUrl}/login`,
      signInHint:
        'The user signs in with this email. Keycloak will require a password change on first login.',
    };
  }

  async updateRole(userId: string, dto: AssignRoleDto, actor: AuthenticatedUser) {
    const tenantId = requireTenant(actor);
    this.assertAssignable(dto.role, actor);
    const actorId = optionalUuid(actor.id);

    const [row] = await this.db
      .select()
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.keycloakUserId, userId),
          eq(tenantUsers.tenantId, tenantId),
          ne(tenantUsers.status, 'archived'),
        ),
      );
    if (!row) {
      throw new NotFoundException('User not found in this organisation');
    }

    if (row.role === TENANT_OWNER_ROLE && dto.role !== TENANT_OWNER_ROLE) {
      await this.assertNotLastOwner(tenantId, row.id);
    }

    await this.keycloakAdmin.setUserRoleInTenant(userId, tenantId, dto.role);
    await this.db
      .update(tenantUsers)
      .set({ role: dto.role, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(tenantUsers.id, row.id));

    await this.auditService.log({
      action: 'tenant.user.role.updated',
      entityType: 'user',
      entityId: userId,
      userId: actorId,
      tenantId,
      metadata: { role: dto.role },
    });
    return { id: userId, role: dto.role };
  }

  async updateProfile(userId: string, dto: UpdateTenantUserDto, actor: AuthenticatedUser) {
    const row = await this.loadManageableUser(userId, actor, { allowDisabled: true });
    const actorId = optionalUuid(actor.id);
    await this.db
      .update(tenantUsers)
      .set({
        departmentId: dto.departmentId === undefined ? row.departmentId : optionalUuid(dto.departmentId) ?? null,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(tenantUsers.id, row.id));
    return this.toListItem({
      ...row,
      departmentId: dto.departmentId === undefined ? row.departmentId : optionalUuid(dto.departmentId) ?? null,
    });
  }

  async deactivate(userId: string, actor: AuthenticatedUser) {
    const row = await this.loadManageableUser(userId, actor);
    if (row.status === 'disabled') {
      return this.toListItem({ ...row, status: 'disabled' });
    }
    if (row.role === TENANT_OWNER_ROLE) {
      await this.assertNotLastOwner(row.tenantId, row.id);
    }

    const actorId = optionalUuid(actor.id);
    await this.keycloakAdmin.setUserEnabled(userId, false);
    await this.db
      .update(tenantUsers)
      .set({ status: 'disabled', updatedBy: actorId, updatedAt: new Date() })
      .where(eq(tenantUsers.id, row.id));

    await this.auditService.log({
      action: 'tenant.user.deactivated',
      entityType: 'user',
      entityId: userId,
      userId: actorId,
      tenantId: row.tenantId,
    });

    return this.toListItem({ ...row, status: 'disabled' });
  }

  async reactivate(userId: string, actor: AuthenticatedUser) {
    const row = await this.loadManageableUser(userId, actor, { allowDisabled: true });
    if (row.status === 'active') {
      return this.toListItem(row);
    }

    const actorId = optionalUuid(actor.id);
    await this.keycloakAdmin.setUserEnabled(userId, true);
    await this.db
      .update(tenantUsers)
      .set({ status: 'active', updatedBy: actorId, updatedAt: new Date() })
      .where(eq(tenantUsers.id, row.id));

    await this.auditService.log({
      action: 'tenant.user.reactivated',
      entityType: 'user',
      entityId: userId,
      userId: actorId,
      tenantId: row.tenantId,
    });

    return this.toListItem({ ...row, status: 'active' });
  }

  async remove(userId: string, actor: AuthenticatedUser) {
    const row = await this.loadManageableUser(userId, actor, { allowDisabled: true });
    if (row.role === TENANT_OWNER_ROLE) {
      await this.assertNotLastOwner(row.tenantId, row.id);
    }

    const actorId = optionalUuid(actor.id);
    await this.keycloakAdmin.deleteUserById(userId);
    await this.db
      .update(tenantUsers)
      .set({ status: 'archived', updatedBy: actorId, updatedAt: new Date() })
      .where(eq(tenantUsers.id, row.id));

    await this.auditService.log({
      action: 'tenant.user.deleted',
      entityType: 'user',
      entityId: userId,
      userId: actorId,
      tenantId: row.tenantId,
      metadata: { email: row.email, role: row.role },
    });

    return { id: userId, deleted: true };
  }

  private async loadManageableUser(
    userId: string,
    actor: AuthenticatedUser,
    options?: { allowDisabled?: boolean },
  ) {
    const tenantId = requireTenant(actor);
    if (userId === actor.id) {
      throw new BadRequestException('You cannot deactivate or delete your own account');
    }

    const [row] = await this.db
      .select()
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.keycloakUserId, userId),
          eq(tenantUsers.tenantId, tenantId),
          ne(tenantUsers.status, 'archived'),
        ),
      );
    if (!row) {
      throw new NotFoundException('User not found in this organisation');
    }
    if (!options?.allowDisabled && row.status === 'disabled') {
      // still allow operations that explicitly allow disabled
    }
    if (!canActorManageTargetUser(actor.roles, row.role)) {
      throw new BadRequestException('You cannot manage this user');
    }
    return row;
  }

  private async assertNotLastOwner(tenantId: string, excludeRowId: string) {
    const owners = await this.db
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.role, TENANT_OWNER_ROLE),
          eq(tenantUsers.status, 'active'),
        ),
      );
    const remaining = owners.filter((owner) => owner.id !== excludeRowId);
    if (remaining.length === 0) {
      throw new ConflictException('The organisation must keep at least one active tenant owner');
    }
  }

  private toListItem(row: typeof tenantUsers.$inferSelect) {
    return {
      id: row.keycloakUserId,
      email: row.email,
      username: row.email,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      enabled: row.status === 'active',
      roles: [row.role],
      departmentId: row.departmentId,
    };
  }

  private assertAssignable(role: string, actor: AuthenticatedUser) {
    if (!canActorAssignRole(actor.roles, role)) {
      throw new BadRequestException('This role cannot be assigned by the current user');
    }
  }
}

function splitPersonName(name: string): { firstName: string; lastName?: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? name.trim() };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function executorKindFor(
  keycloakUserId: string,
  contractorIds: Set<string>,
  agencyIds: Set<string>,
): 'internal' | 'contractor' | 'agency' {
  if (agencyIds.has(keycloakUserId)) {
    return 'agency';
  }
  if (contractorIds.has(keycloakUserId)) {
    return 'contractor';
  }
  return 'internal';
}
