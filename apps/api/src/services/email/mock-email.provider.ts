import type { SendEmailOptions, SendEmailResult } from '@clientflow/types';
import type { IEmailProvider } from './email-provider.interface';
import { logger } from '../../utils/logger';

export class MockEmailProvider implements IEmailProvider {
  public readonly name = 'MOCK';
  public sentEmails: Array<SendEmailOptions & { sentAt: Date; messageId: string }> = [];

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const messageId = `<mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@clientflow.local>`;
    const record = { ...options, sentAt: new Date(), messageId };
    this.sentEmails.push(record);

    logger.info(
      { to: options.to, subject: options.subject, messageId },
      '[MockEmailProvider] Simulated email delivery',
    );

    return {
      success: true,
      messageId,
      provider: this.name,
    };
  }

  async testConnection(): Promise<boolean> {
    logger.info('[MockEmailProvider] Connection check OK');
    return true;
  }

  clear() {
    this.sentEmails = [];
  }
}
