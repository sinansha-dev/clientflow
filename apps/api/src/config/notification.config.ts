import { env } from './env';

export interface NotificationConfig {
  enableEmail: boolean;
  enableLogging: boolean;
  enableTestMode: boolean;
  defaultProvider: string;
  smtp: {
    host: string;
    port: number;
    user?: string | undefined;
    pass?: string | undefined;
    fromEmail: string;
    fromName: string;
  };
}

export const notificationConfig: NotificationConfig = {
  enableEmail: env.NOTIFICATION_ENABLE_EMAIL,
  enableLogging: env.NOTIFICATION_ENABLE_LOGGING,
  enableTestMode: env.NOTIFICATION_ENABLE_TEST_MODE,
  defaultProvider: env.NOTIFICATION_DEFAULT_PROVIDER,
  smtp: {
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 587,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    fromEmail: env.SMTP_FROM,
    fromName: env.SMTP_FROM_NAME,
  },
};
