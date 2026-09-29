import { BadRequestException } from '@nestjs/common';
import { PasswordResetService } from '../app/src/modules/auth/password-reset.service';

function build(options: { userId: string | null; claimed: unknown[] }) {
  const inserts: unknown[] = [];
  const db = {
    insert: () => ({ values: (v: unknown) => (inserts.push(v), Promise.resolve()) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve(options.claimed) }) }) }),
  };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const keycloak = { findUserIdByEmail: jest.fn().mockResolvedValue(options.userId), completePasswordChange: jest.fn() };
  const service = new PasswordResetService(db as never, keycloak as never, mail as never, { get: () => 'http://app.test' } as never, {} as never);
  return { service, inserts, mail };
}

describe('PasswordResetService', () => {
  it('sends nothing for an email without an account, and does not say so', async () => {
    const { service, inserts, mail } = build({ userId: null, claimed: [] });
    await expect(service.request('nobody@site.test')).resolves.toBeUndefined();
    expect(inserts).toHaveLength(0);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('stores only a hash and emails a link to the app', async () => {
    const { service, inserts, mail } = build({ userId: 'kc-1', claimed: [] });
    await service.request('Pat@Site.test');
    const row = inserts[0] as { tokenHash: string; email: string };
    const link = (mail.send.mock.calls[0][0] as { text: string }).text.match(/token=(\S+)/)![1];
    expect(row.email).toBe('pat@site.test');
    expect(row.tokenHash).toHaveLength(64);
    expect(row.tokenHash).not.toContain(link);
  });

  it('refuses an expired or already used link', async () => {
    const { service } = build({ userId: 'kc-1', claimed: [] });
    await expect(service.complete('x'.repeat(43), 'new password 1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
