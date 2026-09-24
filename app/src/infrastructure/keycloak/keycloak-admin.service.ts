import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isTenantAssignableRole } from '../../common/constants/tenant-roles';

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
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);

  constructor(private readonly configService: ConfigService) {}

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
    role: string;
    firstName?: string;
    lastName?: string;
    temporaryPassword: string;
  }): Promise<CreatedKeycloakUser> {
    const existing = await this.findUserIdByEmail(params.email);
    if (existing) {
      throw new ConflictException('A login already exists for this email');
    }

    const token = await this.adminToken();
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
      await this.assignRealmRole(token, id, params.role);
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

  async setUserRoleInTenant(userId: string, tenantId: string, role: string): Promise<void> {
    const token = await this.adminToken();
    const user = await this.getUser(token, userId);
    if (this.readTenantId(user) !== tenantId) {
      throw new ForbiddenException('User is not in this tenant');
    }

    const current = await this.getRealmRoleMappings(token, userId);
    if (current.some((entry) => entry.name === 'platform-admin')) {
      throw new ForbiddenException('Cannot change a platform administrator');
    }

    const removable = current.filter(
      (entry) => entry.name !== role && this.isAssignableRealmRole(entry.name),
    );
    if (removable.length > 0) {
      await this.removeRealmRoles(token, userId, removable);
    }
    if (!current.some((entry) => entry.name === role)) {
      await this.assignRealmRole(token, userId, role);
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
      roles: mappings.map((role) => role.name).filter((name) => this.isAssignableRealmRole(name)),
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
