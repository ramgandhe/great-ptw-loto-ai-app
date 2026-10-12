import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  canonicalizeTenantRole,
  canonicalizeTenantRoles,
  isTenantAssignableRole,
  LEGACY_TENANT_ROLE_MAP,
} from '../../common/constants/tenant-roles';

export type CreatedKeycloakUser = {
  id: string;
  username: string;
};

export type TenantKeycloakUser = {
  id: string;
  email: string | null;
  username: string;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  roles: string[];
};

type KeycloakUser = {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  attributes?: Record<string, string[] | string>;
};

type KeycloakRole = { id: string; name: string };

@Injectable()
export class KeycloakAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(KeycloakAdminService.name);

  constructor(private readonly configService: ConfigService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.migrateLegacyRealmRoles();
    } catch (error) {
      this.logger.warn(
        `Keycloak role migration skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createOrgAdmin(params: {
    email: string;
    tenantId: string;
    firstName?: string;
    lastName?: string;
    temporaryPassword: string;
  }): Promise<CreatedKeycloakUser> {
    return this.createTenantUser({
      ...params,
      role: 'tenant-owner',
      firstName: params.firstName ?? 'Organisation',
      lastName: params.lastName ?? 'Admin',
    });
  }

  async createTenantUser(params: {
    email: string;
    tenantId: string;
    role?: string;
    roles?: string[];
    firstName?: string;
    lastName?: string;
    temporaryPassword: string;
  }): Promise<CreatedKeycloakUser> {
    const existing = await this.findUserIdByEmail(params.email);
    if (existing) {
      throw new ConflictException('A login already exists for this email');
    }

    const token = await this.adminToken();
    await this.allowTenantAttribute(token);
    const createResponse = await fetch(`${this.realmUrl()}/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: params.email,
        email: params.email,
        enabled: true,
        emailVerified: true,
        firstName: params.firstName ?? params.email.split('@')[0],
        lastName: params.lastName ?? 'User',
        requiredActions: ['UPDATE_PASSWORD'],
        attributes: { tenant_id: [params.tenantId] },
      }),
    });

    if (createResponse.status === 409) {
      throw new ConflictException('A login already exists for this email');
    }
    if (!createResponse.ok) {
      throw this.unavailable('Failed to create tenant user login', await createResponse.text());
    }

    const location = createResponse.headers.get('location') ?? '';
    const id = location.split('/').pop();
    if (!id) {
      throw this.unavailable('Keycloak did not return the new user id', '');
    }

    try {
      await this.setTemporaryPassword(token, id, params.temporaryPassword);
      const assigned = [...new Set((params.roles?.length ? params.roles : params.role ? [params.role] : []).map(canonicalizeTenantRole))];
      if (assigned.length === 0) {
        throw new BadRequestException('At least one role is required');
      }
      for (const role of assigned) {
        await this.assignRealmRole(token, id, role);
      }
    } catch (error) {
      await this.deleteUser(token, id).catch(() => undefined);
      throw error;
    }

    return { id, username: params.email };
  }

  async listUsersForTenant(tenantId: string): Promise<TenantKeycloakUser[]> {
    const token = await this.adminToken();
    const url = new URL(`${this.realmUrl()}/users`);
    url.searchParams.set('q', `tenant_id:${tenantId}`);
    url.searchParams.set('max', '200');
    url.searchParams.set('briefRepresentation', 'false');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      throw this.unavailable('Failed to list tenant users', await response.text());
    }
    const users = (await response.json()) as KeycloakUser[];
    const inTenant = users.filter((user) => this.readTenantId(user) === tenantId);
    return Promise.all(inTenant.map((user) => this.toTenantUser(token, user)));
  }

  /**
   * Keycloak 24+ drops attributes the user profile does not declare, so `tenant_id` sent on
   * create was silently lost and those users had no organisation. Admin-editable unmanaged
   * attributes keep it (users cannot change it themselves). Checked once per process.
   */
  private tenantAttributeAllowed = false;
  private async allowTenantAttribute(token: string): Promise<void> {
    if (this.tenantAttributeAllowed) {
      return;
    }
    const url = `${this.realmUrl()}/users/profile`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      throw this.unavailable('Failed to read the Keycloak user profile', await response.text());
    }
    const profile = (await response.json()) as { unmanagedAttributePolicy?: string };
    if (!profile.unmanagedAttributePolicy) {
      const update = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, unmanagedAttributePolicy: 'ADMIN_EDIT' }),
      });
      if (!update.ok) {
        throw this.unavailable('Failed to update the Keycloak user profile', await update.text());
      }
    }
    this.tenantAttributeAllowed = true;
  }

  /** Puts back `tenant_id` on a login that lost it (see allowTenantAttribute). No-op when already set. */
  async ensureTenantAttribute(userId: string, tenantId: string): Promise<void> {
    const token = await this.adminToken();
    await this.allowTenantAttribute(token);
    const user = await this.getUser(token, userId);
    if (this.readTenantId(user)) {
      return;
    }
    const response = await fetch(`${this.realmUrl()}/users/${userId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, attributes: { ...(user.attributes ?? {}), tenant_id: [tenantId] } }),
    });
    if (!response.ok) {
      throw this.unavailable('Failed to set the user organisation', await response.text());
    }
  }

  /**
   * First sign-in with a temporary password: set the permanent one and clear Keycloak's
   * "update password" step. Callers must have proved the current password first.
   */
  async completePasswordChange(userId: string, password: string): Promise<void> {
    const token = await this.adminToken();
    const reset = await fetch(`${this.realmUrl()}/users/${userId}/reset-password`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'password', value: password, temporary: false }),
    });
    if (!reset.ok) {
      // Keycloak's password policy explains itself (length, history); pass that on.
      const detail = (await reset.json().catch(() => ({}))) as { error_description?: string; errorMessage?: string };
      throw new BadRequestException(detail.error_description ?? detail.errorMessage ?? 'That password is not allowed. Try a longer one.');
    }
    const user = await this.getUser(token, userId);
    const requiredActions = ((user as { requiredActions?: string[] }).requiredActions ?? []).filter((a) => a !== 'UPDATE_PASSWORD');
    const update = await fetch(`${this.realmUrl()}/users/${userId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, requiredActions }),
    });
    if (!update.ok) {
      throw this.unavailable('Failed to finish the password change', await update.text());
    }
  }

  async setUserRoleInTenant(userId: string, tenantId: string, role: string): Promise<void> {
    await this.setUserRolesInTenant(userId, tenantId, [role]);
  }

  async setUserRolesInTenant(userId: string, tenantId: string, roles: string[]): Promise<void> {
    const canonical = [...new Set(roles.map(canonicalizeTenantRole))];
    if (canonical.length === 0) {
      throw new BadRequestException('At least one role is required');
    }
    const token = await this.adminToken();
    const user = await this.getUser(token, userId);
    if (this.readTenantId(user) !== tenantId) {
      throw new ForbiddenException('User is not in this tenant');
    }

    const current = await this.getRealmRoleMappings(token, userId);
    if (current.some((entry) => entry.name === 'platform-admin')) {
      throw new ForbiddenException('Cannot change a platform administrator');
    }

    const wanted = new Set(canonical);
    const removable = current.filter(
      (entry) => this.isAssignableRealmRole(entry.name) && !wanted.has(canonicalizeTenantRole(entry.name)),
    );
    if (removable.length > 0) {
      await this.removeRealmRoles(token, userId, removable);
    }
    for (const role of canonical) {
      if (!current.some((entry) => canonicalizeTenantRole(entry.name) === role)) {
        await this.assignRealmRole(token, userId, role);
      }
    }
  }

  async deleteUserById(userId: string): Promise<void> {
    const token = await this.adminToken();
    await this.deleteUser(token, userId);
  }

  async setUserEnabled(userId: string, enabled: boolean): Promise<void> {
    const token = await this.adminToken();
    const user = await this.getUser(token, userId);
    const response = await fetch(`${this.realmUrl()}/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...user, enabled }),
    });
    if (!response.ok) {
      throw this.unavailable('Failed to update user status', await response.text());
    }
  }

  private async deleteUser(token: string, userId: string): Promise<void> {
    const response = await fetch(`${this.realmUrl()}/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) {
      return;
    }
    if (!response.ok) {
      throw this.unavailable('Failed to delete Keycloak user', await response.text());
    }
  }

  async resetTemporaryPassword(userId: string, password: string): Promise<void> {
    const token = await this.adminToken();
    await this.setTemporaryPassword(token, userId, password);
  }

  private async setTemporaryPassword(
    token: string,
    userId: string,
    password: string,
  ): Promise<void> {
    const response = await fetch(`${this.realmUrl()}/users/${userId}/reset-password`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'password', value: password, temporary: true }),
    });
    if (!response.ok) {
      throw this.unavailable('Failed to set user password', await response.text());
    }
  }

  private async assignRealmRole(token: string, userId: string, roleName: string): Promise<void> {
    const roleResponse = await fetch(`${this.realmUrl()}/roles/${roleName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!roleResponse.ok) {
      throw this.unavailable(`Keycloak role ${roleName} not found`, await roleResponse.text());
    }
    const role = (await roleResponse.json()) as { id: string; name: string };
    const mapResponse = await fetch(`${this.realmUrl()}/users/${userId}/role-mappings/realm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ id: role.id, name: role.name }]),
    });
    if (!mapResponse.ok) {
      throw this.unavailable(`Failed to assign role ${roleName}`, await mapResponse.text());
    }
  }

  private async getUser(token: string, userId: string): Promise<KeycloakUser> {
    const response = await fetch(`${this.realmUrl()}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) {
      throw new NotFoundException('User not found');
    }
    if (!response.ok) {
      throw this.unavailable('Failed to load Keycloak user', await response.text());
    }
    return (await response.json()) as KeycloakUser;
  }

  private async getRealmRoleMappings(token: string, userId: string): Promise<KeycloakRole[]> {
    const response = await fetch(`${this.realmUrl()}/users/${userId}/role-mappings/realm`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw this.unavailable('Failed to load user roles', await response.text());
    }
    return (await response.json()) as KeycloakRole[];
  }

  private async removeRealmRoles(
    token: string,
    userId: string,
    roles: KeycloakRole[],
  ): Promise<void> {
    const response = await fetch(`${this.realmUrl()}/users/${userId}/role-mappings/realm`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roles.map((role) => ({ id: role.id, name: role.name }))),
    });
    if (!response.ok) {
      throw this.unavailable('Failed to update user roles', await response.text());
    }
  }

  private async toTenantUser(token: string, user: KeycloakUser): Promise<TenantKeycloakUser> {
    const mappings = await this.getRealmRoleMappings(token, user.id);
    return {
      id: user.id,
      email: user.email ?? null,
      username: user.username ?? user.email ?? user.id,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      enabled: user.enabled !== false,
      roles: canonicalizeTenantRoles(
        mappings.map((role) => role.name).filter((name) => this.isAssignableRealmRole(name)),
      ),
    };
  }

  private readTenantId(user: KeycloakUser): string | undefined {
    const value = user.attributes?.tenant_id;
    if (!value) {
      return undefined;
    }
    return Array.isArray(value) ? value[0] : value;
  }

  private isAssignableRealmRole(name: string): boolean {
    return isTenantAssignableRole(name);
  }

  async inspectLoginByEmail(
    email: string,
  ): Promise<{ id: string; tenantId?: string } | null> {
    const id = await this.findUserIdByEmail(email);
    if (!id) {
      return null;
    }
    const token = await this.adminToken();
    const user = await this.getUser(token, id);
    return { id, tenantId: this.readTenantId(user) };
  }

  async migrateLegacyRealmRoles(): Promise<void> {
    const token = await this.adminToken();
    const needed = [...new Set(Object.values(LEGACY_TENANT_ROLE_MAP))];
    for (const name of needed) {
      await this.ensureRealmRole(token, name);
    }

    let first = 0;
    const pageSize = 100;
    for (;;) {
      const url = new URL(`${this.realmUrl()}/users`);
      url.searchParams.set('first', String(first));
      url.searchParams.set('max', String(pageSize));
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        throw this.unavailable('Failed to list users for role migration', await response.text());
      }
      const users = (await response.json()) as KeycloakUser[];
      if (users.length === 0) {
        break;
      }
      for (const user of users) {
        const mappings = await this.getRealmRoleMappings(token, user.id);
        const legacyByCanonical = new Map<string, KeycloakRole[]>();
        for (const mapping of mappings) {
          const canonical = canonicalizeTenantRole(mapping.name);
          if (canonical === mapping.name) {
            continue;
          }
          const list = legacyByCanonical.get(canonical) ?? [];
          list.push(mapping);
          legacyByCanonical.set(canonical, list);
        }
        for (const [canonical, legacy] of legacyByCanonical) {
          if (!mappings.some((mapping) => mapping.name === canonical)) {
            await this.assignRealmRole(token, user.id, canonical);
          }
          await this.removeRealmRoles(token, user.id, legacy);
        }
      }
      first += users.length;
      if (users.length < pageSize) {
        break;
      }
    }
  }

  private async ensureRealmRole(token: string, name: string): Promise<void> {
    const existing = await fetch(`${this.realmUrl()}/roles/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (existing.ok) {
      return;
    }
    if (existing.status !== 404) {
      throw this.unavailable(`Failed to read Keycloak role ${name}`, await existing.text());
    }
    const created = await fetch(`${this.realmUrl()}/roles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description: name }),
    });
    if (!created.ok && created.status !== 409) {
      throw this.unavailable(`Failed to create Keycloak role ${name}`, await created.text());
    }
  }

  async findUserIdByEmail(email: string): Promise<string | null> {
    const token = await this.adminToken();
    const url = new URL(`${this.realmUrl()}/users`);
    url.searchParams.set('email', email);
    url.searchParams.set('exact', 'true');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      throw this.unavailable('Failed to look up Keycloak user', await response.text());
    }
    const users = (await response.json()) as Array<{ id: string }>;
    return users[0]?.id ?? null;
  }

  private async adminToken(): Promise<string> {
    const base = this.configService.get<string>('keycloak.url') ?? 'http://localhost:8080';
    const username = this.configService.get<string>('keycloak.adminUser') ?? 'admin';
    const password = this.configService.get<string>('keycloak.adminPassword') ?? '';
    if (!password) {
      throw new ServiceUnavailableException('Keycloak admin credentials are not configured');
    }

    const response = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: 'admin-cli',
        username,
        password,
        grant_type: 'password',
      }),
    });
    if (!response.ok) {
      this.logger.error(`Keycloak admin token failed: ${response.status}`);
      throw new ServiceUnavailableException('Could not authenticate to Keycloak admin API');
    }
    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) {
      throw new ServiceUnavailableException('Keycloak admin token missing');
    }
    return payload.access_token;
  }

  private realmUrl(): string {
    const base = this.configService.get<string>('keycloak.url') ?? 'http://localhost:8080';
    const realm = this.configService.get<string>('keycloak.realm') ?? 'ptw-platform';
    return `${base}/admin/realms/${realm}`;
  }

  private unavailable(message: string, detail: string): ServiceUnavailableException {
    if (detail) {
      this.logger.error(`${message}: ${detail.slice(0, 500)}`);
    }
    return new ServiceUnavailableException(message);
  }
}
