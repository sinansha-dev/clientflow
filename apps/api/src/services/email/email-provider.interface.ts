import type { SendEmailOptions, SendEmailResult } from '@clientflow/types';

export interface IEmailProvider {
  readonly name: string;
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  testConnection(): Promise<boolean>;
}
