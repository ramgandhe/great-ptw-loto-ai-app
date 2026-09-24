import { MailService, redactMailText } from '../app/src/infrastructure/mail/mail.service';

describe('MailService', () => {
  it('redacts temporary passwords in log previews', () => {
    expect(redactMailText('Temporary password: abcDEF123\nSign in')).toContain('[redacted]');
    expect(redactMailText('Temporary password: abcDEF123')).not.toContain('abcDEF123');
  });

  it('logs and skips send when SMTP host is unset', async () => {
    const log = jest.fn();
    const service = new MailService({
      get: () => undefined,
    } as never);
    (service as unknown as { logger: { log: typeof log } }).logger = {
      log,
      error: jest.fn(),
    } as never;

    await service.send({
      to: 'a@b.test',
      subject: 'Hi',
      text: 'Temporary password: secret-pass',
    });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.test',
        text: expect.stringContaining('[redacted]'),
      }),
      'SMTP is not configured; mail logged only',
    );
  });
});
