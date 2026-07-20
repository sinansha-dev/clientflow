import type { IEmailProvider } from './email-provider.interface';
import { GmailSMTPProvider } from './gmail-smtp.provider';
import { MockEmailProvider } from './mock-email.provider';
import { notificationConfig } from '../../config/notification.config';
import { logger } from '../../utils/logger';

export class EmailProviderFactory {
  private static providers: Map<string, IEmailProvider> = new Map();

  public static getProvider(providerName?: string): IEmailProvider {
    const targetName = (providerName || notificationConfig.defaultProvider).toUpperCase();

    if (this.providers.has(targetName)) {
      return this.providers.get(targetName)!;
    }

    let provider: IEmailProvider;

    if (notificationConfig.enableTestMode || targetName === 'MOCK' || targetName === 'TEST') {
      provider = new MockEmailProvider();
    } else {
      switch (targetName) {
        case 'GMAIL_SMTP':
        case 'SMTP':
          provider = new GmailSMTPProvider();
          break;
        default:
          logger.warn(`Unknown provider '${targetName}'. Falling back to GmailSMTPProvider.`);
          provider = new GmailSMTPProvider();
          break;
      }
    }

    this.providers.set(targetName, provider);
    return provider;
  }

  public static registerProvider(name: string, provider: IEmailProvider) {
    this.providers.set(name.toUpperCase(), provider);
  }

  public static clearCache() {
    this.providers.clear();
  }
}
