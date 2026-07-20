import type { SendEmailOptions, SendEmailResult } from '@clientflow/types';
import { EmailProviderFactory } from './email/email-provider.factory';
import { emailLogRepository } from '../repositories/email-log.repository';
import { notificationConfig } from '../config/notification.config';
import { logger } from '../utils/logger';

export const emailService = {
  async sendEmail(options: SendEmailOptions, providerName?: string): Promise<SendEmailResult> {
    if (!notificationConfig.enableEmail) {
      logger.info(
        { to: options.to, subject: options.subject },
        'Email sending is disabled in configuration. Skipping email delivery.',
      );
      return {
        success: false,
        error: 'Email delivery disabled in configuration',
        provider: 'DISABLED',
      };
    }

    const provider = EmailProviderFactory.getProvider(providerName);

    try {
      const result = await provider.sendEmail(options);

      // Log delivery result to EmailLog database repository
      await emailLogRepository.createLog({
        recipient: options.to,
        subject: options.subject,
        provider: result.provider,
        status: result.success ? 'SENT' : 'FAILED',
        error: result.error || null,
        messageId: result.messageId || null,
        sentAt: result.success ? new Date() : null,
      });

      return result;
    } catch (err: any) {
      const errorMsg = err?.message || 'Unexpected exception during email delivery';
      logger.error({ to: options.to, error: errorMsg }, 'EmailService encountered error');

      await emailLogRepository.createLog({
        recipient: options.to,
        subject: options.subject,
        provider: provider.name,
        status: 'FAILED',
        error: errorMsg,
        sentAt: null,
      });

      return {
        success: false,
        error: errorMsg,
        provider: provider.name,
      };
    }
  },

  async sendHtml(to: string, subject: string, html: string, text?: string | undefined) {
    const opts: SendEmailOptions = { to, subject, html };
    if (text !== undefined) {
      opts.text = text;
    }
    return this.sendEmail(opts);
  },

  async sendPlainText(to: string, subject: string, text: string) {
    return this.sendEmail({ to, subject, text });
  },

  async testConnection(providerName?: string): Promise<boolean> {
    const provider = EmailProviderFactory.getProvider(providerName);
    return provider.testConnection();
  },

  async testEmail(toEmail: string) {
    const subject = 'ClientFlow SMTP Test Email';
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4F46E5;">ClientFlow Notification Engine Test</h2>
        <p>This is a test verification email sent from your ClientFlow Notification Architecture.</p>
        <p><strong>Environment:</strong> ${notificationConfig.enableTestMode ? 'Test / Mock' : 'Development / Production'}</p>
        <p><strong>Provider:</strong> ${notificationConfig.defaultProvider}</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6B7280;">If you did not request this email, please disregard it.</p>
      </div>
    `;
    const text = 'ClientFlow Notification Engine Test: This is a test email sent from ClientFlow.';
    return this.sendEmail({ to: toEmail, subject, html, text });
  },

  async retryFailedEmail(logId: string) {
    const log = await emailLogRepository.getById(logId);
    if (!log) {
      throw new Error(`Email log with ID ${logId} not found`);
    }

    await emailLogRepository.incrementAttempts(logId);

    const result = await this.sendEmail(
      {
        to: log.recipient,
        subject: log.subject,
        text: `Retry for email log ID ${log.id}: ${log.subject}`,
      },
      log.provider,
    );

    if (result.success) {
      await emailLogRepository.updateStatus(logId, 'SENT', null, result.messageId);
    } else {
      await emailLogRepository.updateStatus(logId, 'FAILED', result.error);
    }

    return result;
  },
};
