import nodemailer, { Transporter } from 'nodemailer';
import type { SendEmailOptions, SendEmailResult } from '@clientflow/types';
import type { IEmailProvider } from './email-provider.interface';
import { notificationConfig } from '../../config/notification.config';
import { logger } from '../../utils/logger';

export class GmailSMTPProvider implements IEmailProvider {
  public readonly name = 'GMAIL_SMTP';
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const { host, port, user, pass } = notificationConfig.smtp;

    if (!user || !pass) {
      logger.warn(
        'Gmail SMTP credentials (user/pass) are missing. Email sending via SMTP will fail until credentials are provided.',
      );
    }

    this.transporter = nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port: port || 587,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.transporter) {
      this.initTransporter();
    }

    const fromAddress = options.fromEmail || notificationConfig.smtp.fromEmail;
    const fromName = options.fromName || notificationConfig.smtp.fromName;
    const fromFormatted = `"${fromName}" <${fromAddress}>`;

    try {
      const mailOptions: any = {
        from: fromFormatted,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments;
      }

      const info = await this.transporter!.sendMail(mailOptions);

      logger.info(
        { to: options.to, messageId: info.messageId },
        'Email sent successfully via Gmail SMTP',
      );
      return {
        success: true,
        messageId: info.messageId,
        provider: this.name,
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to send email via Gmail SMTP';
      logger.error({ to: options.to, error: errorMsg }, 'Gmail SMTP email delivery failed');
      return {
        success: false,
        error: errorMsg,
        provider: this.name,
      };
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }
    try {
      await this.transporter!.verify();
      logger.info('Gmail SMTP connection verified successfully');
      return true;
    } catch (err: any) {
      logger.error({ error: err?.message }, 'Gmail SMTP connection verification failed');
      return false;
    }
  }
}
