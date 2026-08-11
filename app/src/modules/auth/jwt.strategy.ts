import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

interface KeycloakJwtPayload {
  sub: string;
  preferred_username?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles?: string[] };
  tenant_id?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
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

  validate(payload: KeycloakJwtPayload): AuthenticatedUser {
    const defaultTenantId = this.configService.get<string>('auth.defaultTenantId');

    return {
      id: payload.sub,
      username: payload.preferred_username ?? payload.sub,
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
      roles: payload.realm_access?.roles ?? [],
      tenantId: payload.tenant_id ?? defaultTenantId,
    };
  }
}
