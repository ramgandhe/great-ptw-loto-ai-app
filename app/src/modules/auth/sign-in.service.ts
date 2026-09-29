import { ForbiddenException, HttpException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeycloakAdminService } from '../../infrastructure/keycloak/keycloak-admin.service';

export type Session = { accessToken: string; refreshToken: string; expiresIn: number };

type TokenReply = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };

/** Thrown when the password is right but a temporary one must be replaced first. */
export class PasswordChangeRequiredException extends HttpException {
  constructor() {
    super({ message: 'Set a new password to finish signing in', error: 'PASSWORD_CHANGE_REQUIRED' }, 409);
  }
}

/**
 * Signs people in on the app's own page: the API talks to Keycloak server to server, so the
 * browser never leaves the app or sees the identity server's address.
 */
@Injectable()
export class SignInService {
  private readonly logger = new Logger(SignInService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly keycloakAdmin: KeycloakAdminService,
  ) {}

  async signIn(email: string, password: string): Promise<Session> {
    const reply = await this.token({ grant_type: 'password', username: email.trim().toLowerCase(), password, scope: 'openid profile email tenant' });
    return this.session(reply);
  }

  /** Replaces a temporary password. Keycloak only says "not fully set up" after checking the current one. */
  async setFirstPassword(email: string, password: string, newPassword: string): Promise<Session> {
    const username = email.trim().toLowerCase();
    const reply = await this.token({ grant_type: 'password', username, password, scope: 'openid profile email tenant' });
    if (!this.needsNewPassword(reply)) {
      // Either the password is wrong (reported as such) or no change is pending (just sign in).
      return this.session(reply);
    }
    if (newPassword === password) {
      throw new ForbiddenException('Choose a password different from the temporary one');
    }
    const userId = await this.keycloakAdmin.findUserIdByEmail(username);
    if (!userId) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    await this.keycloakAdmin.completePasswordChange(userId, newPassword);
    return this.signIn(username, newPassword);
  }

  async refresh(refreshToken: string): Promise<Session> {
    const reply = await this.token({ grant_type: 'refresh_token', refresh_token: refreshToken });
    if (!reply.access_token) {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    return this.session(reply, refreshToken);
  }

  /** Ends the Keycloak session too, so the refresh token cannot be reused. */
  async signOut(refreshToken: string): Promise<void> {
    await fetch(this.endpoint('logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId(), refresh_token: refreshToken }),
    }).catch((error: unknown) => this.logger.warn(`Sign-out did not reach Keycloak: ${String(error)}`));
  }

  private needsNewPassword(reply: TokenReply) {
    return reply.error === 'invalid_grant' && /not fully set up/i.test(reply.error_description ?? '');
  }

  private session(reply: TokenReply, currentRefresh?: string): Session {
    if (reply.access_token) {
      return { accessToken: reply.access_token, refreshToken: reply.refresh_token ?? currentRefresh ?? '', expiresIn: reply.expires_in ?? 300 };
    }
    if (this.needsNewPassword(reply)) {
      throw new PasswordChangeRequiredException();
    }
    const reason = reply.error_description ?? '';
    if (/disabled/i.test(reason)) {
      throw new ForbiddenException('This account is switched off. Ask your administrator to activate it.');
    }
    if (reply.error === 'invalid_grant') {
      // Same message for unknown email and wrong password: do not reveal which accounts exist.
      throw new UnauthorizedException('Email or password is incorrect');
    }
    this.logger.error(`Keycloak token error: ${reply.error ?? 'unknown'} ${reason}`);
    throw new ServiceUnavailableException('Sign-in is unavailable right now. Try again in a minute.');
  }

  private async token(params: Record<string, string>): Promise<TokenReply> {
    try {
      const response = await fetch(this.endpoint('token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: this.clientId(), ...params }),
      });
      return (await response.json()) as TokenReply;
    } catch (error) {
      this.logger.error(`Keycloak unreachable: ${String(error)}`);
      throw new ServiceUnavailableException('Sign-in is unavailable right now. Try again in a minute.');
    }
  }

  private endpoint(name: 'token' | 'logout') {
    const base = this.config.get<string>('keycloak.url') ?? 'http://localhost:8080';
    const realm = this.config.get<string>('keycloak.realm') ?? 'ptw-platform';
    return `${base}/realms/${realm}/protocol/openid-connect/${name}`;
  }

  private clientId() {
    return this.config.get<string>('keycloak.webClientId') ?? 'ptw-web';
  }
}
