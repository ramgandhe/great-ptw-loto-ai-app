import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { passwordResetTokens } from '../../database/schema';
import { KeycloakAdminService } from '../../infrastructure/keycloak/keycloak-admin.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { SignInService, type Session } from './sign-in.service';

const LINK_MINUTES = 30;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * "Forgot password" on the app's own pages: a one-time emailed link, then a new password set
 * through the Keycloak admin API. Nobody sees Keycloak, and no one waits on an administrator.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly signIn: SignInService,
  ) {}

  /** Always resolves the same way, so the page cannot be used to find out who has an account. */
  async request(email: string): Promise<void> {
    const address = email.trim().toLowerCase();
    const userId = await this.keycloakAdmin.findUserIdByEmail(address).catch(() => null);
    if (!userId) {
      return;
    }
    const token = randomBytes(32).toString('base64url');
    await this.db.insert(passwordResetTokens).values({
      keycloakUserId: userId,
      email: address,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000),
    });
    const link = `${this.config.get<string>('appPublicUrl') ?? 'http://localhost:3000'}/reset-password?token=${token}`;
    // Not awaited: sending takes time only when the account exists, which would give it away.
    void this.mail
      .send({
        to: address,
        subject: 'Reset your PermitWiseAI password',
        text: [
          'Someone asked to reset the password for this email on PermitWiseAI.',
          '',
          `Choose a new password here (the link works once, for ${LINK_MINUTES} minutes):`,
          link,
          '',
          'If it was not you, ignore this email. Your password stays as it is.',
        ].join('\n'),
      })
      .catch((error: unknown) => this.logger.warn(`Reset email not sent: ${String(error)}`));
  }

  /** Uses the link once, sets the password, and signs the person in. */
  async complete(token: string, newPassword: string): Promise<Session> {
    // Claim the link before changing anything, so two tabs cannot use it twice.
    const [row] = await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, hash(token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!row) {
      throw new BadRequestException('This link has expired or was already used. Ask for a new one.');
    }
    try {
      await this.keycloakAdmin.completePasswordChange(row.keycloakUserId, newPassword);
    } catch (error) {
      // Password refused (for example by policy): give the link back so they can try another.
      await this.db.update(passwordResetTokens).set({ usedAt: null }).where(eq(passwordResetTokens.id, row.id));
      throw error;
    }
    // Older links for the same person stop working once the password has changed.
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(passwordResetTokens.keycloakUserId, row.keycloakUserId), isNull(passwordResetTokens.usedAt)));
    return this.signIn.signIn(row.email, newPassword);
  }
}
