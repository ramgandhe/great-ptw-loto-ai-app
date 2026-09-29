import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PasswordChangeRequiredException, SignInService } from '../app/src/modules/auth/sign-in.service';

/** Keycloak's token endpoint replies with `reply` to every call. */
function serviceReplying(reply: Record<string, unknown>) {
  global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(reply) }) as never;
  return new SignInService({ get: () => undefined } as never, {} as never);
}

describe('SignInService', () => {
  it('returns a session for a correct password', async () => {
    const service = serviceReplying({ access_token: 'a', refresh_token: 'r', expires_in: 300 });
    await expect(service.signIn('Pat@Site.test', 'pw')).resolves.toEqual({ accessToken: 'a', refreshToken: 'r', expiresIn: 300 });
  });

  it('gives one message for a wrong password or unknown email', async () => {
    const service = serviceReplying({ error: 'invalid_grant', error_description: 'Invalid user credentials' });
    await expect(service.signIn('pat@site.test', 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('asks for a new password when the temporary one is still set', async () => {
    const service = serviceReplying({ error: 'invalid_grant', error_description: 'Account is not fully set up' });
    await expect(service.signIn('pat@site.test', 'temp')).rejects.toBeInstanceOf(PasswordChangeRequiredException);
  });

  it('says when the account is switched off', async () => {
    const service = serviceReplying({ error: 'invalid_grant', error_description: 'Account disabled' });
    await expect(service.signIn('pat@site.test', 'pw')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
