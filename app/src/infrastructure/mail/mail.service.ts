import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
};

export function redactMailText(text: string): string {
  return text.replace(/Temporary password: \S+/gi, 'Temporary password: [redacted]');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async send(mail: OutboundMail): Promise<void> {
    const host = this.configService.get<string>('smtp.host');
    const preview = { to: mail.to, subject: mail.subject, text: redactMailText(mail.text) };

    if (!host) {
      this.logger.log(preview, 'SMTP is not configured; mail logged only');
      return;
    }

    try {
      const transporter = this.getTransporter(host);
      const from = this.configService.get<string>('smtp.from') || 'noreply@localhost';
      await transporter.sendMail({
        from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      });
      this.logger.log({ to: mail.to, subject: mail.subject }, 'Mail sent');
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error.message : error,
          ...preview,
        },
        'Failed to send mail; content logged',
      );
    }
  }

  private getTransporter(host: string): Transporter {
    if (this.transporter) {
      return this.transporter;
    }
    const user = this.configService.get<string>('smtp.user');
    this.transporter = createTransport({
      host,
      port: this.configService.get<number>('smtp.port') ?? 587,
      secure: this.configService.get<boolean>('smtp.secure') ?? false,
      auth: user
        ? {
            user,
            pass: this.configService.get<string>('smtp.pass') ?? '',
          }
        : undefined,
    });
    return this.transporter;
  }
}
