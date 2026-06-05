import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

type VerificationEmailInput = {
  to: string;
  verificationUrl: string;
  fullName?: string;
};

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(input: VerificationEmailInput) {
    const host = this.config.get<string>('EMAIL_SERVER_HOST');
    const port = Number(this.config.get<string>('EMAIL_SERVER_PORT') || 587);
    const user = this.config.get<string>('EMAIL_SERVER_USER');
    const pass = this.config.get<string>('EMAIL_SERVER_PASSWORD');
    const secure = String(this.config.get<string>('EMAIL_SERVER_SECURE') || 'false') === 'true';
    const from = this.config.get<string>('EMAIL_FROM') || 'JoraIQ <no-reply@joraiq.ai>';

    if (!host || !user || !pass) {
      throw new InternalServerErrorException('SMTP settings are not configured');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const displayName = input.fullName?.trim() || 'there';

    await transporter.sendMail({
      from,
      to: input.to,
      subject: 'Confirm your JoraIQ email address',
      text: [
        `Hi ${displayName},`,
        '',
        'Confirm your email address to finish creating your JoraIQ account.',
        '',
        input.verificationUrl,
        '',
        'If you did not request this account, you can ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h1 style="font-size:22px;margin:0 0 16px">Confirm your JoraIQ email address</h1>
          <p>Hi ${this.escapeHtml(displayName)},</p>
          <p>Confirm your email address to finish creating your JoraIQ account.</p>
          <p>
            <a href="${input.verificationUrl}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">
              Confirm email address
            </a>
          </p>
          <p style="font-size:13px;color:#64748b">If the button does not work, paste this link into your browser:</p>
          <p style="font-size:13px;word-break:break-all;color:#334155">${input.verificationUrl}</p>
        </div>
      `,
    });
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
