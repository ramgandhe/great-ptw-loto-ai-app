import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { and, eq, or } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { organisations, tenantInvites, tenantUsers } from '../../database/schema';

interface KeycloakJwtPayload {
  sub: string;
  preferred_username?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles?: string[] };
  tenant_id?: string | string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {
    const keycloakUrl = configService.get<string>('keycloak.url')!;
    const keycloakIssuer = configService.get<string>('keycloak.issuer')!;
    const realm = configService.get<string>('keycloak.realm')!;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
      issuer: `${keycloakIssuer}/realms/${realm}`,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: KeycloakJwtPayload): Promise<AuthenticatedUser> {
    const tenantClaim = payload.tenant_id;
    const claimedTenantId = Array.isArray(tenantClaim) ? tenantClaim[0] : tenantClaim;
    const roles = (payload.realm_access?.roles ?? []).map((role) =>
      role === 'org-admin' ? 'tenant-owner' : role,
    );
    const email = (payload.email ?? payload.preferred_username)?.trim().toLowerCase();
    const tenantId = claimedTenantId || (await this.resolveTenantId(payload.sub, email));

    if (tenantId && !roles.includes('platform-admin')) {
      await this.assertTenantActive(tenantId);
    }

    return {
      id: payload.sub,
      username: payload.preferred_username ?? payload.sub,
      email,
      firstName: payload.given_name,
      lastName: payload.family_name,
      roles,
      tenantId: tenantId || undefined,
    };
  }

  private async resolveTenantId(keycloakUserId: string, email?: string): Promise<string | undefined> {
    const [member] = await this.db
      .select({ tenantId: tenantUsers.tenantId })
      .from(tenantUsers)
      .where(
        and(
          email
            ? or(eq(tenantUsers.keycloakUserId, keycloakUserId), eq(tenantUsers.email, email))
            : eq(tenantUsers.keycloakUserId, keycloakUserId),
          eq(tenantUsers.status, 'active'),
        ),
      );
    if (member?.tenantId) {
      return member.tenantId;
    }
    if (!email) {
      return undefined;
    }
    const [invite] = await this.db
      .select({ tenantId: tenantInvites.tenantId })
      .from(tenantInvites)
      .where(eq(tenantInvites.ownerEmail, email));
    return invite?.tenantId;
  }

  private async assertTenantActive(tenantId: string): Promise<void> {
    const [org] = await this.db
      .select({ status: organisations.status })
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId));
    if (org && org.status === 'disabled') {
      throw new UnauthorizedException('This organisation is disabled');
    }
  }
}
