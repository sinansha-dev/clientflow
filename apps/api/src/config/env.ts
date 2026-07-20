import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

const envFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const envFile of envFiles) {
  dotenv.config({ path: envFile });
}

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(24),
  JWT_REFRESH_SECRET: z.string().min(24),
  COOKIE_SECRET: z.string().min(24),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default('no-reply@clientflow.local'),
  NOTIFICATION_ENABLE_EMAIL: z.coerce.boolean().default(true),
  NOTIFICATION_ENABLE_LOGGING: z.coerce.boolean().default(true),
  NOTIFICATION_ENABLE_TEST_MODE: z.coerce.boolean().default(false),
  NOTIFICATION_DEFAULT_PROVIDER: z.string().default('GMAIL_SMTP'),
  SMTP_FROM_NAME: z.string().default('ClientFlow Platform'),
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
