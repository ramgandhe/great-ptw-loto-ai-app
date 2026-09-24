import { randomBytes, randomUUID } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { desc, eq, sql } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { organisations, tenantInvites, tenantUsers } from '../../database/schema';
import { KeycloakAdminService } from '../../infrastructure/keycloak/keycloak-admin.service';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { AuditService } from '../logging/audit.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ensureDefaultApprovalWorkflow } from '../approval/ensure-default-workflow';

@Injectable()
export class PlatformTenantsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async listTenants() {
    const orgs = await this.db
      .select()
      .from(organisations)
      .orderBy(desc(organisations.createdAt));
    const invites = await this.db.select().from(tenantInvites);
    const inviteByOrg = new Map<(typeof invites)[number]['organisationId'], (typeof invites)[number]>();
    for (const invite of invites) {
      const current = inviteByOrg.get(invite.organisationId);
      if (!current || invite.createdAt > current.createdAt) {
        inviteByOrg.set(invite.organisationId, invite);
      }
    }

    return orgs.map((org) => {
      const invite = inviteByOrg.get(org.id);
      return {
        id: org.id,
        tenantId: org.tenantId,
        name: org.name,
        ownerEmail: org.ownerEmail,
        status: org.status,
        createdAt: org.createdAt,
        inviteStatus: invite?.status ?? null,
      };
    });
  }

  async getInviteByToken(token: string) {
    const [invite] = await this.db
      .select({
        status: tenantInvites.status,
        ownerEmail: tenantInvites.ownerEmail,
        organisationName: organisations.name,
        organisationStatus: organisations.status,
      })
      .from(tenantInvites)
      .innerJoin(organisations, eq(tenantInvites.organisationId, organisations.id))
      .where(eq(tenantInvites.token, token));
    if (!invite || invite.status === 'cancelled') {
      throw new NotFoundException('Invite not found');
    }
    if (invite.organisationStatus === 'disabled') {
      throw new ForbiddenException('This organisation is disabled');
    }
    const { organisationStatus: _organisationStatus, ...publicInvite } = invite;
    return publicInvite;
  }

  async acceptInvite(token: string, user: AuthenticatedUser) {
    const [invite] = await this.db
      .select()
      .from(tenantInvites)
      .where(eq(tenantInvites.token, token));
    if (!invite || invite.status === 'cancelled') {
      throw new NotFoundException('Invite not found');
    }

    const email = (user.email ?? user.username)?.trim().toLowerCase();
    if (!email || email !== invite.ownerEmail.toLowerCase()) {
      throw new ForbiddenException('Sign in with the invited owner email to accept this invite');
    }
    if (user.tenantId && user.tenantId !== invite.tenantId) {
      throw new ForbiddenException('This invite belongs to a different organisation');
    }

    if (invite.status === 'accepted') {
      return { status: invite.status as string, organisationId: invite.organisationId };
    }

    const [updated] = await this.db
      .update(tenantInvites)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        updatedBy: optionalUuid(user.id),
        updatedAt: new Date(),
      })
      .where(eq(tenantInvites.id, invite.id))
      .returning();

    await this.auditService.log({
      action: 'tenant.invite.accepted',
      entityType: 'organisation',
      entityId: invite.organisationId,
      userId: optionalUuid(user.id),
      tenantId: invite.tenantId,
    });

    return { status: updated.status, organisationId: updated.organisationId };
  }

  async createTenant(dto: CreateTenantDto, actor: AuthenticatedUser) {
    const ownerEmail = dto.ownerEmail.trim().toLowerCase();
    const organisationName = dto.organisationName.trim();

    const [existingInvite] = await this.db
      .select({ id: tenantInvites.id })
      .from(tenantInvites)
      .where(
        sql`lower(${tenantInvites.ownerEmail}) = ${ownerEmail} AND ${tenantInvites.status} IN ('pending', 'accepted')`,
      );
    if (existingInvite) {
      throw new ConflictException('This email already has a tenant invite');
    }

    const [existingMember] = await this.db
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(eq(tenantUsers.email, ownerEmail));
    if (existingMember) {
      throw new ConflictException('This email already belongs to an organisation');
    }

    const leftoverLogin = await this.keycloakAdmin.inspectLoginByEmail(ownerEmail);
    if (leftoverLogin) {
      if (!leftoverLogin.tenantId) {
        throw new ConflictException('A login already exists for this email');
      }
      const [existingOrg] = await this.db
        .select({ id: organisations.id })
        .from(organisations)
        .where(eq(organisations.tenantId, leftoverLogin.tenantId));
      if (existingOrg) {
        throw new ConflictException('A login already exists for this email');
      }
      await this.keycloakAdmin.deleteUserById(leftoverLogin.id);
    }

    const tenantId = randomUUID();
    const token = randomBytes(24).toString('hex');
    const temporaryPassword = randomBytes(12).toString('base64url');

    const keycloakUser = await this.keycloakAdmin.createOrgAdmin({
      email: ownerEmail,
      tenantId,
      firstName: dto.ownerFirstName?.trim(),
      lastName: dto.ownerLastName?.trim(),
      temporaryPassword,
    });

    const actorId = optionalUuid(actor.id);

    try {
      const created = await this.db.transaction(async (tx) => {
        const [organisation] = await tx
          .insert(organisations)
          .values({
            tenantId,
            name: organisationName,
            ownerEmail,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();

        const [invite] = await tx
          .insert(tenantInvites)
          .values({
            tenantId,
            organisationId: organisation.id,
            ownerEmail,
            token,
            status: 'pending',
            keycloakUserId: keycloakUser.id,
            invitedBy: actorId,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();

        await tx.insert(tenantUsers).values({
          tenantId,
          keycloakUserId: keycloakUser.id,
          email: ownerEmail,
          firstName: dto.ownerFirstName?.trim(),
          lastName: dto.ownerLastName?.trim(),
          role: 'tenant-owner',
          createdBy: actorId,
          updatedBy: actorId,
        });

        await ensureDefaultApprovalWorkflow(tx, tenantId, actorId);

        return { organisation, invite };
      });

      await this.auditService.log({
        action: 'tenant.invited',
        entityType: 'organisation',
        entityId: created.organisation.id,
        userId: actorId,
        tenantId,
        metadata: { ownerEmail },
      });

      const appPublicUrl = (
        this.configService.get<string>('appPublicUrl') ?? 'http://localhost:3000'
      ).replace(/\/$/, '');

      return {
        organisation: created.organisation,
        ownerEmail,
        inviteStatus: created.invite.status,
        joinUrl: `${appPublicUrl}/join?token=${created.invite.token}`,
        temporaryPassword,
        signInHint:
          'The tenant owner signs in with this email. Keycloak will require a password change on first login.',
      };
    } catch (error) {
      await this.keycloakAdmin.deleteUserById(keycloakUser.id).catch(() => undefined);
      throw error;
    }
  }

  async disableTenant(id: string, actor: AuthenticatedUser) {
    return this.setTenantEnabled(id, actor, false);
  }

  async enableTenant(id: string, actor: AuthenticatedUser) {
    return this.setTenantEnabled(id, actor, true);
  }

  async deleteTenant(id: string, actor: AuthenticatedUser) {
    const org = await this.getManagedOrganisation(id);
    const members = await this.db
      .select({
        keycloakUserId: tenantUsers.keycloakUserId,
        email: tenantUsers.email,
      })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, org.tenantId));
    const invites = await this.db
      .select({
        keycloakUserId: tenantInvites.keycloakUserId,
        ownerEmail: tenantInvites.ownerEmail,
      })
      .from(tenantInvites)
      .where(eq(tenantInvites.tenantId, org.tenantId));

    const keycloakIds = new Set<string>();
    const emails = new Set<string>();
    if (org.ownerEmail) {
      emails.add(org.ownerEmail.toLowerCase());
    }
    for (const member of members) {
      if (member.keycloakUserId) {
        keycloakIds.add(member.keycloakUserId);
      }
      if (member.email) {
        emails.add(member.email.toLowerCase());
      }
    }
    for (const invite of invites) {
      if (invite.keycloakUserId) {
        keycloakIds.add(invite.keycloakUserId);
      }
      if (invite.ownerEmail) {
        emails.add(invite.ownerEmail.toLowerCase());
      }
    }

    for (const email of emails) {
      const existingId = await this.keycloakAdmin.findUserIdByEmail(email);
      if (existingId) {
        keycloakIds.add(existingId);
      }
    }

    for (const userId of keycloakIds) {
      await this.keycloakAdmin.deleteUserById(userId);
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(tenantInvites).where(eq(tenantInvites.organisationId, org.id));
      await tx.delete(tenantInvites).where(eq(tenantInvites.tenantId, org.tenantId));
      await tx.delete(tenantUsers).where(eq(tenantUsers.tenantId, org.tenantId));
      await tx.delete(organisations).where(eq(organisations.id, org.id));
    });

    await this.auditService.log({
      action: 'tenant.deleted',
      entityType: 'organisation',
      entityId: org.id,
      userId: optionalUuid(actor.id),
      tenantId: org.tenantId,
    });

    return { id: org.id, deleted: true };
  }

  private async setTenantEnabled(id: string, actor: AuthenticatedUser, enabled: boolean) {
    const org = await this.getManagedOrganisation(id);
    const users = await this.db
      .select({ keycloakUserId: tenantUsers.keycloakUserId })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, org.tenantId));

    for (const user of users) {
      await this.keycloakAdmin.setUserEnabled(user.keycloakUserId, enabled);
    }

    const [updated] = await this.db
      .update(organisations)
      .set({
        status: enabled ? 'active' : 'disabled',
        updatedBy: optionalUuid(actor.id),
        updatedAt: new Date(),
      })
      .where(eq(organisations.id, org.id))
      .returning();

    await this.auditService.log({
      action: enabled ? 'tenant.enabled' : 'tenant.disabled',
      entityType: 'organisation',
      entityId: org.id,
      userId: optionalUuid(actor.id),
      tenantId: org.tenantId,
    });

    return updated;
  }

  private async getManagedOrganisation(id: string) {
    const [org] = await this.db.select().from(organisations).where(eq(organisations.id, id));
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }
    return org;
  }
}
